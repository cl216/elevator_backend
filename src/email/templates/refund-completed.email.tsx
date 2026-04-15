import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { AppEmailLayout } from './components/app-email-layout';

export interface RefundCompletedEmailProps {
  recipientFirstName: string;
  sessionTitle: string;
  startAt: string;
  refundAmountLabel?: string;
}

export function RefundCompletedEmail({
  recipientFirstName,
  sessionTitle,
  startAt,
  refundAmountLabel,
}: RefundCompletedEmailProps) {
  return (
    <AppEmailLayout
      preview={`Your refund for ${sessionTitle} has been completed`}
      title="Refund completed"
    >
      <Text>Hi {recipientFirstName},</Text>

      <Text>
        Your refund for <strong>{sessionTitle}</strong> on {startAt} has been
        completed.
      </Text>

      {refundAmountLabel ? (
        <Section>
          <Text>
            <strong>Refund amount:</strong> {refundAmountLabel}
          </Text>
        </Section>
      ) : null}

      <Text>
        Depending on your bank, it may take a little time to appear on your
        statement.
      </Text>
    </AppEmailLayout>
  );
}