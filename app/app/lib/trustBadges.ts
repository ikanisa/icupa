const fallbackBadges = [
  {
    code: "gstc",
    label: "Certified B-Corp operators",
    description: "All suppliers maintain GSTC-aligned sustainability management systems.",
  },
  {
    code: "climate",
    label: "Global Sustainable Tourism Council member",
    description: "ecoTrips participates in GSTC working groups to evolve impact scoring.",
  },
  {
    code: "stripe-climate",
    label: "Stripe Climate climate-action partner",
    description: "1% of revenue supports frontier carbon removal alongside local offsets.",
  },
];

export type TrustBadge = {
  code: string;
  label: string;
  description?: string | null;
};

export async function loadTrustBadges(): Promise<TrustBadge[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return fallbackBadges;
  }

  try {
    const response = await fetch(
      `${supabaseUrl}/rest/v1/trust_badges?select=code,label,description&active=eq.true`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "Cache-Control": "no-cache",
        },
        next: { revalidate: 60 },
      },
    );
    if (!response.ok) {
      return fallbackBadges;
    }
    const rows = await response.json();
    if (!Array.isArray(rows)) {
      return fallbackBadges;
    }
    const badges = rows.map((row) => ({
      code: typeof row?.code === "string" ? row.code : crypto.randomUUID(),
      label: typeof row?.label === "string" ? row.label : "ecoTrips badge",
      description: typeof row?.description === "string" ? row.description : null,
    }));
    return badges.length > 0 ? badges : fallbackBadges;
  } catch (_error) {
    return fallbackBadges;
  }
}
