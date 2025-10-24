import "../styles/globals.css";
import "@ecotrips/ui/styles/tokens.css";

import type { Metadata } from "next";
import { ReactNode } from "react";

import { defaultMetadata } from "../lib/seo/metadata";
import { ServiceWorkerBridge } from "./(public)/components/ServiceWorkerBridge";
import { AppProviders } from "./(public)/providers/AppProviders";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "TravelAgency",
  name: "ecoTrips",
  url: "https://app.ecotrips.africa",
  description: "Gradient, liquid-glass, mobile-first eco travel planning",
  sameAs: [
    "https://twitter.com/ecotrips",
    "https://www.linkedin.com/company/ecotrips",
  ],
  areaServed: {
    "@type": "Country",
    name: "Rwanda",
  },
  makesOffer: {
    "@type": "OfferCatalog",
    name: "ecoTrips curated journeys",
    itemListElement: [
      {
        "@type": "Offer",
        name: "Akagera safari escapes",
      },
      {
        "@type": "Offer",
        name: "Kigali immersion weekends",
      },
    ],
  },
};

export const metadata: Metadata = {
  ...defaultMetadata,
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://app.ecotrips.africa",
    languages: {
      "en-US": "https://app.ecotrips.africa",
    },
  },
  openGraph: {
    title: "ecoTrips — Liquid-glass journeys",
    description: "AI-assisted travel planning with transparent pricing and offline resiliency.",
    url: "https://app.ecotrips.africa",
    siteName: "ecoTrips",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "https://app.ecotrips.africa/og.png",
        width: 1200,
        height: 630,
        alt: "ecoTrips liquid glass UI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@ecotrips",
    creator: "@ecotrips",
    title: "ecoTrips — Liquid-glass journeys",
    description: "PlannerCoPilot orchestrates eco travel with resilience and transparency.",
    images: ["https://app.ecotrips.africa/og.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
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
