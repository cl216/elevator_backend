import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';

@Injectable()
export class BookingsService {
  constructor(private readonly dataSource: DataSource) {}

  async createBooking(userId: string, sessionId: string) {
    if (!sessionId) throw new BadRequestException('sessionId is required');

    return this.dataSource.transaction(async (manager) => {
      // 1️⃣ Lock session row (prevents oversell)
      const session = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) throw new NotFoundException('Session not found');

      // 2️⃣ Block booking if session already started/past
      const now = new Date();
      if (session.start_time <= now) {
        throw new BadRequestException('Session already started or is in the past');
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
        throw new ConflictException('Session is fully booked');
      }

      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // 5️⃣ Create PENDING booking
      const booking = manager.create(Booking, {
        user: { id: userId } as any,
        session: { id: sessionId } as any,
        status: 'PENDING',
        expires_at: expiresAt,
      });
      
      return manager.save(booking);
    });
  }

async getMyBookings(userId: string) {
  return this.dataSource
    .getRepository(Booking)
    .createQueryBuilder('b')
    .leftJoinAndSelect('b.session', 's')
    .where('b.user_id = :userId', { userId }) // works because you set JoinColumn({name:'user_id'})
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
