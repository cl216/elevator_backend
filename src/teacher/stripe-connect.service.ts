import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';

@Injectable()
export class StripeConnectService {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  });

  async createExpressAccountForTeacher(email: string) {
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'IE',
      email,
      capabilities: {
        transfers: { requested: true },
      },
    });

    return account.id;
  }

  async createOnboardingLink(accountId: string) {
    const refreshUrl = process.env.STRIPE_CONNECT_REFRESH_URL;
    const returnUrl = process.env.STRIPE_CONNECT_RETURN_URL;

    if (!refreshUrl || !returnUrl) {
      throw new BadRequestException(
        'Missing STRIPE_CONNECT_REFRESH_URL or STRIPE_CONNECT_RETURN_URL',
      );
    }

    const link = await this.stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return link.url;
  }

  async getTransfersCapability(accountId: string) {
    const acct = await this.stripe.accounts.retrieve(accountId);
    return acct.capabilities?.transfers; // 'active' | 'inactive' | 'pending' | undefined
  }
}
