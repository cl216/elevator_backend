import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { EMAIL_FROM } from './email.constants';
import { SendEmailOptions } from './email.types';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.enabled = !!apiKey;
    this.resend = new Resend(apiKey);
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.enabled) {
      this.logger.warn(
        `Email disabled. Would have sent "${options.subject}" to ${[].concat(options.to as any).join(', ')}`
      );
      return;
    }

    const { error } = await this.resend.emails.send({
      from: EMAIL_FROM,
      to: options.to,
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