import { Controller, Post, Body, Req, Res } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import stripe from 'stripe';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  async checkout(@Body() body: { bookingId: string; amount: number }, @Res() res: Response) {
    const session = await this.paymentsService.createCheckoutSession(
      body.bookingId,
      body.amount,
      'https://your-app.com/success',
      'https://your-app.com/cancel',
    );

    return res.json({ url: session.url });
  }

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    console.log('Webhook hit!', req.headers, req.body);

    const sig = req.headers['stripe-signature']!;
    let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    console.log('Event verified:', event.type);
  } catch (err) {
    console.log('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  await this.paymentsService.handleWebhook(event);
  res.status(200).send();
}
}
