import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class PaymentsService {
  private readonly stripe: Stripe;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }

  /**
   * Webhook handler (called by controller after signature verification)
   */
  async handleWebhook(event: Stripe.Event) {
    this.logger.log(
      `STRIPE_WEBHOOK_RECEIVED eventId=${event.id} eventType=${event.type}`,
    );

    if (event.type !== 'checkout.session.completed') {
      this.logger.log(
        `STRIPE_WEBHOOK_IGNORED eventId=${event.id} eventType=${event.type}`,
      );
      return;
    }

    const session = event.data.object;
    const checkoutSessionId = session.id;

    this.logger.log(
      `STRIPE_WEBHOOK_PROCESSING_CHECKOUT_COMPLETED eventId=${event.id} checkoutSessionId=${checkoutSessionId}`,
    );

    // Preferred: locate booking by stored checkout session id
    let booking = await this.bookingRepo.findOne({
      where: { stripe_checkout_session_id: checkoutSessionId },
    });

    // Fallback: client_reference_id first, then metadata.bookingId
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

      booking = await this.bookingRepo.findOne({ where: { id: bookingId } });

      if (!booking) {
        this.logger.warn(
          `STRIPE_WEBHOOK_BOOKING_NOT_FOUND eventId=${event.id} bookingId=${bookingId}`,
        );
        return;
      }

      // Attach checkout session id for future lookups
      booking.stripe_checkout_session_id = checkoutSessionId;
    }

    // Idempotency: only confirm if still pending
    if (booking.status !== 'PENDING') {
      this.logger.log(
        `STRIPE_WEBHOOK_ALREADY_PROCESSED eventId=${event.id} bookingId=${booking.id} status=${booking.status}`,
      );
      return;
    }

    booking.stripe_payment_intent_id = String(session.payment_intent ?? '');
    booking.paid_at = new Date();
    booking.status = 'CONFIRMED';

    await this.bookingRepo.save(booking);

    this.logger.log(
      `STRIPE_WEBHOOK_BOOKING_CONFIRMED eventId=${event.id} bookingId=${booking.id} checkoutSessionId=${checkoutSessionId}`,
    );
  }

  /**
   * Create Stripe Checkout Session for a booking (server-driven, idempotent)
   */
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

    if (booking.status !== 'PENDING') {
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

    const priceEuros = booking.session.price;

    if (!Number.isFinite(priceEuros) || priceEuros <= 0) {
      throw new BadRequestException('Invalid session price');
    }

    const amount = Math.round(priceEuros * 100);

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

    // Idempotency: if we already created a checkout session, return it if still usable
    if (booking.stripe_checkout_session_id) {
      const existing = await this.stripe.checkout.sessions.retrieve(
        booking.stripe_checkout_session_id,
      );

      if (existing.status === 'open' && existing.url) {
        this.logger.log(
          `PAYMENT_CHECKOUT_REUSED bookingId=${bookingId} learnerId=${learnerId} checkoutSessionId=${existing.id}`,
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
        payment_method_types: ['card'],
        client_reference_id: booking.id,
        line_items: [
          {
            price_data: {
              currency,
              product_data: { name: `Booking ${booking.id}` },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        payment_intent_data: {
          metadata: { bookingId: booking.id },
        },
        metadata: { bookingId: booking.id },
      },
      {
        idempotencyKey: `checkout_${booking.id}`,
      },
    );

    booking.stripe_checkout_session_id = session.id;
    booking.amount = amount;
    booking.currency = currency;
    booking.checkout_created_at = new Date();

    await this.bookingRepo.save(booking);

    this.logger.log(
      `PAYMENT_CHECKOUT_CREATE_SUCCESS bookingId=${bookingId} learnerId=${learnerId} checkoutSessionId=${session.id}`,
    );

    return { checkoutUrl: session.url, checkoutSessionId: session.id };
  }
}
