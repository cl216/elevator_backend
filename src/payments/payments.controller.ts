import { Controller, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { RolesGuard } from 'src/auth/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-01-28.clover',
});


@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('LEARNER')
createCheckout(@CurrentUser() user: { id: string }, @Body('bookingId') bookingId: string) {
  return this.paymentsService.createCheckoutSession(bookingId, user.id);
}

@Post('webhook')
async webhook(@Req() req: Request, @Res() res: Response) {

console.log('Webhook hit!', {
  hasSig: !!req.headers['stripe-signature'],
  isBuffer: Buffer.isBuffer(req.body),
});

  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

console.log('Webhook body is buffer?', Buffer.isBuffer(req.body));


  try {
    // req.body must be Buffer here
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err: any) {
    console.log('Webhook signature verification failed.', err?.message);
    return res.status(400).send(`Webhook Error: ${err?.message}`);
  }
console.log('Event verified:', event.type);
  await this.paymentsService.handleWebhook(event);

  return res.status(200).send({ received: true });
}


}
