import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { Booking } from './entities/booking.entity';

@Injectable()
export class BookingExpiryService {
  private readonly logger = new Logger(BookingExpiryService.name);

  constructor(private readonly dataSource: DataSource) {}

  // runs every minute
  @Cron('*/1 * * * *')
  async expirePendingBookings() {
    const now = new Date();

    const result = await this.dataSource
      .getRepository(Booking)
      .createQueryBuilder()
      .update(Booking)
      .set({ status: 'CANCELLED' })
      .where('status = :status', { status: 'PENDING' })
      .andWhere('expires_at IS NOT NULL')
      .andWhere('expires_at < :now', { now })
      .execute();

    if ((result.affected ?? 0) > 0) {
      this.logger.log(`Expired ${result.affected} pending bookings`);
    }
  }
}