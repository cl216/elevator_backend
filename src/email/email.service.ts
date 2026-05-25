import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { SendEmailOptions } from './email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');

    this.enabled =
      this.configService.get<string>('EMAIL_NOTIFICATIONS_ENABLED') === 'true' &&
      !!apiKey;

    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.enabled || !this.resend) {
      this.logger.log(
        `Email notifications disabled. Skipped "${options.subject}" to ${[]
          .concat(options.to as any)
          .join(', ')}`,
      );
      return;
    }

    const { error } = await this.resend.emails.send({
from:
  this.configService.get<string>('EMAIL_FROM') ??
  'Elevator <noreply@elevatorapp.org>',      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
      tags: options.tags,
    });

    if (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      throw new Error(error.message);
    }
  }
}