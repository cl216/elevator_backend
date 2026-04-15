import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { AppEmailLayout } from './components/app-email-layout';

export interface RefundPendingEmailProps {
  recipientFirstName: string;
  sessionTitle: string;
  startAt: string;
}

export function RefundPendingEmail({
  recipientFirstName,
  sessionTitle,
  startAt,
}: RefundPendingEmailProps) {
  return (
    <AppEmailLayout
      preview={`Your refund for ${sessionTitle} is being processed`}
      title="Refund in progress"
    >
      <Text>Hi {recipientFirstName},</Text>

      <Text>
        Your refund for <strong>{sessionTitle}</strong> on {startAt} is being
        processed.
      </Text>

      <Section>
        <Text>
          We’ve started the refund and will email you again when it has been
          completed.
        </Text>
      </Section>
    </AppEmailLayout>
  );
}