import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import Stripe from 'stripe';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { TeacherProfile } from './entities/teacher-profile.entity';

@Injectable()
export class TeacherStripeService {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  });

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(TeacherProfile)
    private readonly tpRepo: Repository<TeacherProfile>,
  ) {}

  /**
   * Creates (if missing) an Express connected account for this teacher (Ireland),
   * then returns a fresh Stripe onboarding link URL.
   */
  async createOrResumeOnboarding(teacherId: string) {
  const user = await this.userRepo.findOne({
    where: { id: teacherId },
    relations: { teacherProfile: true } as any,
  });

  if (!user) throw new BadRequestException('User not found');
  if (!user.teacherProfile) {
    throw new ForbiddenException('Teacher profile required');
  }

  const profile = user.teacherProfile;

  if (!profile.stripe_account_id) {
    const account = await this.stripe.accounts.create({
      type: 'express',
      country: 'IE',
      email: user.email,
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
    });

    profile.stripe_account_id = account.id;
    profile.stripe_enabled = false;
    await this.tpRepo.save(profile);
  }

  const link = await this.createAccountOnboardingLink(profile.stripe_account_id);

  console.log('STRIPE_ONBOARD_URL', link.url);
  return { url: link.url };
}

async createRefreshOnboardingLink(accountId: string) {
  if (!accountId) {
    throw new BadRequestException('Missing account id');
  }

  const link = await this.createAccountOnboardingLink(accountId);
  return link.url;
}

private async createAccountOnboardingLink(accountId: string) {
  const refreshUrlBase = process.env.STRIPE_CONNECT_REFRESH_URL;
  const returnUrl = process.env.STRIPE_CONNECT_RETURN_URL;

  if (!refreshUrlBase || !returnUrl) {
    throw new BadRequestException(
      'Missing STRIPE_CONNECT_REFRESH_URL or STRIPE_CONNECT_RETURN_URL',
    );
  }

  const separator = refreshUrlBase.includes('?') ? '&' : '?';
  const refreshUrl = `${refreshUrlBase}${separator}account=${encodeURIComponent(accountId)}`;

  return this.stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

  /**
   * Checks Stripe connected account capability status and updates stripe_enabled.
   */
  async refreshStripeStatus(teacherId: string) {
    const user = await this.userRepo.findOne({
      where: { id: teacherId },
      relations: { teacherProfile: true } as any,
    });

    if (!user) throw new BadRequestException('User not found');
    if (!user.teacherProfile) {
      throw new ForbiddenException('Teacher profile required');
    }

    const profile = user.teacherProfile;

    if (!profile.stripe_account_id) {
      return {
        stripe_enabled: false,
        stripe_account_id: null,
        charges_enabled: false,
        payouts_enabled: false,
      };
    }

    const acct = await this.stripe.accounts.retrieve(profile.stripe_account_id);

    const chargesEnabled = !!acct.charges_enabled;
    const payoutsEnabled = !!acct.payouts_enabled;
    const enabled = chargesEnabled && payoutsEnabled;

    if (enabled !== profile.stripe_enabled) {
      profile.stripe_enabled = enabled;
      await this.tpRepo.save(profile);
    }

    return {
      stripe_enabled: enabled,
      stripe_account_id: profile.stripe_account_id,
      charges_enabled: chargesEnabled,
      payouts_enabled: payoutsEnabled,
    };
  }
}