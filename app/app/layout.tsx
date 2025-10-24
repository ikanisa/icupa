import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "Nest Scout",
  description: "Atlas-styled PWA",
  manifest: "/manifest.webmanifest",
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">
          {children}
          <div style={{ marginTop: 24, color: "var(--muted)", fontSize: 13 }}>
            I am an AI helper for homes. I am polite, I always say I’m an AI, and I only contact people in safe, legal ways.
          </div>
        </div>
      </body>
    </html>
  );
}
