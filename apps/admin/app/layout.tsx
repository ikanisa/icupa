import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cn } from '@icupa/ui';
import '@icupa/ui/styles.css';
import './globals.css';
import './env.server';
import { Providers } from './providers';
import { ServiceWorkerRegistrar } from './service-worker-registrar';

export const metadata: Metadata = {
  title: 'ICUPA Admin Console',
  description:
    'Administrative controls for autonomy, compliance, and rollout management across ICUPA deployments.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn('min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-foreground antialiased')}>
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
