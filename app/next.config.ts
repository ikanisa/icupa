import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Tell Turbopack the app folder is the dev root
  turbopack: {
    root: __dirname,
  },

  // Allow opening the dev site from your LAN IP (and localhost)
  // This removes the “Cross origin request detected … configure allowedDevOrigins” warning
  allowedDevOrigins: [
    'http://localhost',
    'http://127.0.0.1',
    'http://192.168.1.80'
  ],
};

export default nextConfig;

