import * as React from 'react';
import { Section, Text } from '@react-email/components';
import { AppEmailLayout } from './components/app-email-layout';
import { EmailButton } from './components/email-button';

export interface BookingConfirmedEmailProps {
  learnerFirstName: string;
  sessionTitle: string;
  teacherName: string;
  startAt: string;
  locationText: string;
  bookingUrl: string;
}

export function BookingConfirmedEmail(props: BookingConfirmedEmailProps) {
  const {
    learnerFirstName,
    sessionTitle,
    teacherName,
    startAt,
    locationText,
    bookingUrl,
  } = props;

  return (
    <AppEmailLayout
      preview={`Your booking for ${sessionTitle} is confirmed`}
      title="Booking confirmed"
    >
      <Text>Hi {learnerFirstName},</Text>
      <Text>Your booking is confirmed.</Text>

      <Section>
        <Text>
          <strong>Session:</strong> {sessionTitle}
        </Text>
        <Text>
          <strong>Teacher:</strong> {teacherName}
        </Text>
        <Text>
          <strong>When:</strong> {startAt}
        </Text>
        <Text>
          <strong>Location:</strong> {locationText}
        </Text>
      </Section>

      {/* <Section style={{ marginTop: '24px', marginBottom: '24px' }}>
        <EmailButton href={bookingUrl}>View booking</EmailButton>
      </Section> */}

      <Text>Thanks for booking with Elevator.</Text>
    </AppEmailLayout>
  );
}