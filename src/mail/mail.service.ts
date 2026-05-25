import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend = new Resend(process.env.RESEND_API_KEY);

  private get fromEmail() {
    const from = process.env.MAIL_FROM;
    if (!from) {
      throw new InternalServerErrorException('MAIL_FROM is not configured');
    }
    return from;
  }

  async sendVerificationEmail(to: string, token: string) {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
      throw new InternalServerErrorException('APP_BASE_URL is not configured');
    }

const verifyUrl = `elevator://verify-email?token=${encodeURIComponent(token)}`;  const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Verify your Elevator account',
      html: `
        <div>
          <h2>Verify your email</h2>
          <p>Welcome to Elevator. Please verify your email to activate your account.</p>
          <p><a href="${verifyUrl}">Verify email</a></p>
          <p>If you did not create this account, you can ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(
        `MAIL_VERIFY_SEND_FAILED to=${to} from=${this.fromEmail} error=${JSON.stringify(error)}`
      );
      throw new InternalServerErrorException(
        `Failed to send verification email: ${error.message ?? 'unknown mail error'}`
      );
    }

    this.logger.log(`MAIL_VERIFY_SENT to=${to}`);
  }

  async sendPasswordResetEmail(to: string, token: string) {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
      throw new InternalServerErrorException('APP_BASE_URL is not configured');
    }

const resetUrl = `elevator://reset-password?token=${encodeURIComponent(token)}`;
    const { error } = await this.resend.emails.send({
      from: this.fromEmail,
      to,
      subject: 'Reset your Elevator password',
      html: `
        <div>
          <h2>Reset your password</h2>
          <p>Click the link below to reset your password.</p>
          <p>  <a href="${resetUrl}">Reset password</a></p>
          <p>This link should expire in 30 minutes.</p>
          <p>If the button does not work, copy and paste this link into your phone browser:</p>
<p>${resetUrl}</p>
          <p>If you did not request this, you can ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      this.logger.error(
        `MAIL_RESET_SEND_FAILED to=${to} from=${this.fromEmail} error=${JSON.stringify(error)}`
      );
      throw new InternalServerErrorException(
        `Failed to send password reset email: ${error.message ?? 'unknown mail error'}`
      );
    }

    this.logger.log(`MAIL_RESET_SENT to=${to}`);
  }
}