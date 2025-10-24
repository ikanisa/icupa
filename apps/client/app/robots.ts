import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = "https://app.ecotrips.africa";
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: ["/checkout", "/wallet"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
