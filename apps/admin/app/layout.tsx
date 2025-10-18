import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import type { Metadata } from "next";
import { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ecoTrips Ops Console",
  description: "Ops, Finance, and Support controls for ecoTrips",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
