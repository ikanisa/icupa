import type { Metadata } from "next";

const SITE_NAME = "ecoTrips";
const DEFAULT_TITLE = "ecoTrips — Liquid-glass journeys";
const DEFAULT_DESCRIPTION = "Gradient, liquid-glass, mobile-first eco travel planning";

const metadataBase = (() => {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ecotrips.africa";
    return new URL(base);
  } catch (error) {
    console.warn("Invalid NEXT_PUBLIC_SITE_URL", error);
    return new URL("https://ecotrips.africa");
  }
})();

type MetadataInput = {
  title?: string;
  description?: string;
  path?: string;
  images?: string[];
};

export function createPageMetadata({ title, description, path, images }: MetadataInput = {}): Metadata {
  const resolvedTitle = title ? `${title} · ${SITE_NAME}` : DEFAULT_TITLE;
  const resolvedDescription = description ?? DEFAULT_DESCRIPTION;
  const url = path ? new URL(path, metadataBase).toString() : metadataBase.toString();
  const ogImages = images?.map((image) => ({ url: image }));

  return {
    metadataBase,
    title: resolvedTitle,
    description: resolvedDescription,
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url,
      siteName: SITE_NAME,
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: resolvedTitle,
      description: resolvedDescription,
      images,
    },
  };
}

export const defaultMetadata = createPageMetadata();
