import { Injectable } from '@nestjs/common';
import { render } from '@react-email/render';
import { DeepLinkService } from '../../common/links/deep-link.service';
import {
  BookingConfirmedEmail,
  type BookingConfirmedEmailProps,
} from '../templates/booking-confirmed.email';
import {
  BookingCancelledEmail,
  type BookingCancelledEmailProps,
} from '../templates/booking-cancelled.email';
import {
  RefundPendingEmail,
  type RefundPendingEmailProps,
} from '../templates/refund-pending.email';
import {
  RefundCompletedEmail,
  type RefundCompletedEmailProps,
} from '../templates/refund-completed.email';
import {
  SessionReminder24hEmail,
  type SessionReminder24hEmailProps,
} from '../templates/session-reminder-24h.email';

@Injectable()
export class BookingEmailBuilder {
  constructor(private readonly deepLinkService: DeepLinkService) {}

  async buildBookingConfirmed(input: {
    to: string;
    learnerFirstName: string;
    sessionTitle: string;
    teacherName: string;
    startAtLabel: string;
    locationText: string;
    bookingId: string;
  }) {
    const bookingUrl = this.deepLinkService.bookingDetailsFallback(
      input.bookingId,
    );

    const props: BookingConfirmedEmailProps = {
      learnerFirstName: input.learnerFirstName,
      sessionTitle: input.sessionTitle,
      teacherName: input.teacherName,
      startAt: input.startAtLabel,
      locationText: input.locationText,
      bookingUrl,
    };

    const html = await render(BookingConfirmedEmail(props));

    return {
      to: input.to,
      subject: `Booking confirmed: ${input.sessionTitle}`,
      html,
      text: `Your booking for ${input.sessionTitle} is confirmed.`,
      tags: [
        { name: 'type', value: 'booking-confirmed' },
        { name: 'bookingId', value: input.bookingId },
      ],
    };
  }

  async buildBookingCancelled(input: {
    to: string;
    recipientFirstName: string;
    sessionTitle: string;
    cancelledByLabel: string;
    startAtLabel: string;
    refundMessage?: string;
    bookingId: string;
  }) {
    const props: BookingCancelledEmailProps = {
      recipientFirstName: input.recipientFirstName,
      sessionTitle: input.sessionTitle,
      cancelledByLabel: input.cancelledByLabel,
      startAt: input.startAtLabel,
      refundMessage: input.refundMessage,
    };

    const html = await render(BookingCancelledEmail(props));

    return {
      to: input.to,
      subject: `Booking cancelled: ${input.sessionTitle}`,
      html,
      text: `Your booking for ${input.sessionTitle} was cancelled.`,
      tags: [
        { name: 'type', value: 'booking-cancelled' },
        { name: 'bookingId', value: input.bookingId },
      ],
    };
  }

  async buildRefundPending(input: {
    to: string;
    recipientFirstName: string;
    sessionTitle: string;
    startAtLabel: string;
    bookingId: string;
  }) {
    const props: RefundPendingEmailProps = {
      recipientFirstName: input.recipientFirstName,
      sessionTitle: input.sessionTitle,
      startAt: input.startAtLabel,
    };

    const html = await render(RefundPendingEmail(props));

    return {
      to: input.to,
      subject: `Refund in progress: ${input.sessionTitle}`,
      html,
      text: `Your refund for ${input.sessionTitle} is being processed.`,
      tags: [
        { name: 'type', value: 'refund-pending' },
        { name: 'bookingId', value: input.bookingId },
      ],
    };
  }

  async buildRefundCompleted(input: {
    to: string;
    recipientFirstName: string;
    sessionTitle: string;
    startAtLabel: string;
    bookingId: string;
    refundAmountLabel?: string;
  }) {
    const props: RefundCompletedEmailProps = {
      recipientFirstName: input.recipientFirstName,
      sessionTitle: input.sessionTitle,
      startAt: input.startAtLabel,
      refundAmountLabel: input.refundAmountLabel,
    };

    const html = await render(RefundCompletedEmail(props));

    return {
      to: input.to,
      subject: `Refund completed: ${input.sessionTitle}`,
      html,
      text: `Your refund for ${input.sessionTitle} has been completed.`,
      tags: [
        { name: 'type', value: 'refund-completed' },
        { name: 'bookingId', value: input.bookingId },
      ],
    };
  }

  async buildSessionReminder(input: {
    to: string;
    recipientFirstName: string;
    sessionTitle: string;
    teacherName: string;
    startAtLabel: string;
    locationText?: string;
    bookingId: string;
    variant: '24h' | '1h';
  }) {
    const bookingUrl = this.deepLinkService.bookingDetailsFallback(
      input.bookingId,
    );

    const props: SessionReminder24hEmailProps = {
      recipientFirstName: input.recipientFirstName,
      sessionTitle: input.sessionTitle,
      teacherName: input.teacherName,
      startAt: input.startAtLabel,
      locationText: input.locationText,
      bookingUrl,
    };

    const html = await render(SessionReminder24hEmail(props));

    const subject =
      input.variant === '24h'
        ? `Reminder: ${input.sessionTitle} starts tomorrow`
        : `Reminder: ${input.sessionTitle} starts soon`;

    const text =
      input.variant === '24h'
        ? `${input.sessionTitle} with ${input.teacherName} starts tomorrow at ${input.startAtLabel}.`
        : `${input.sessionTitle} with ${input.teacherName} starts in about 1 hour at ${input.startAtLabel}.`;

    return {
      to: input.to,
      subject,
      html,
      text,
      tags: [
        {
          name: 'type',
          value:
            input.variant === '24h'
              ? 'session-reminder-24h'
              : 'session-reminder-1h',
        },
        { name: 'bookingId', value: input.bookingId },
      ],
    };
  }
}