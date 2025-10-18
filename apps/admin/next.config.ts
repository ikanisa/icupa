import type { NextConfig } from "next";

const config = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    turbo: {
      rules: {},
    },
  },
  transpilePackages: ["@ecotrips/ui", "@ecotrips/api", "@ecotrips/types", "@ecotrips/i18n"],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  turbopack: {
    root: true,
  },
  adminAllowedRoles: ["ops", "admin"],
} satisfies NextConfig & {
  turbopack: { root: boolean };
  adminAllowedRoles: string[];
};

export default config;
