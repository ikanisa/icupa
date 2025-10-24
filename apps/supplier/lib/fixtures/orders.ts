export const supplierOrderFixtures = [
  {
    id: "ord-demo-1001",
    itinerary: "Andean Stargazer",
    startDate: "2025-03-18",
    travelers: 8,
    status: "awaiting_confirmation",
    totalCents: 184500,
    currency: "USD",
    notes: "Confirm solar van transfer + bilingual guide assignment.",
    badges: [
      { code: "gstc", label: "GSTC member" },
      { code: "offset", label: "Climate offset partner" }
    ],
  },
  {
    id: "ord-demo-1002",
    itinerary: "Volcanic Highlands",
    startDate: "2025-04-02",
    travelers: 12,
    status: "confirmed",
    totalCents: 265200,
    currency: "USD",
    notes: "Share ranger roster and nightly biodiversity tally template.",
    badges: [
      { code: "community", label: "Community co-op" }
    ],
  },
  {
    id: "ord-demo-1003",
    itinerary: "Rainforest Canopy Immersion",
    startDate: "2025-04-14",
    travelers: 6,
    status: "pending_docs",
    totalCents: 142000,
    currency: "USD",
    notes: "Awaiting updated insurance certificate.",
    badges: [
      { code: "safety", label: "Rescue-certified guides" },
      { code: "offset", label: "Climate offset partner" }
    ],
  },
] as const;
