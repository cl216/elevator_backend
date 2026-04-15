import * as React from 'react';
import { Button } from '@react-email/components';

export function EmailButton({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: '#111827',
        color: '#ffffff',
        padding: '12px 20px',
        borderRadius: '8px',
        textDecoration: 'none',
        display: 'inline-block',
        fontWeight: '600',
      }}
    >
      {children}
    </Button>
  );
}