import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "ecoTrips Supplier Portal",
  description: "Supplier availability, confirmations, and analytics",
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
