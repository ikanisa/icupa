import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ICUPA — Multi-Vendor Dine-In',
  description: 'Client, merchant, and admin experiences for ICUPA venues in Rwanda and Malta.',
  icons: [{ rel: 'icon', url: '/favicon.ico' }],
  metadataBase: new URL('https://icupa.local'),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="relative min-h-screen overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10 select-none bg-[radial-gradient(circle_at_top,_rgba(107,91,255,0.4),_transparent_55%),_radial-gradient(circle_at_bottom,_rgba(35,198,215,0.35),_transparent_55%)]" />
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}
