import type { NextConfig } from 'next';
import path from 'node:path';
import './src/env';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Tell Turbopack the app folder is the dev root
  turbopack: {
    root: __dirname,
  },

  serverExternalPackages: [
    '@supabase/node-fetch',
    '@supabase/realtime-js',
    '@supabase/supabase-js',
    '@upstash/ratelimit',
    '@upstash/redis'
  ],

  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.modules = [
      ...(config.resolve.modules ?? []),
      path.join(__dirname, 'node_modules'),
      path.join(__dirname, '..', 'node_modules')
    ];

    Object.assign(config.resolve.alias, {
      '@supabase/node-fetch': require.resolve('@supabase/node-fetch'),
      '@supabase/realtime-js': require.resolve('@supabase/realtime-js'),
      '@upstash/ratelimit': require.resolve('@upstash/ratelimit'),
      '@upstash/redis': require.resolve('@upstash/redis')
    });

    return config;
  },

  // Allow opening the dev site from your LAN IP (and localhost)
  // This removes the “Cross origin request detected … configure allowedDevOrigins” warning
  allowedDevOrigins: [
    'http://localhost',
    'http://localhost:3000',
    'http://127.0.0.1',
    'http://127.0.0.1:3000',
    'http://192.168.1.80'
  ],
};

export default nextConfig;

