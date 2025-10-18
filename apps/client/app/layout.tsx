import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import type { Metadata } from "next";
import { ReactNode } from "react";

import { ServiceWorkerBridge } from "./(public)/components/ServiceWorkerBridge";

export const metadata: Metadata = {
  title: "ecoTrips — Liquid-glass journeys",
  description: "Gradient, liquid-glass, mobile-first eco travel planning",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerBridge />
      </body>
    </html>
  );
}
