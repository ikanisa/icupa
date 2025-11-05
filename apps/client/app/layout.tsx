import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { cn } from '@icupa/ui/primitives';
import '@icupa/ui/styles.css';
import './globals.css';
import './env.server';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'ICUPA Client PWA',
  description:
    'Preview the ICUPA diner journey: browse menus, chat with the AI waiter, and settle your table from any device.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen bg-surface text-foreground antialiased',
          'bg-[radial-gradient(circle_at_top,_rgba(109,33,255,0.3),_transparent_55%)]',
          'bg-fixed'
        )}
      >
        <Providers>
          <div className="flex min-h-screen flex-col">
            <a
              href="#content"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
            >
              Skip to content
            </a>
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
