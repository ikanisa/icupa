import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import type { Metadata } from "next";
import { ReactNode } from "react";

import { defaultMetadata } from "../lib/seo/metadata";
import { ServiceWorkerBridge } from "./(public)/components/ServiceWorkerBridge";
import { AppProviders } from "./(public)/providers/AppProviders";

export const metadata: Metadata = {
  ...defaultMetadata,
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
