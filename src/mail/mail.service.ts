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

async sendPasswordResetEmail(to: string, code: string) {
  const { error } = await this.resend.emails.send({
    from: this.fromEmail,
    to,
    subject: 'Your Elevator password reset code',
    html: `
      <div>
        <h2>Reset your password</h2>
        <p>Use this code in the Elevator app to reset your password:</p>

        <p style="font-size: 28px; font-weight: bold; letter-spacing: 4px;">
          ${code}
        </p>

        <p>This code expires in 15 minutes.</p>
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