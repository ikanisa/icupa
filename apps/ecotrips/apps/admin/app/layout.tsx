import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import type { Metadata } from "next";
import { ReactNode } from "react";

import { FeatureFlagsProvider } from "@ecotrips/ui";

export const metadata: Metadata = {
  title: "ecoTrips Ops Console",
  description: "Ops, Finance, and Support controls for ecoTrips",
  manifest: "/manifest.json",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-50">
        <FeatureFlagsProvider>
          <main>{children}</main>
        </FeatureFlagsProvider>
      </body>
    </html>
  );
}
