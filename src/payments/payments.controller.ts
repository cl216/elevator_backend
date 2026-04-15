import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Logger,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import type { Request, Response } from 'express';
import Stripe from 'stripe';
import { JwtAuthGuard } from 'src/auth/jwt.guard';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  createCheckout(
    @CurrentUser() user: { id: string },
    @Body('bookingId') bookingId: string,
  ) {
    this.logger.log(
      `PAYMENT_CHECKOUT_CONTROLLER_ATTEMPT userId=${user.id} bookingId=${bookingId}`,
    );

    if (!bookingId) {
      this.logger.warn(
        `PAYMENT_CHECKOUT_CONTROLLER_MISSING_BOOKING_ID userId=${user.id}`,
      );
      throw new BadRequestException('bookingId is required');
    }

    return this.paymentsService.createCheckoutSession(bookingId, user.id);
  }

  @Get('methods')
  @UseGuards(JwtAuthGuard)
  getSavedPaymentMethods(@CurrentUser() user: { id: string }) {
    return this.paymentsService.listSavedPaymentMethods(user.id);
  }

  @Post('webhook')
  async webhook(@Req() req: Request, @Res() res: Response) {
    const sig = req.headers['stripe-signature'] as string | undefined;

    this.logger.log(
      `STRIPE_WEBHOOK_CONTROLLER_RECEIVED hasSignature=${!!sig} isBuffer=${Buffer.isBuffer(req.body)}`,
    );

    if (!sig) {
      this.logger.warn('STRIPE_WEBHOOK_CONTROLLER_MISSING_SIGNATURE');
      return res.status(400).send('Missing stripe-signature header');
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!,
      );
    } catch (err: any) {
      this.logger.warn(
        `STRIPE_WEBHOOK_SIGNATURE_VERIFICATION_FAILED message=${err?.message ?? 'unknown'}`,
      );
      return res.status(400).send(`Webhook Error: ${err?.message}`);
    }

    this.logger.log(
      `STRIPE_WEBHOOK_CONTROLLER_VERIFIED eventId=${event.id} eventType=${event.type}`,
    );

    try {
      await this.paymentsService.handleWebhook(event);

      this.logger.log(
        `STRIPE_WEBHOOK_CONTROLLER_PROCESSED eventId=${event.id} eventType=${event.type}`,
      );

      return res.status(200).send({ received: true });
    } catch (err: any) {
      this.logger.error(
        `STRIPE_WEBHOOK_CONTROLLER_PROCESSING_FAILED eventId=${event.id} eventType=${event.type} message=${err?.message ?? 'unknown'}`,
        err?.stack,
      );

      return res.status(500).send('Webhook processing failed');
    }
  }
}