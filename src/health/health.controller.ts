import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async getHealth() {
    try {
      await this.dataSource.query('SELECT 1');

      return {
        ok: true,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          stripeSecretKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
          stripeWebhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        ok: false,
        timestamp: new Date().toISOString(),
        checks: {
          database: 'failed',
          stripeSecretKeyConfigured: !!process.env.STRIPE_SECRET_KEY,
          stripeWebhookSecretConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
        },
      });
    }
  }
}
