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
    const startedAt = Date.now();

    this.logger.log('BOOKING_EXPIRY_CRON_STARTED');

    try {
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

      const expiredCount = result.affected ?? 0;

      if (expiredCount > 0) {
        this.logger.log(`BOOKING_EXPIRY_EXPIRED count=${expiredCount}`);
      }

      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `BOOKING_EXPIRY_CRON_COMPLETED expiredCount=${expiredCount} durationMs=${durationMs}`,
      );
    } catch (e: any) {
      const durationMs = Date.now() - startedAt;

      this.logger.error(
        `BOOKING_EXPIRY_CRON_FAILED durationMs=${durationMs} message=${e?.message ?? 'unknown'}`,
        e?.stack,
      );

      throw e;
    }
  }
}
