import type { NextConfig } from "next";
import "./src/env";

const allowedDevOrigins = ["http://localhost", "http://127.0.0.1"] as const;

const mutableAllowedDevOrigins = Array.from(allowedDevOrigins);

const config = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    turbo: {
      rules: {},
    },
  },
  output: "standalone",
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
  allowedDevOrigins: mutableAllowedDevOrigins,
} satisfies NextConfig & {
  turbopack: {
    root: boolean;
  };
  allowedDevOrigins: readonly string[];
};

export { allowedDevOrigins };
export default config;
