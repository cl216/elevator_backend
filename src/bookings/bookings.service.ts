import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';
import { containsBlockedContactOrOffPlatformContent } from '../utils/content-moderation';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(private readonly dataSource: DataSource) {}

  async createBooking(
    userId: string,
    sessionId: string,
    introMessage?: string,
  ) {
    this.logger.log(
      `BOOKING_CREATE_ATTEMPT userId=${userId} sessionId=${sessionId}`,
    );

    if (!sessionId) {
      this.logger.warn(`BOOKING_CREATE_MISSING_SESSION_ID userId=${userId}`);
      throw new BadRequestException('sessionId is required');
    }

    if (
      introMessage &&
      containsBlockedContactOrOffPlatformContent(introMessage)
    ) {
      this.logger.warn(
        `BOOKING_CREATE_BLOCKED_CONTENT userId=${userId} sessionId=${sessionId}`,
      );
      throw new BadRequestException(
        'Please keep communication on the platform. Do not include phone numbers, email addresses, social handles, or external sites in your message.',
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // 1️⃣ Lock session row (prevents oversell)
      const session = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) {
        this.logger.warn(
          `BOOKING_CREATE_SESSION_NOT_FOUND userId=${userId} sessionId=${sessionId}`,
        );
        throw new NotFoundException('Session not found');
      }

      // 2️⃣ Block booking if session already started/past
      const now = new Date();
      if (session.start_time <= now) {
        this.logger.warn(
          `BOOKING_CREATE_PAST_SESSION userId=${userId} sessionId=${sessionId}`,
        );
        throw new BadRequestException(
          'Session already started or is in the past',
        );
      }

      // 3️⃣ Prevent duplicate booking (same user + session)
      const existing = await manager
        .getRepository(Booking)
        .createQueryBuilder('b')
        .innerJoin('b.user', 'u')
        .innerJoin('b.session', 's')
        .where('u.id = :userId', { userId })
        .andWhere('s.id = :sessionId', { sessionId })
        .andWhere('b.status IN (:...statuses)', {
          statuses: ['PENDING', 'CONFIRMED'],
        })
        .getOne();

      if (existing) {
        this.logger.warn(
          `BOOKING_CREATE_DUPLICATE userId=${userId} sessionId=${sessionId} existingBookingId=${existing.id}`,
        );
        throw new ConflictException('You already booked this session');
      }

      // 4️⃣ Count ACTIVE bookings (PENDING + CONFIRMED)
      const activeCount = await manager
        .getRepository(Booking)
        .createQueryBuilder('b')
        .innerJoin('b.session', 's')
        .where('s.id = :sessionId', { sessionId })
        .andWhere('b.status IN (:...statuses)', {
          statuses: ['PENDING', 'CONFIRMED'],
        })
        .getCount();

      if (activeCount >= session.max_participants) {
        this.logger.warn(
          `BOOKING_CREATE_FULL userId=${userId} sessionId=${sessionId} activeCount=${activeCount} maxParticipants=${session.max_participants}`,
        );
        throw new ConflictException('Session is fully booked');
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // 5️⃣ Create PENDING booking
      const booking = manager.create(Booking, {
        user: { id: userId } as any,
        session: { id: sessionId } as any,
        status: 'PENDING',
        intro_message: introMessage?.trim() || null,
        expires_at: expiresAt,
      });

      const savedBooking = await manager.save(booking);

      this.logger.log(
        `BOOKING_CREATE_SUCCESS bookingId=${savedBooking.id} userId=${userId} sessionId=${sessionId}`,
      );

      return savedBooking;
    });
  }

  async getMyBookings(userId: string) {
    this.logger.log(`BOOKINGS_GET_MY_BOOKINGS userId=${userId}`);

    return this.dataSource
      .getRepository(Booking)
      .createQueryBuilder('b')
      .leftJoinAndSelect('b.session', 's')
      .where('b.user_id = :userId', { userId })
      .orderBy('b.createdAt', 'DESC')
      .select([
        'b.id',
        'b.status',
        'b.createdAt',
        's.id',
        's.start_time',
        's.price',
        's.max_participants',
      ])
      .getMany();
  }
}
