import * as React from 'react';
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface AppEmailLayoutProps {
  preview: string;
  title?: string;
  children: React.ReactNode;
}

export function AppEmailLayout({
  preview,
  title,
  children,
}: AppEmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={card}>
            <Text style={brand}>Elevator</Text>
            {title ? <Text style={titleStyle}>{title}</Text> : null}
            {children}
            <Text style={footer}>
              You’re receiving this transactional email because of activity on your Elevator account.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: 'Arial, sans-serif',
  padding: '24px 0',
};

const container = {
  maxWidth: '600px',
  margin: '0 auto',
};

const card = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '32px',
  border: '1px solid #e6ebf1',
};

const brand = {
  fontSize: '20px',
  fontWeight: '700',
  marginBottom: '16px',
};

const titleStyle = {
  fontSize: '24px',
  fontWeight: '700',
  marginBottom: '16px',
};

const footer = {
  fontSize: '12px',
  color: '#667085',
  marginTop: '32px',
};