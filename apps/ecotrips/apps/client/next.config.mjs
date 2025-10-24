const allowedDevOrigins = ["http://localhost", "http://127.0.0.1"];

/** @type {import('next').NextConfig & { turbopack: { root: boolean }, allowedDevOrigins: readonly string[] }} */
const config = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    turbo: {
      rules: {},
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  transpilePackages: ["@ecotrips/ui", "@ecotrips/api", "@ecotrips/types", "@ecotrips/i18n"],
  env: {
    NEXT_PUBLIC_APP_NAME: "ecoTrips",
  },
  turbopack: {
    root: true,
  },
  allowedDevOrigins,
};

export { allowedDevOrigins };
export default config;
