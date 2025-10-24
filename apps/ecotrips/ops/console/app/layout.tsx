import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ecoTrips Ops Console",
  description: "Operations console for ecoTrips support team"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
