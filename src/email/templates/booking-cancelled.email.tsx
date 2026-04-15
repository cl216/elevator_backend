import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { AppEmailLayout } from './components/app-email-layout';

export interface BookingCancelledEmailProps {
  recipientFirstName: string;
  sessionTitle: string;
  cancelledByLabel: string;
  startAt: string;
  refundMessage?: string;
}

export function BookingCancelledEmail(props: BookingCancelledEmailProps) {
  const {
    recipientFirstName,
    sessionTitle,
    cancelledByLabel,
    startAt,
    refundMessage,
  } = props;

  return (
    <AppEmailLayout
      preview={`Your booking for ${sessionTitle} was cancelled`}
      title="Booking cancelled"
    >
      <Text>Hi {recipientFirstName},</Text>
      <Text>
        The booking for <strong>{sessionTitle}</strong> on {startAt} was
        cancelled by {cancelledByLabel}.
      </Text>

      {refundMessage ? (
        <Section>
          <Text>{refundMessage}</Text>
        </Section>
      ) : null}
    </AppEmailLayout>
  );
}