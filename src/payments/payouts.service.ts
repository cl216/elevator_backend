import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Stripe from 'stripe';
import { DataSource } from 'typeorm';
import {
  Booking,
  BookingStatus,
  PayoutStatus,
} from '../bookings/entities/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';

@Injectable()
export class PayoutsService {
  private readonly logger = new Logger(PayoutsService.name);

  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  });

  constructor(
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {}

  @Cron('*/1 * * * *')
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
          .where('b.status IN (:...payableStatuses)', {
            payableStatuses: [
              BookingStatus.COMPLETED,
              BookingStatus.LEARNER_NO_SHOW,
              BookingStatus.LATE_CANCELLED_BY_LEARNER,
            ],
          })
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

      this.logger.log(`PAYOUT_CRON_COMPLETED durationMs=${Date.now() - startedAt}`);
    } catch (e: any) {
      this.logger.error(
        `PAYOUT_CRON_FAILED durationMs=${Date.now() - startedAt} message=${e?.message ?? 'unknown'}`,
        e?.stack,
      );
      throw e;
    }
  }

  private async processOne(manager: any, bookingId: string) {
    this.logger.log(`PAYOUT_ATTEMPT_STARTED bookingId=${bookingId}`);

    const booking = await manager.findOne(Booking, {
      where: { id: bookingId },
      relations: {
        session: {
          class: true,
          teacher: {
            teacherProfile: true,
          },
        },
      } as any,
    });

    if (!booking) return;

    const payableStatuses = [
      BookingStatus.COMPLETED,
      BookingStatus.LEARNER_NO_SHOW,
      BookingStatus.LATE_CANCELLED_BY_LEARNER,
    ];

    if (!payableStatuses.includes(booking.status)) return;
    if (booking.payout_status !== PayoutStatus.NOT_PAID_OUT) return;

    const payoutAmount =
      booking.teacher_payout_amount ??
      booking.lesson_amount ??
      booking.amount;

    if (!payoutAmount || !booking.currency) return;

    const teacherProfile = booking.session.teacher.teacherProfile;

    if (!teacherProfile?.stripe_account_id || !teacherProfile?.stripe_enabled) {
      return;
    }

    const teacherStripeAccountId = teacherProfile.stripe_account_id;

    booking.payout_attempted_at = new Date();
    await manager.save(booking);

    try {
      const transfer = await this.stripe.transfers.create(
        {
          amount: payoutAmount,
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

      await this.notifyTeacherPayoutSent(booking, payoutAmount);

      this.logger.log(
        `PAYOUT_SUCCESS bookingId=${booking.id} transferId=${transfer.id} destinationAccount=${teacherStripeAccountId} amount=${payoutAmount}`,
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

  private async notifyTeacherPayoutSent(booking: Booking, payoutAmount: number) {
    try {
      const teacherId = booking.session?.teacher?.id;
      const classTitle =
        (booking.session as any)?.class?.title ??
        (booking.session as any)?.class?.name ??
        'your session';

      if (!teacherId) return;

      const amountLabel = `€${(payoutAmount / 100).toFixed(2)}`;
      const title = 'Payout sent 💸';
      const body = `${amountLabel} from "${classTitle}" has been sent to your Stripe account.`;

      await this.notificationsService.create({
        user_id: teacherId,
        type: 'PAYOUT_SENT',
        title,
        body,
        payload: {
          bookingId: booking.id,
          sessionId: booking.session?.id,
          amount: payoutAmount,
          currency: booking.currency,
        },
      });

      await this.pushNotificationsService.sendToUser(teacherId, title, body, {
        type: 'PAYOUT_SENT',
        bookingId: booking.id,
        sessionId: booking.session?.id,
      });

      this.logger.log(
        `PAYOUT_NOTIFICATION_SENT bookingId=${booking.id} teacherId=${teacherId}`,
      );
    } catch (e: any) {
      this.logger.warn(
        `PAYOUT_NOTIFICATION_FAILED bookingId=${booking.id} message=${e?.message ?? 'unknown'}`,
      );
    }
  }
}