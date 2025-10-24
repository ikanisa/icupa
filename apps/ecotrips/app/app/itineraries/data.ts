export type Itinerary = {
  slug: string;
  name: string;
  duration: string;
  impact: string;
  summary: string;
  heroImage: string;
  highlights: { title: string; description: string }[];
  dayByDay: { title: string; details: string }[];
  trustSignals: string[];
  suitability: string[];
};

export const itineraries: Itinerary[] = [
  {
    slug: "andean-stargazer",
    name: "Andean Stargazer",
    duration: "8 days",
    impact: "38% less carbon vs. traditional trekking",
    summary:
      "Solar-powered eco-lodges, indigenous astronomy workshops, and community-run regenerative farms across the Sacred Valley.",
    heroImage: "/images/itineraries/andean-stargazer.svg",
    highlights: [
      {
        title: "Night sky navigation",
        description: "Quechua elders guide you through celestial stories while astronomers map constellations with portable telescopes.",
      },
      {
        title: "Regenerative farming co-op",
        description: "Hands-on learning with regenerative farmers financing watershed restoration through ecoTrips travelers.",
      },
      {
        title: "Carbon-positive lodging",
        description: "Micro-hydro powered eco-lodges offset all emissions through verified reforestation projects.",
      },
    ],
    dayByDay: [
      { title: "Day 1", details: "Arrive in Cusco, acclimatize, and join a twilight walking tour led by local historians." },
      { title: "Day 2", details: "Community-hosted regenerative farming workshop and shared Andean lunch." },
      { title: "Day 3", details: "Night sky orientation with cultural astronomy narratives and telescope viewing." },
      { title: "Day 4", details: "Optional high-altitude trekking with certified local guides and llama packing teams." },
      { title: "Day 5", details: "Impact review: carbon accounting session and NGO partnership roundtable." },
      { title: "Day 6", details: "Textile collective visit supporting women artisans with fair trade certification." },
      { title: "Day 7", details: "Biodiversity monitoring hike with conservationists tracking endemic species." },
      { title: "Day 8", details: "Wrap-up brunch, donation matching for local projects, and airport transfers." },
    ],
    trustSignals: [
      "Rainforest Alliance lodging partners",
      "B-Corp certified logistics operator",
      "Traveler NPS 4.9/5 over 42 departures",
    ],
    suitability: [
      "Adventure couples",
      "University field courses",
      "Remote leadership retreats",
    ],
  },
  {
    slug: "nordic-regeneration",
    name: "Nordic Regeneration Residency",
    duration: "6 days",
    impact: "Partnering with 12 carbon-negative innovators",
    summary:
      "Co-create solutions with Nordic climate labs, stay in net-zero cabins, and learn from indigenous Sámi leaders.",
    heroImage: "/images/itineraries/nordic-regeneration.svg",
    highlights: [
      {
        title: "Sámi cultural exchange",
        description: "Spend a day with Sámi youth entrepreneurs restoring reindeer grazing routes and language access.",
      },
      {
        title: "Circular economy labs",
        description: "Workshop with cleantech founders on circular fashion, geothermal heating, and blue economy investments.",
      },
      {
        title: "Net-zero cabin village",
        description: "Experience passive solar cabins that feed excess energy back to the grid while showcasing local design.",
      },
    ],
    dayByDay: [
      { title: "Day 1", details: "Arrive in Tromsø, settle into net-zero cabins, and host a fireside welcome with Sámi leaders." },
      { title: "Day 2", details: "Circular economy innovation sprint with local startups and investors." },
      { title: "Day 3", details: "Field visit to fjord restoration project tracking kelp forest regeneration." },
      { title: "Day 4", details: "Choose-your-own-adventure: sea kayaking with marine biologists or alpine hikes with sustainability guides." },
      { title: "Day 5", details: "Impact storytelling workshop to take climate learnings back to your org." },
      { title: "Day 6", details: "Closing circle, carbon drawdown recap, and celebratory farm-to-table dinner." },
    ],
    trustSignals: [
      "Verified by Global Sustainable Tourism Council",
      "Science Based Targets aligned",
      "Average 36 hours operator response SLA",
    ],
    suitability: [
      "Executive strategy offsites",
      "STEM study abroad",
      "Green investor delegations",
    ],
  },
];

export function getItinerary(slug: string) {
  return itineraries.find((itinerary) => itinerary.slug === slug);
}
