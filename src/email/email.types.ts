export type EmailTemplateName =
  | 'booking-confirmed'
  | 'booking-cancelled';

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}