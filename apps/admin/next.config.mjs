/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default config;
