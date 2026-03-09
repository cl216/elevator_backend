import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Stripe from 'stripe';
import { DataSource } from 'typeorm';
import { Booking, PayoutStatus } from '../bookings/entities/booking.entity';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  });

  constructor(private readonly dataSource: DataSource) {}

  @Cron('*/1 * * * *') // every minute
  async runPayouts() {
    const startedAt = Date.now();

    this.logger.log('PAYOUT_CRON_STARTED');

    try {
      await this.dataSource.transaction(async (manager) => {
        const bookings = await manager
          .createQueryBuilder(Booking, 'b')
          .innerJoinAndSelect('b.session', 's')
          .innerJoinAndSelect('s.teacher', 't')
          .innerJoinAndSelect('t.teacherProfile', 'tp')
          .where('b.status = :confirmed', { confirmed: 'CONFIRMED' })
          .andWhere('b.payout_status = :notPaid', {
            notPaid: PayoutStatus.NOT_PAID_OUT,
          })
          .andWhere(`s.end_time <= (NOW() - INTERVAL '24 hours')`)
          .andWhere('tp.stripe_account_id IS NOT NULL')
          .andWhere('tp.stripe_enabled = true')
          .orderBy('s.end_time', 'ASC')
          .limit(25)
          .setLock('pessimistic_write')
          .setOnLocked('skip_locked')
          .getMany();

        this.logger.log(`PAYOUT_CRON_BATCH_FOUND count=${bookings.length}`);

        for (const booking of bookings) {
          await this.processOne(manager, booking.id);
        }
      });

      const durationMs = Date.now() - startedAt;
      this.logger.log(`PAYOUT_CRON_COMPLETED durationMs=${durationMs}`);
    } catch (e: any) {
      const durationMs = Date.now() - startedAt;
      this.logger.error(
        `PAYOUT_CRON_FAILED durationMs=${durationMs} message=${e?.message ?? 'unknown'}`,
        e?.stack,
      );
      throw e;
    }
  }

  private async processOne(manager: any, bookingId: string) {
    this.logger.log(`PAYOUT_ATTEMPT_STARTED bookingId=${bookingId}`);

    const booking = await manager.findOne(Booking, {
      where: { id: bookingId },
      relations: { session: { teacher: { teacherProfile: true } } } as any,
    });

    if (!booking) {
      this.logger.warn(
        `PAYOUT_ATTEMPT_BOOKING_NOT_FOUND bookingId=${bookingId}`,
      );
      return;
    }

    // Re-check invariants
    if (booking.status !== 'CONFIRMED') {
      this.logger.warn(
        `PAYOUT_ATTEMPT_SKIPPED_INVALID_STATUS bookingId=${booking.id} status=${booking.status}`,
      );
      return;
    }

    if (booking.payout_status !== PayoutStatus.NOT_PAID_OUT) {
      this.logger.warn(
        `PAYOUT_ATTEMPT_SKIPPED_ALREADY_PROCESSED bookingId=${booking.id} payoutStatus=${booking.payout_status}`,
      );
      return;
    }

    if (!booking.amount || !booking.currency) {
      this.logger.warn(
        `PAYOUT_ATTEMPT_SKIPPED_MISSING_AMOUNT_OR_CURRENCY bookingId=${booking.id} amount=${booking.amount} currency=${booking.currency}`,
      );
      return;
    }

    const teacherProfile = booking.session.teacher.teacherProfile;

    if (!teacherProfile?.stripe_account_id) {
      this.logger.warn(
        `PAYOUT_ATTEMPT_SKIPPED_MISSING_STRIPE_ACCOUNT bookingId=${booking.id}`,
      );
      return;
    }

    if (!teacherProfile?.stripe_enabled) {
      this.logger.warn(
        `PAYOUT_ATTEMPT_SKIPPED_STRIPE_NOT_ENABLED bookingId=${booking.id}`,
      );
      return;
    }

    const teacherStripeAccountId = teacherProfile.stripe_account_id;

    booking.payout_attempted_at = new Date();
    await manager.save(booking);

    try {
      const transfer = await this.stripe.transfers.create(
        {
          amount: booking.amount,
          currency: booking.currency,
          destination: teacherStripeAccountId,
          metadata: { bookingId: booking.id },
        },
        { idempotencyKey: `payout_${booking.id}` },
      );

      booking.stripe_transfer_id = transfer.id;
      booking.paid_out_at = new Date();
      booking.payout_status = PayoutStatus.PAID_OUT;
      booking.payout_failure_reason = null;

      await manager.save(booking);

      this.logger.log(
        `PAYOUT_SUCCESS bookingId=${booking.id} transferId=${transfer.id} destinationAccount=${teacherStripeAccountId}`,
      );
    } catch (e: any) {
      booking.payout_status = PayoutStatus.PAYOUT_FAILED;
      booking.payout_failure_reason = `${e?.type ?? 'StripeError'}: ${e?.message ?? 'unknown'}`;

      await manager.save(booking);

      this.logger.warn(
        `PAYOUT_FAILED bookingId=${booking.id} message=${booking.payout_failure_reason}`,
      );
    }
  }
}
