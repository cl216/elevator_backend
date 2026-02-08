import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { Session } from '../sessions/entities/session.entity';

@Injectable()
export class BookingsService {
  constructor(private readonly dataSource: DataSource) {}

  async createBooking(userId: string, sessionId: string) {
    return this.dataSource.transaction(async (manager) => {
      // 1️⃣ Lock session row (THIS PREVENTS RACE CONDITIONS)
      const session = await manager
        .getRepository(Session)
        .createQueryBuilder('session')
        .where('session.id = :sessionId', { sessionId })
        .setLock('pessimistic_write')
        .getOne();

      if (!session) {
        throw new BadRequestException('Session not found');
      }

      // 2️⃣ Count CONFIRMED bookings
      const confirmedCount = await manager
        .getRepository(Booking)
        .count({
          where: {
            session: { id: sessionId },
            status: 'CONFIRMED',
          },
        });

      // 3️⃣ Capacity check
      if (confirmedCount >= session.max_participants) {
        throw new BadRequestException('Session is fully booked');
      }

      // 4️⃣ Create PENDING booking
      const booking = manager.create(Booking, {
        user: { id: userId },
        session: { id: sessionId },
        status: 'PENDING',
      });

      return manager.save(booking);
    });
  }
}