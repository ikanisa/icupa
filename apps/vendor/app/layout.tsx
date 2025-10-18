import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@icupa/ui/styles.css';
import './globals.css';
import { cn } from '@icupa/ui';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ICUPA Vendor PWA',
  description:
    'Operational console for restaurants to manage onboarding, live orders, floor assignments, and menu quality. Scaffold build.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen text-foreground antialiased')}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
