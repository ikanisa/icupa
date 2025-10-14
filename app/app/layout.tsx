import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ecoTrips | Curated low-impact adventures",
  description:
    "Discover and book low-impact itineraries with trusted local guides, transparent carbon reporting, and responsive on-trip support.",
  keywords: [
    "eco travel",
    "sustainable trips",
    "small group tours",
    "responsible tourism",
    "ecoTrips",
  ],
  openGraph: {
    title: "ecoTrips — Sustainably planned adventures",
    description:
      "Plan your next getaway with curated eco-friendly itineraries, verified suppliers, and 24/7 operator support.",
    url: "https://www.ecotrips.example",
    siteName: "ecoTrips",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ecoTrips",
    description:
      "Book immersive, sustainable adventures backed by real operator support and transparent impact data.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
