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
      // ✅ Use a real Stripe API version (pick one and pin it)
      apiVersion: '2026-01-28.clover',
    });
  }

  /**
   * Webhook handler (called by controller after signature verification)
   */
  async handleWebhook(event: Stripe.Event) {
    if (event.type !== 'checkout.session.completed') return;

    const session = event.data.object as Stripe.Checkout.Session;
    const checkoutSessionId = session.id;

    // ✅ Preferred: locate booking by stored checkout session id
    let booking = await this.bookingRepo.findOne({
      where: { stripe_checkout_session_id: checkoutSessionId },
    });

    // ✅ Fallback: client_reference_id first, then metadata.bookingId
    if (!booking) {
      const bookingId =
        session.client_reference_id ?? session.metadata?.bookingId;

      if (!bookingId) {
        this.logger.warn(
          'checkout.session.completed missing client_reference_id and metadata.bookingId',
        );
        return;
      }

      booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
      if (!booking) {
        this.logger.warn(`No booking found for bookingId=${bookingId}`);
        return;
      }

      // Attach checkout session id for future lookups
      booking.stripe_checkout_session_id = checkoutSessionId;
    }

    // ✅ Idempotency: only confirm if still pending
    if (booking.status !== 'PENDING') return;

    booking.stripe_payment_intent_id = String(session.payment_intent ?? '');
    booking.paid_at = new Date();
    booking.status = 'CONFIRMED';

    await this.bookingRepo.save(booking);
  }

  /**
   * Create Stripe Checkout Session for a booking (server-driven, idempotent)
   */
  async createCheckoutSession(bookingId: string, learnerId: string) {
    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: {
        user: true,
        session: { teacher: { teacherProfile: true } },
      } as any,
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.user.id !== learnerId)
      throw new ForbiddenException('Not your booking');

    // Must be pending to pay
    if (booking.status !== 'PENDING') {
      throw new BadRequestException('Booking is not pending');
    }

    // Expiry check
    if (booking.expires_at && booking.expires_at <= new Date()) {
      throw new BadRequestException('Booking expired');
    }

    // Session must be in the future
    if (booking.session.start_time <= new Date()) {
      throw new BadRequestException('Session already started or is in the past');
    }

    const amount = booking.session.price;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Invalid session price');
    }

    const currency = process.env.PAYMENTS_CURRENCY ?? 'eur';

    const destinationAccountId =
      booking.session.teacher.teacherProfile?.stripe_account_id;
    if (!destinationAccountId) {
      throw new BadRequestException('Teacher is not set up for payments');
    }

    const successUrl = process.env.CHECKOUT_SUCCESS_URL;
    const cancelUrl = process.env.CHECKOUT_CANCEL_URL;
    if (!successUrl || !cancelUrl) {
      throw new BadRequestException(
        'Missing CHECKOUT_SUCCESS_URL or CHECKOUT_CANCEL_URL',
      );
    }

    const applicationFeeAmount = Math.round(amount * 0.1);

    // ✅ Idempotency: if we already created a checkout session, return it if still usable
    if (booking.stripe_checkout_session_id) {
      const existing = await this.stripe.checkout.sessions.retrieve(
        booking.stripe_checkout_session_id,
      );

      // Stripe session statuses: 'open' | 'complete' | 'expired'
      if (existing.status === 'open' && existing.url) {
        return { checkoutUrl: existing.url, checkoutSessionId: existing.id };
      }

      if (existing.status === 'complete') {
        // Payment completed. Webhook should confirm booking; treat as non-payable here.
        throw new BadRequestException(
          'Checkout already completed for this booking',
        );
      }

      if (existing.status === 'expired') {
        // Allow a new checkout by clearing stored values
        booking.stripe_checkout_session_id = null;
        booking.checkout_created_at = null;
        await this.bookingRepo.save(booking);
      }
    }

    // ✅ Create session with Stripe idempotency key + stable booking reference
    const session = await this.stripe.checkout.sessions.create(
      {
        mode: 'payment',
        payment_method_types: ['card'],

        // Stable reference returned in webhook payload
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
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: destinationAccountId,
          },
          metadata: {
            bookingId: booking.id,
          },
        },

        metadata: { bookingId: booking.id },
      },
      {
        // If the client retries, Stripe will return the same session instead of creating duplicates
        idempotencyKey: `checkout_${booking.id}`,
      },
    );

    booking.stripe_checkout_session_id = session.id;
    booking.amount = amount;
    booking.currency = currency;
    booking.checkout_created_at = new Date();

    await this.bookingRepo.save(booking);

    return { checkoutUrl: session.url, checkoutSessionId: session.id };
  }
}