import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

export type SessionReminder24hEmailProps = {
  recipientFirstName: string;
  sessionTitle: string;
  teacherName: string;
  startAt: string;
  locationText?: string;
  bookingUrl: string;
};

export function SessionReminder24hEmail(
  props: SessionReminder24hEmailProps,
) {
  const {
    recipientFirstName,
    sessionTitle,
    teacherName,
    startAt,
    locationText,
    bookingUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Preview>Your session starts in about 24 hours</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Your session is tomorrow</Heading>

          <Text style={text}>Hi {recipientFirstName},</Text>

          <Text style={text}>
            Just a reminder that <strong>{sessionTitle}</strong> with{' '}
            <strong>{teacherName}</strong> starts in about 24 hours.
          </Text>

          <Section style={card}>
            <Text style={label}>Session</Text>
            <Text style={value}>{sessionTitle}</Text>

            <Text style={label}>Starts</Text>
            <Text style={value}>{startAt}</Text>

            {locationText ? (
              <>
                <Text style={label}>Location</Text>
                <Text style={value}>{locationText}</Text>
              </>
            ) : null}
          </Section>

          <Section style={{ textAlign: 'center', marginTop: '24px' }}>
            <Button style={button} href={bookingUrl}>
              View booking
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            Thanks for using the app. We hope you enjoy your session.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default SessionReminder24hEmail;

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  padding: '32px',
};

const heading = {
  fontSize: '28px',
  lineHeight: '1.3',
  margin: '0 0 20px',
};

const text = {
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const card = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '20px',
  marginTop: '20px',
};

const label = {
  fontSize: '12px',
  color: '#64748b',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  margin: '0 0 4px',
};

const value = {
  fontSize: '16px',
  color: '#0f172a',
  margin: '0 0 12px',
};

const button = {
  backgroundColor: '#111827',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '28px 0',
};

const footer = {
  fontSize: '13px',
  color: '#6b7280',
};