import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Booking } from '../bookings/entities/booking.entity';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
  ) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
    });
  }

  // Create Stripe checkout session
  async createCheckoutSession(
    bookingId: string,
    amount: number,
    successUrl: string,
    cancelUrl: string,
  ): Promise<Stripe.Checkout.Session> {
    return await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Booking ${bookingId}` },
            unit_amount: amount, // in cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { bookingId },
    });
  }

  // Handle webhook event
  async handleWebhook(event: Stripe.Event) {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

          if (!session.metadata || !session.metadata.bookingId) {
      console.warn('Webhook session.metadata.bookingId is missing', session);
      return; // stop processing
    }
    
      const bookingId = session.metadata.bookingId;

      const booking = await this.bookingRepo.findOne({ where: { id: bookingId } });
      if (booking && booking.status !== 'CONFIRMED') {
        booking.status = 'CONFIRMED';
        await this.bookingRepo.save(booking);
      }
    }
  }
}
