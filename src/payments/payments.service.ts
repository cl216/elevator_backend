import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Booking, BookingStatus } from '../bookings/entities/booking.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { BookingsService } from '../bookings/bookings.service';
import { PushNotificationsService } from '../notifications/push-notifications.service';
import { User } from '../users/user.entity';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly MAX_REFUND_RETRY_COUNT = 4;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(forwardRef(() => BookingsService))
    private readonly bookingsService: BookingsService,
    private readonly pushNotificationsService: PushNotificationsService,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }

  async handleWebhook(event: Stripe.Event) {
    this.logger.log(
      `STRIPE_WEBHOOK_RECEIVED eventId=${event.id} eventType=${event.type}`,
    );

    if (event.type === 'checkout.session.completed') {
      await this.handleCheckoutSessionCompleted(
        event,
        event.data.object as Stripe.Checkout.Session,
      );
      return;
    }

    if (event.type === 'refund.updated') {
      await this.handleRefundUpdated(event, event.data.object as Stripe.Refund);
      return;
    }

    this.logger.log(
      `STRIPE_WEBHOOK_IGNORED eventId=${event.id} eventType=${event.type}`,
    );
  }

  private async handleCheckoutSessionCompleted(
    event: Stripe.Event,
    session: Stripe.Checkout.Session,
  ) {
    const checkoutSessionId = session.id;

    this.logger.log(
      `STRIPE_WEBHOOK_PROCESSING_CHECKOUT_COMPLETED eventId=${event.id} checkoutSessionId=${checkoutSessionId}`,
    );

    let booking = await this.bookingRepo.findOne({
      where: { stripe_checkout_session_id: checkoutSessionId },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!booking) {
      const bookingId =
        session.client_reference_id ?? session.metadata?.bookingId;

      if (!bookingId) {
        this.logger.warn(
          `STRIPE_WEBHOOK_MISSING_BOOKING_REFERENCE eventId=${event.id} checkoutSessionId=${checkoutSessionId}`,
        );
        return;
      }

      this.logger.warn(
        `STRIPE_WEBHOOK_FALLBACK_BOOKING_LOOKUP eventId=${event.id} bookingId=${bookingId}`,
      );

      booking = await this.bookingRepo.findOne({
        where: { id: bookingId },
        relations: {
          user: true,
          session: { class: true, teacher: true },
        } as any,
      });

      if (!booking) {
        this.logger.warn(
          `STRIPE_WEBHOOK_BOOKING_NOT_FOUND eventId=${event.id} bookingId=${bookingId}`,
        );
        return;
      }

      booking.stripe_checkout_session_id = checkoutSessionId;
      await this.bookingRepo.save(booking);
    }

if (booking.status !== BookingStatus.PENDING) {
  if (
    booking.stripe_payment_intent_id &&
    (!booking.stripe_charge_id ||
      !booking.stripe_funds_available_at)
  ) {
    try {
      const paymentDetails = await this.getStripePaymentDetails(
        booking.stripe_payment_intent_id,
      );

      booking.stripe_charge_id = paymentDetails.stripeChargeId;
      booking.stripe_fee_amount = paymentDetails.stripeFeeAmount;
      booking.stripe_funds_available_at =
        paymentDetails.stripeFundsAvailableAt;

      await this.bookingRepo.save(booking);

      this.logger.log(
        `STRIPE_WEBHOOK_PAYMENT_DETAILS_REPAIRED ` +
          `eventId=${event.id} ` +
          `bookingId=${booking.id} ` +
          `chargeId=${paymentDetails.stripeChargeId} ` +
          `fundsAvailableAt=${
            paymentDetails.stripeFundsAvailableAt?.toISOString() ??
            'unknown'
          }`,
      );
    } catch (error: any) {
      this.logger.warn(
        `STRIPE_WEBHOOK_PAYMENT_DETAILS_REPAIR_FAILED ` +
          `eventId=${event.id} ` +
          `bookingId=${booking.id} ` +
          `message=${error?.message ?? 'unknown'}`,
      );
    }
  }

  this.logger.log(
    `STRIPE_WEBHOOK_ALREADY_PROCESSED ` +
      `eventId=${event.id} ` +
      `bookingId=${booking.id} ` +
      `status=${booking.status}`,
  );

  return;
}
    const confirmedBooking = await this.bookingsService.markBookingConfirmed({
      bookingId: booking.id,
      stripePaymentIntentId: String(session.payment_intent ?? ''),
      stripeCheckoutSessionId: checkoutSessionId,
      paidAt: new Date(),
    });

if (confirmedBooking.stripe_payment_intent_id) {
  try {
    const paymentDetails = await this.getStripePaymentDetails(
      confirmedBooking.stripe_payment_intent_id,
    );

    confirmedBooking.stripe_charge_id =
      paymentDetails.stripeChargeId;

    confirmedBooking.stripe_fee_amount =
      paymentDetails.stripeFeeAmount;

    confirmedBooking.stripe_funds_available_at =
      paymentDetails.stripeFundsAvailableAt;

    await this.bookingRepo.save(confirmedBooking);

    this.logger.log(
      `STRIPE_PAYMENT_DETAILS_SAVED ` +
        `bookingId=${confirmedBooking.id} ` +
        `chargeId=${paymentDetails.stripeChargeId} ` +
        `fundsAvailableAt=${
          paymentDetails.stripeFundsAvailableAt?.toISOString() ?? 'unknown'
        }`,
    );
  } catch (error: any) {
    this.logger.warn(
      `FAILED_TO_SYNC_STRIPE_PAYMENT_DETAILS ` +
        `bookingId=${confirmedBooking.id} ` +
        `message=${error?.message ?? 'unknown'}`,
    );
  }
}

    const classTitle = confirmedBooking.session?.class?.title ?? 'your session';

    const learnerName =
      (confirmedBooking.user as any)?.first_name?.trim?.() ||
      (confirmedBooking.user as any)?.email?.trim?.() ||
      'A learner';

    await this.notificationRepo.save(
      this.notificationRepo.create({
        user_id: confirmedBooking.user.id,
        type: 'booking_confirmed',
        title: 'Booking confirmed',
        body: `Your place is confirmed for ${classTitle}.`,
        payload: {
          booking_id: confirmedBooking.id,
          session_id: confirmedBooking.session?.id,
          class_title: classTitle,
        },
      }),
    );

    await this.pushNotificationsService.sendToUser(confirmedBooking.user.id, {
      title: 'Booking confirmed',
      body: `Your place is confirmed for ${classTitle}.`,
      data: {
        type: 'booking_confirmed',
        booking_id: confirmedBooking.id,
        session_id: confirmedBooking.session?.id,
        class_title: classTitle,
      },
    });

    if (confirmedBooking.session?.teacher?.id) {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          user_id: confirmedBooking.session.teacher.id,
          type: 'booking_confirmed_teacher',
          title: 'Booking paid',
body: `${learnerName} has paid for ${classTitle}. After the session, Elevator allows 24 hours for issue reports. Your payout will then be approved and transferred according to Stripe’s processing timeline.`,payload: {
            booking_id: confirmedBooking.id,
            session_id: confirmedBooking.session?.id,
            class_title: classTitle,
            learner_name: learnerName,
          },
        }),
      );

      await this.pushNotificationsService.sendToUser(
        confirmedBooking.session.teacher.id,
        {
          title: 'Booking paid',
body: `${learnerName} has paid for ${classTitle}. After the session, Elevator allows 24 hours for issue reports. Your payout will then be approved and transferred according to Stripe’s processing timeline.`,data: {
            type: 'booking_confirmed_teacher',
            booking_id: confirmedBooking.id,
            session_id: confirmedBooking.session?.id,
            class_title: classTitle,
            learner_name: learnerName,
          },
        },
      );
    }

    this.logger.log(
      `STRIPE_WEBHOOK_BOOKING_CONFIRMED eventId=${event.id} bookingId=${confirmedBooking.id} checkoutSessionId=${checkoutSessionId}`,
    );
  }

  private async handleRefundUpdated(event: Stripe.Event, refund: Stripe.Refund) {
    const bookingId = refund.metadata?.bookingId;

    this.logger.log(
      `STRIPE_REFUND_UPDATED_RECEIVED eventId=${event.id} refundId=${refund.id} status=${refund.status} bookingId=${bookingId ?? 'missing'} failureReason=${refund.failure_reason ?? 'none'}`,
    );

    if (!bookingId) {
      this.logger.warn(
        `STRIPE_REFUND_UPDATED_MISSING_BOOKING_ID eventId=${event.id} refundId=${refund.id}`,
      );
      return;
    }

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!booking) {
      this.logger.warn(
        `STRIPE_REFUND_UPDATED_BOOKING_NOT_FOUND eventId=${event.id} refundId=${refund.id} bookingId=${bookingId}`,
      );
      return;
    }

    if (refund.status === 'pending') {
      if (
        booking.status === BookingStatus.CANCELLED_BY_LEARNER ||
        booking.status === BookingStatus.CANCELLED_BY_TEACHER ||
        booking.status === BookingStatus.REFUND_FAILED
      ) {
        await this.bookingsService.markBookingRefundPending(bookingId, {
          sendEmail: false,
        });
      }

      this.logger.log(
        `STRIPE_REFUND_PENDING eventId=${event.id} refundId=${refund.id} bookingId=${bookingId}`,
      );
      return;
    }

    if (refund.status === 'succeeded') {
      if (
        booking.status === BookingStatus.CANCELLED_BY_LEARNER ||
        booking.status === BookingStatus.CANCELLED_BY_TEACHER ||
        booking.status === BookingStatus.REFUND_FAILED
      ) {
        await this.bookingsService.markBookingRefundPending(bookingId, {
          sendEmail: false,
        });
      }

      if (booking.status === BookingStatus.REFUNDED) {
        this.logger.log(
          `STRIPE_REFUND_ALREADY_APPLIED eventId=${event.id} refundId=${refund.id} bookingId=${bookingId}`,
        );
        return;
      }

      await this.bookingsService.markBookingRefunded({
        bookingId,
        refundAmount: refund.amount,
        stripeRefundId: refund.id,
        refundedAt: new Date(),
      });

      this.logger.log(
        `STRIPE_REFUND_SUCCEEDED eventId=${event.id} refundId=${refund.id} bookingId=${bookingId} amount=${refund.amount}`,
      );
      return;
    }

    if (refund.status === 'failed' || refund.status === 'canceled') {
      const currentRetryCount = booking.refund_retry_count ?? 0;
      const nextRetryAt =
        currentRetryCount < this.MAX_REFUND_RETRY_COUNT
          ? this.computeNextRetryAt(currentRetryCount)
          : null;

      await this.bookingsService.markBookingRefundFailed({
        bookingId,
        stripeRefundId: refund.id,
        failureReason: refund.failure_reason ?? refund.status,
        nextRetryAt,
        incrementRetryCount: true,
      });

      this.logger.warn(
        `STRIPE_REFUND_FAILED eventId=${event.id} refundId=${refund.id} bookingId=${bookingId} status=${refund.status} failureReason=${refund.failure_reason ?? 'unknown'}`,
      );
      return;
    }

    this.logger.log(
      `STRIPE_REFUND_UPDATED_UNHANDLED_STATUS eventId=${event.id} refundId=${refund.id} bookingId=${bookingId} status=${refund.status}`,
    );
  }

  async createCheckoutSession(bookingId: string, learnerId: string) {
    this.logger.log(
      `PAYMENT_CHECKOUT_CREATE_ATTEMPT bookingId=${bookingId} learnerId=${learnerId}`,
    );

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { teacher: { teacherProfile: true } },
      } as any,
    });

    if (!booking) {
      this.logger.warn(
        `PAYMENT_CHECKOUT_BOOKING_NOT_FOUND bookingId=${bookingId} learnerId=${learnerId}`,
      );
      throw new NotFoundException('Booking not found');
    }

    if (booking.user.id !== learnerId) {
      this.logger.warn(
        `PAYMENT_CHECKOUT_FORBIDDEN bookingId=${bookingId} learnerId=${learnerId} bookingUserId=${booking.user.id}`,
      );
      throw new ForbiddenException('Not your booking');
    }

    if (booking.status !== BookingStatus.PENDING) {
      this.logger.warn(
        `PAYMENT_CHECKOUT_INVALID_STATUS bookingId=${bookingId} learnerId=${learnerId} status=${booking.status}`,
      );
      throw new BadRequestException('Booking is not pending');
    }

    if (booking.expires_at && booking.expires_at <= new Date()) {
      this.logger.warn(
        `PAYMENT_CHECKOUT_BOOKING_EXPIRED bookingId=${bookingId} learnerId=${learnerId}`,
      );
      throw new BadRequestException('Booking expired');
    }

    if (booking.session.start_time <= new Date()) {
      this.logger.warn(
        `PAYMENT_CHECKOUT_SESSION_IN_PAST bookingId=${bookingId} learnerId=${learnerId} sessionId=${booking.session.id}`,
      );
      throw new BadRequestException(
        'Session already started or is in the past',
      );
    }

const lessonPriceEuros = Number(booking.session.price);

if (!Number.isFinite(lessonPriceEuros) || lessonPriceEuros <= 0) {
  throw new BadRequestException('Invalid session price');
}

/*
  PLATFORM FEES

  Example:
  lesson = €40
  platform fee = 10%
  stripe estimate ≈ 3%

  learner pays:
  40 + 4 + 1.20 = €45.20

  teacher later receives:
  €40
*/

const lessonAmount = Math.round(lessonPriceEuros * 100);

const platformFeeAmount = 300;

const estimatedStripeFeeAmount =
  Math.round((lessonAmount + platformFeeAmount) * 0.015) + 25;

const totalAmount =
  lessonAmount +
  platformFeeAmount +
  estimatedStripeFeeAmount;

const currency = process.env.PAYMENTS_CURRENCY ?? 'eur';

    const successUrl = process.env.CHECKOUT_SUCCESS_URL;
    const cancelUrl = process.env.CHECKOUT_CANCEL_URL;

    if (!successUrl || !cancelUrl) {
      this.logger.error(
        `PAYMENT_CHECKOUT_MISSING_URLS bookingId=${bookingId} learnerId=${learnerId}`,
      );
      throw new BadRequestException(
        'Missing CHECKOUT_SUCCESS_URL or CHECKOUT_CANCEL_URL',
      );
    }

    const stripeCustomerId = await this.getOrCreateStripeCustomerForLearner(
      learnerId,
    );

    if (booking.stripe_checkout_session_id) {
      const existing = await this.stripe.checkout.sessions.retrieve(
        booking.stripe_checkout_session_id,
      );

      if (existing.status === 'open' && existing.url) {
        this.logger.log(
          `PAYMENT_CHECKOUT_REUSED bookingId=${bookingId} learnerId=${learnerId} checkoutSessionId=${existing.id} checkoutUrl=${existing.url}`,
        );
        return { checkoutUrl: existing.url, checkoutSessionId: existing.id };
      }

      if (existing.status === 'complete') {
        this.logger.warn(
          `PAYMENT_CHECKOUT_ALREADY_COMPLETE bookingId=${bookingId} learnerId=${learnerId} checkoutSessionId=${existing.id}`,
        );
        throw new BadRequestException(
          'Checkout already completed for this booking',
        );
      }

      if (existing.status === 'expired') {
        this.logger.warn(
          `PAYMENT_CHECKOUT_EXPIRED_RESET bookingId=${bookingId} learnerId=${learnerId} checkoutSessionId=${existing.id}`,
        );
        booking.stripe_checkout_session_id = null;
        booking.checkout_created_at = null;
        await this.bookingRepo.save(booking);
      }
    }

    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        client_reference_id: booking.id,
      line_items: [
  {
    price_data: {
      currency,
      product_data: {
        name: booking.session.class?.title || "Lesson",
      },
      unit_amount: lessonAmount,
    },
    quantity: 1,
  },

  {
    price_data: {
      currency,
      product_data: {
        name: "Elevator platform fee",
      },
      unit_amount: platformFeeAmount,
    },
    quantity: 1,
  },

  {
    price_data: {
      currency,
      product_data: {
        name: "Payment processing fee",
      },
      unit_amount: estimatedStripeFeeAmount,
    },
    quantity: 1,
  },
],
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_intent_data: {
          metadata: { bookingId: booking.id },
          setup_future_usage: 'off_session',
        },
        metadata: { bookingId: booking.id },
      },
{
  idempotencyKey: `checkout_${booking.id}_${Date.now()}`,
},
    );

    booking.stripe_checkout_session_id = session.id;
booking.lesson_amount = lessonAmount;

booking.platform_fee_amount = platformFeeAmount;

booking.stripe_fee_amount = estimatedStripeFeeAmount;

booking.total_amount = totalAmount;

booking.teacher_payout_amount = lessonAmount;

booking.amount = totalAmount;

booking.currency = currency;
    booking.checkout_created_at = new Date();

    await this.bookingRepo.save(booking);

    this.logger.log(
      `PAYMENT_CHECKOUT_CREATE_SUCCESS bookingId=${bookingId} learnerId=${learnerId} checkoutSessionId=${session.id} checkoutUrl=${session.url} stripeCustomerId=${stripeCustomerId}`,
    );

    return { checkoutUrl: session.url, checkoutSessionId: session.id };
  }

async syncCheckoutStatus(bookingId: string, learnerId: string) {
  this.logger.log(
    `PAYMENT_CHECKOUT_SYNC_ATTEMPT bookingId=${bookingId} learnerId=${learnerId}`,
  );

  const booking = await this.bookingRepo.findOne({
    where: { id: bookingId },
    relations: {
      user: true,
      session: { class: true, teacher: true },
    } as any,
  });

  if (!booking) {
    throw new NotFoundException('Booking not found');
  }

  if (booking.user.id !== learnerId) {
    throw new ForbiddenException('Not your booking');
  }

  /*
   * A confirmed booking may still be missing its charge ID or Stripe
   * availability date, especially if it was confirmed before this feature
   * was added. Try to repair those details before returning.
   */
  if (booking.status === BookingStatus.CONFIRMED) {
    if (
      booking.stripe_payment_intent_id &&
      (!booking.stripe_charge_id ||
        !booking.stripe_funds_available_at)
    ) {
      try {
        const paymentDetails = await this.getStripePaymentDetails(
          booking.stripe_payment_intent_id,
        );

        booking.stripe_charge_id = paymentDetails.stripeChargeId;
        booking.stripe_fee_amount = paymentDetails.stripeFeeAmount;
        booking.stripe_funds_available_at =
          paymentDetails.stripeFundsAvailableAt;

        await this.bookingRepo.save(booking);

        this.logger.log(
          `STRIPE_PAYMENT_DETAILS_REPAIRED ` +
            `bookingId=${booking.id} ` +
            `chargeId=${paymentDetails.stripeChargeId} ` +
            `fundsAvailableAt=${
              paymentDetails.stripeFundsAvailableAt?.toISOString() ??
              'unknown'
            }`,
        );
      } catch (error: any) {
        this.logger.warn(
          `FAILED_TO_REPAIR_STRIPE_PAYMENT_DETAILS ` +
            `bookingId=${booking.id} ` +
            `message=${error?.message ?? 'unknown'}`,
        );
      }
    }

    return {
      status: booking.status,
      bookingId: booking.id,
      message: 'Booking already confirmed.',
      stripeChargeId: booking.stripe_charge_id ?? null,
      stripeFundsAvailableAt:
        booking.stripe_funds_available_at?.toISOString?.() ?? null,
    };
  }

  if (!booking.stripe_checkout_session_id) {
    return {
      status: booking.status,
      bookingId: booking.id,
      message: 'No Stripe checkout session found for this booking.',
    };
  }

  const checkoutSession =
    await this.stripe.checkout.sessions.retrieve(
      booking.stripe_checkout_session_id,
    );

  this.logger.log(
    `PAYMENT_CHECKOUT_SYNC_STRIPE_STATUS ` +
      `bookingId=${booking.id} ` +
      `checkoutSessionId=${checkoutSession.id} ` +
      `stripeStatus=${checkoutSession.status} ` +
      `paymentStatus=${checkoutSession.payment_status}`,
  );

  if (
    checkoutSession.status === 'complete' &&
    checkoutSession.payment_status === 'paid'
  ) {
    const confirmedBooking =
      await this.bookingsService.markBookingConfirmed({
        bookingId: booking.id,
        stripePaymentIntentId: String(
          checkoutSession.payment_intent ?? '',
        ),
        stripeCheckoutSessionId: checkoutSession.id,
        paidAt: new Date(),
      });

    if (confirmedBooking.stripe_payment_intent_id) {
      try {
        const paymentDetails = await this.getStripePaymentDetails(
          confirmedBooking.stripe_payment_intent_id,
        );

        confirmedBooking.stripe_charge_id =
          paymentDetails.stripeChargeId;

        confirmedBooking.stripe_fee_amount =
          paymentDetails.stripeFeeAmount;

        confirmedBooking.stripe_funds_available_at =
          paymentDetails.stripeFundsAvailableAt;

        await this.bookingRepo.save(confirmedBooking);

        this.logger.log(
          `STRIPE_PAYMENT_DETAILS_SYNCED ` +
            `bookingId=${confirmedBooking.id} ` +
            `chargeId=${paymentDetails.stripeChargeId} ` +
            `fundsAvailableAt=${
              paymentDetails.stripeFundsAvailableAt?.toISOString() ??
              'unknown'
            }`,
        );
      } catch (error: any) {
        this.logger.warn(
          `FAILED_TO_SYNC_STRIPE_PAYMENT_DETAILS ` +
            `bookingId=${confirmedBooking.id} ` +
            `message=${error?.message ?? 'unknown'}`,
        );
      }
    }

    return {
      status: BookingStatus.CONFIRMED,
      bookingId: booking.id,
      message: 'Payment confirmed.',
      stripeChargeId:
        confirmedBooking.stripe_charge_id ?? null,
      stripeFundsAvailableAt:
        confirmedBooking.stripe_funds_available_at
          ?.toISOString?.() ?? null,
    };
  }

  return {
    status: booking.status,
    bookingId: booking.id,
    stripeStatus: checkoutSession.status,
    paymentStatus: checkoutSession.payment_status,
    message: 'Payment has not been confirmed by Stripe yet.',
  };
}

private async getStripePaymentDetails(paymentIntentId: string) {
  const paymentIntent = await this.stripe.paymentIntents.retrieve(
    paymentIntentId,
    {
      expand: ['latest_charge.balance_transaction'],
    },
  );

  const latestCharge =
    paymentIntent.latest_charge as Stripe.Charge | null;

  if (!latestCharge?.id) {
    throw new Error(
      `No Stripe charge found for PaymentIntent ${paymentIntentId}`,
    );
  }

  const balanceTransaction =
    latestCharge.balance_transaction as
      | Stripe.BalanceTransaction
      | null;

  if (!balanceTransaction) {
    throw new Error(
      `No balance transaction found for charge ${latestCharge.id}`,
    );
  }

  return {
    stripeChargeId: latestCharge.id,

    stripeFeeAmount: balanceTransaction.fee,

    stripeNetAmount: balanceTransaction.net,

    stripeFundsAvailableAt: balanceTransaction.available_on
      ? new Date(balanceTransaction.available_on * 1000)
      : null,
  };
}


  async listSavedPaymentMethods(learnerId: string) {
    const stripeCustomerId = await this.getOrCreateStripeCustomerForLearner(
      learnerId,
    );

    const methods = await this.stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card',
    });

    return {
      customerId: stripeCustomerId,
      paymentMethods: methods.data.map((method) => ({
        id: method.id,
        brand: method.card?.brand ?? null,
        last4: method.card?.last4 ?? null,
        exp_month: method.card?.exp_month ?? null,
        exp_year: method.card?.exp_year ?? null,
        country: method.card?.country ?? null,
      })),
    };
  }

  private async getOrCreateStripeCustomerForLearner(
    learnerId: string,
  ): Promise<string> {
    const user = await this.userRepo.findOne({
      where: { id: learnerId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.stripe_customer_id) {
      return user.stripe_customer_id;
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.first_name?.trim() || undefined,
      metadata: {
        userId: user.id,
      },
    });

    user.stripe_customer_id = customer.id;
    await this.userRepo.save(user);

    this.logger.log(
      `PAYMENT_CUSTOMER_CREATED learnerId=${learnerId} stripeCustomerId=${customer.id}`,
    );

    return customer.id;
  }

  async createRefundForBooking(
    bookingId: string,
    options?: { retryAttempt?: number },
  ) {
    const retryAttempt = options?.retryAttempt ?? 0;

    this.logger.log(
      `PAYMENT_REFUND_CREATE_ATTEMPT bookingId=${bookingId} retryAttempt=${retryAttempt}`,
    );

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!booking) {
      this.logger.warn(
        `PAYMENT_REFUND_BOOKING_NOT_FOUND bookingId=${bookingId}`,
      );
      throw new NotFoundException('Booking not found');
    }

    if (
booking.status !== BookingStatus.CANCELLED_BY_LEARNER &&
booking.status !== BookingStatus.CANCELLED_BY_TEACHER &&
booking.status !== BookingStatus.TEACHER_NO_SHOW &&
booking.status !== BookingStatus.REFUND_FAILED &&
booking.status !== BookingStatus.REFUND_PENDING
    ) {
      this.logger.warn(
        `PAYMENT_REFUND_INVALID_STATUS bookingId=${bookingId} status=${booking.status}`,
      );
      throw new BadRequestException(
        'Only cancelled, refund-failed, or refund-pending bookings can be refunded',
      );
    }

    if (!booking.stripe_payment_intent_id) {
      this.logger.warn(
        `PAYMENT_REFUND_MISSING_PAYMENT_INTENT bookingId=${bookingId}`,
      );
      throw new BadRequestException(
        'No successful payment found for this booking',
      );
    }

    if (booking.stripe_refund_id) {
      const existingById = await this.stripe.refunds.retrieve(
        booking.stripe_refund_id,
      );

      if (
        existingById.status === 'pending' ||
        existingById.status === 'succeeded'
      ) {
        this.logger.log(
          `PAYMENT_REFUND_ALREADY_LINKED_ACTIVE bookingId=${bookingId} refundId=${existingById.id} status=${existingById.status}`,
        );
        return existingById;
      }

      this.logger.warn(
        `PAYMENT_REFUND_LINKED_REFUND_NOT_ACTIVE bookingId=${bookingId} refundId=${existingById.id} status=${existingById.status}`,
      );
    }

    const existingRefunds = await this.stripe.refunds.list({
      payment_intent: booking.stripe_payment_intent_id,
      limit: 10,
    });

    const activeMatchingRefund = existingRefunds.data.find(
      (refund) =>
        refund.metadata?.bookingId === booking.id &&
        (refund.status === 'pending' || refund.status === 'succeeded'),
    );

    if (activeMatchingRefund) {
      this.logger.log(
        `PAYMENT_REFUND_ALREADY_EXISTS bookingId=${bookingId} refundId=${activeMatchingRefund.id} status=${activeMatchingRefund.status}`,
      );
      return activeMatchingRefund;
    }

    const refund = await this.stripe.refunds.create(
      {
        payment_intent: booking.stripe_payment_intent_id,
        metadata: {
          bookingId: booking.id,
        },
        reason: 'requested_by_customer',
      },
      {
        idempotencyKey: `refund_${booking.id}_attempt_${retryAttempt}`,
      },
    );

    this.logger.log(
      `PAYMENT_REFUND_CREATE_SUCCESS bookingId=${bookingId} refundId=${refund.id} status=${refund.status} retryAttempt=${retryAttempt}`,
    );

    return refund;
  }

  async retryRefundForBooking(bookingId: string) {
    this.logger.log(`PAYMENT_REFUND_RETRY_ATTEMPT bookingId=${bookingId}`);

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { class: true, teacher: true },
      } as any,
    });

    if (!booking) {
      this.logger.warn(
        `PAYMENT_REFUND_RETRY_BOOKING_NOT_FOUND bookingId=${bookingId}`,
      );
      throw new NotFoundException('Booking not found');
    }

    if (booking.status !== BookingStatus.REFUND_FAILED) {
      this.logger.warn(
        `PAYMENT_REFUND_RETRY_INVALID_STATUS bookingId=${bookingId} status=${booking.status}`,
      );
      throw new BadRequestException('Booking is not in refund failed state');
    }

    if ((booking.refund_retry_count ?? 0) >= this.MAX_REFUND_RETRY_COUNT) {
      this.logger.warn(
        `PAYMENT_REFUND_RETRY_MAX_REACHED bookingId=${bookingId} refundRetryCount=${booking.refund_retry_count}`,
      );
      throw new BadRequestException('Max refund retry count reached');
    }

    try {
      await this.bookingsService.markBookingRefundPending(bookingId, {
        sendEmail: false,
      });

      const refund = await this.createRefundForBooking(bookingId, {
        retryAttempt: (booking.refund_retry_count ?? 0) + 1,
      });

      if (refund.status === 'succeeded') {
        await this.bookingsService.markBookingRefunded({
          bookingId,
          refundAmount: refund.amount,
          stripeRefundId: refund.id,
          refundedAt: new Date(),
        });

        this.logger.log(
          `PAYMENT_REFUND_RETRY_SUCCEEDED bookingId=${bookingId} refundId=${refund.id}`,
        );

        return refund;
      }

      if (refund.status === 'pending') {
        this.logger.log(
          `PAYMENT_REFUND_RETRY_PENDING bookingId=${bookingId} refundId=${refund.id}`,
        );
        return refund;
      }

      const nextRetryAt = this.computeNextRetryAt(
        booking.refund_retry_count ?? 0,
      );

      await this.bookingsService.markBookingRefundFailed({
        bookingId,
        stripeRefundId: refund.id,
        failureReason: refund.failure_reason ?? refund.status,
        nextRetryAt,
        incrementRetryCount: true,
      });

      this.logger.warn(
        `PAYMENT_REFUND_RETRY_RETURNED_FAILED bookingId=${bookingId} refundId=${refund.id} refundStatus=${refund.status} nextRetryAt=${nextRetryAt?.toISOString?.() ?? 'none'}`,
      );

      return refund;
    } catch (error: any) {
      const retryable = this.isRetryableRefundError(error);
      const nextRetryAt = retryable
        ? this.computeNextRetryAt(booking.refund_retry_count ?? 0)
        : null;

      await this.bookingsService.markBookingRefundFailed({
        bookingId,
        failureReason: error?.message ?? 'refund retry failed',
        nextRetryAt,
        incrementRetryCount: retryable,
      });

      this.logger.error(
        `PAYMENT_REFUND_RETRY_FAILED bookingId=${bookingId} retryable=${retryable} nextRetryAt=${nextRetryAt?.toISOString?.() ?? 'none'} message=${error?.message ?? 'unknown'}`,
        error?.stack,
      );

      throw error;
    }
  }

  @Cron('*/5 * * * *')
  async processDueRefundRetries() {
    const startedAt = Date.now();

    this.logger.log('PAYMENT_REFUND_RETRY_CRON_STARTED');

    try {
      const now = new Date();

      const dueBookings = await this.bookingRepo.find({
        where: {
          status: BookingStatus.REFUND_FAILED,
          refund_next_retry_at: LessThanOrEqual(now),
        } as any,
        take: 25,
        order: {
          refund_next_retry_at: 'ASC',
        } as any,
      });

      this.logger.log(
        `PAYMENT_REFUND_RETRY_CRON_DUE_FOUND count=${dueBookings.length}`,
      );

      for (const booking of dueBookings) {
        if ((booking.refund_retry_count ?? 0) >= this.MAX_REFUND_RETRY_COUNT) {
          this.logger.warn(
            `PAYMENT_REFUND_RETRY_SKIPPED_MAX_REACHED bookingId=${booking.id} refundRetryCount=${booking.refund_retry_count}`,
          );
          continue;
        }

        try {
          await this.retryRefundForBooking(booking.id);
        } catch (error: any) {
          this.logger.error(
            `PAYMENT_REFUND_RETRY_CRON_ITEM_FAILED bookingId=${booking.id} message=${error?.message ?? 'unknown'}`,
            error?.stack,
          );
        }
      }

      const durationMs = Date.now() - startedAt;

      this.logger.log(
        `PAYMENT_REFUND_RETRY_CRON_COMPLETED count=${dueBookings.length} durationMs=${durationMs}`,
      );
    } catch (error: any) {
      const durationMs = Date.now() - startedAt;

      this.logger.error(
        `PAYMENT_REFUND_RETRY_CRON_FAILED durationMs=${durationMs} message=${error?.message ?? 'unknown'}`,
        error?.stack,
      );

      throw error;
    }
  }

  private computeNextRetryAt(retryCount: number): Date | null {
    const delaysMs = [
      15 * 60 * 1000,
      60 * 60 * 1000,
      6 * 60 * 60 * 1000,
      24 * 60 * 60 * 1000,
    ];

    const delay = delaysMs[retryCount];
    if (!delay) return null;

    return new Date(Date.now() + delay);
  }

  private isRetryableRefundError(error: any): boolean {
    const code = error?.code;
    const type = error?.type;
    const message = String(error?.message ?? '').toLowerCase();
    const statusCode = error?.statusCode;

    if (statusCode && statusCode >= 500) return true;
    if (statusCode === 429) return true;

    if (
      code === 'rate_limit' ||
      code === 'lock_timeout' ||
      code === 'api_connection_error' ||
      code === 'api_error'
    ) {
      return true;
    }

    if (
      type === 'StripeAPIError' ||
      type === 'StripeConnectionError' ||
      type === 'StripeRateLimitError'
    ) {
      return true;
    }

    if (
      message.includes('timeout') ||
      message.includes('timed out') ||
      message.includes('network') ||
      message.includes('connection')
    ) {
      return true;
    }

    return false;
  }
}