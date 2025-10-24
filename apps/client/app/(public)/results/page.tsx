import { CardGlass } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { InventorySearchInput } from "@ecotrips/types";

import { ResultsList } from "./ResultsList";

function parseSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const destination = typeof searchParams.destination === "string" ? searchParams.destination : "Kigali";
  const startDate = typeof searchParams.startDate === "string" ? searchParams.startDate : new Date().toISOString().slice(0, 10);
  const endDate = typeof searchParams.endDate === "string"
    ? searchParams.endDate
    : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const adults = Number(Array.isArray(searchParams.adults) ? searchParams.adults[0] : searchParams.adults ?? 2);
  const children = Number(Array.isArray(searchParams.children) ? searchParams.children[0] : searchParams.children ?? 0);

  const parsed = InventorySearchInput.safeParse({
    destination,
    startDate,
    endDate,
    party: { adults: Number.isFinite(adults) ? adults : 2, children: Number.isFinite(children) ? children : 0 },
  });

  return parsed.success
    ? parsed.data
    : {
        destination,
        startDate,
        endDate,
        party: { adults: 2, children: 0 },
        budgetHint: "balanced" as const,
        locale: "en" as const,
      };
}

async function loadResults(searchParams: Record<string, string | string[] | undefined>) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return { items: [], ok: false, cacheHit: true };
  }

  const input = parseSearchParams(searchParams);
  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });

  try {
    const response = await client.call("inventory.search", input);
    return response;
  } catch (error) {
    console.error("inventory.search failed", error);
    return { items: [], ok: false, cacheHit: true };
  }
}

export default async function ResultsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const input = parseSearchParams(searchParams);
  const results = await loadResults(searchParams);

  const isOffline = !results.ok || results.cacheHit;
  const defaultCurrency = (results.items[0]?.currency ?? "USD").toUpperCase();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <ResultsList
        title={`Top picks for ${input.destination}`}
        subtitle={`Dates ${input.startDate} → ${input.endDate} · party of ${input.party.adults}${input.party.children ? ` + ${input.party.children} children` : ""}`}
        items={results.items as Array<{ id?: string; name?: string; supplier?: string; price_cents: number; currency?: string }>}
        defaultCurrency={defaultCurrency}
      />
      {isOffline && (
        <CardGlass title="Offline fallback" subtitle="Fixtures served within 3 seconds to maintain experience.">
          <p className="text-sm text-white/80">
            inventory-search uses cache-first strategy with breaker + retries. When suppliers are offline we serve curated
            itineraries and log TRANSIENT_RETRY taxonomy entries via withObs.
          </p>
        </CardGlass>
      )}
    </div>
  );
}
