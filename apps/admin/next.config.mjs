import { withSentryConfig } from '@sentry/nextjs';

const connectSrc = ["'self'", 'https://*.supabase.co', 'https://*.sentry.io'];
if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  connectSrc.push(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
}

const csp = [
  "default-src 'self'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "script-src 'self' 'unsafe-eval' https://*.supabase.co https://*.sentry.io",
  "style-src 'self' 'unsafe-inline'",
  `connect-src ${connectSrc.join(' ')}`,
  "font-src 'self' data:",
  "base-uri 'self'",
  "form-action 'self'",
];

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: csp.join('; '),
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
];

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
};

export default withSentryConfig(config, { silent: true }, { hideSourceMaps: true });
