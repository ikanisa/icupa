export interface SearchIndexFixture {
  slug: string;
  entityType: string;
  entityId: string;
  title: string;
  subtitle?: string;
  keywords: string[];
  metadata: {
    summary: string;
    region: string;
    country: string;
    latitude?: number;
    longitude?: number;
    tags?: string[];
    heroImage?: string;
  } & Record<string, unknown>;
}

export const searchIndexFixtures: SearchIndexFixture[] = [
  {
    slug: "akagera-national-park",
    entityType: "park",
    entityId: "park-akagera",
    title: "Akagera National Park",
    subtitle: "Savannah safari and Lake Ihema boat cruises",
    keywords: ["akagera", "safari", "big five", "lake ihema", "game drive"],
    metadata: {
      summary:
        "Rwanda's classic safari destination with lions, rhinos, and private boat cruises along Lake Ihema.",
      region: "Eastern Province",
      country: "Rwanda",
      latitude: -1.882,
      longitude: 30.717,
      tags: ["wildlife", "safari", "lake"],
      heroImage: "https://images.ecotrips.dev/akagera.jpg",
    },
  },
  {
    slug: "nyungwe-canopy-trail",
    entityType: "park",
    entityId: "park-nyungwe",
    title: "Nyungwe Canopy Trail",
    subtitle: "Ancient rainforest canopy walk and primate tracking",
    keywords: ["nyungwe", "canopy", "rainforest", "chimpanzee", "primates"],
    metadata: {
      summary:
        "Cloud forest adventures with canopy walkways, chimpanzee trekking permits, and citizen science briefings.",
      region: "Southern Province",
      country: "Rwanda",
      latitude: -2.4804,
      longitude: 29.2007,
      tags: ["rainforest", "canopy", "primate"],
      heroImage: "https://images.ecotrips.dev/nyungwe.jpg",
    },
  },
  {
    slug: "volcanoes-gorilla-trek",
    entityType: "park",
    entityId: "park-volcanoes",
    title: "Volcanoes Gorilla Trek",
    subtitle: "Permits, trackers, and conservation storytelling",
    keywords: ["gorilla", "volcanoes", "kinigi", "trekking", "karisimbi"],
    metadata: {
      summary:
        "Gorilla permit operations based in Kinigi with community conservation labs and summit warmups on Bisoke.",
      region: "Northern Province",
      country: "Rwanda",
      latitude: -1.486,
      longitude: 29.597,
      tags: ["gorilla", "trekking", "community"],
      heroImage: "https://images.ecotrips.dev/volcanoes.jpg",
    },
  },
  {
    slug: "kigali-creative-quarter",
    entityType: "city",
    entityId: "city-kigali",
    title: "Kigali Creative Quarter",
    subtitle: "Gallery hops, night markets, and specialty coffee",
    keywords: ["kigali", "art", "night market", "coffee", "museum"],
    metadata: {
      summary:
        "Design-forward Kigali city stays with gallery crawls, speciality roasters, and curated impact meetups.",
      region: "Kigali City",
      country: "Rwanda",
      latitude: -1.9441,
      longitude: 30.0619,
      tags: ["city", "art", "culinary"],
      heroImage: "https://images.ecotrips.dev/kigali.jpg",
    },
  },
  {
    slug: "lake-kivu-retreat",
    entityType: "region",
    entityId: "region-kivu",
    title: "Lake Kivu Retreat",
    subtitle: "Solar-powered catamarans and shoreline lodges",
    keywords: ["kivu", "lake", "catamaran", "rubavu", "retreat"],
    metadata: {
      summary:
        "Wellness-forward retreats on Lake Kivu with solar catamarans, bean-to-bar cacao tastings, and hot springs resets.",
      region: "Western Province",
      country: "Rwanda",
      latitude: -1.719,
      longitude: 29.255,
      tags: ["lake", "wellness", "retreat"],
      heroImage: "https://images.ecotrips.dev/kivu.jpg",
    },
  },
  {
    slug: "gishwati-mukura-rewild",
    entityType: "park",
    entityId: "park-gishwati",
    title: "Gishwati Mukura Rewild",
    subtitle: "Community-led reforestation and golden monkey hikes",
    keywords: ["gishwati", "rewild", "golden monkey", "reforestation", "hike"],
    metadata: {
      summary:
        "Regenerative travel labs in Gishwati Mukura with ranger-led reforestation and golden monkey trekking routes.",
      region: "Western Province",
      country: "Rwanda",
      latitude: -1.663,
      longitude: 29.431,
      tags: ["reforestation", "wildlife", "community"],
      heroImage: "https://images.ecotrips.dev/gishwati.jpg",
    },
  },
];

export function findFixtureBySlug(slug: string) {
  return searchIndexFixtures.find((entry) => entry.slug === slug) ?? null;
}
