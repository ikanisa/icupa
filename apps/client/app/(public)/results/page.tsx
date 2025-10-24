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

export async function generateMetadata({ searchParams }: { searchParams: RawSearchParams }) {
  const input = parseSearchParams(searchParams);
  return createPageMetadata({
    title: `Results · ${input.destination}`,
    description: `Top picks for ${input.destination} between ${input.startDate} and ${input.endDate}.`,
    path: "/results",
  });
}

export default async function ResultsPage({ searchParams }: { searchParams: RawSearchParams }) {
  const input = parseSearchParams(searchParams);
  const results = await loadInventorySearch(searchParams);

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
    </PublicPage>
  );
}

function PriceLockOption({ item }: { item: Record<string, unknown> }) {
  const expiresAt = typeof item.hold_expires_at === "string"
    ? item.hold_expires_at
    : typeof item.expires_at === "string"
      ? item.expires_at
      : new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const itineraryId = typeof item.id === "string" ? item.id : "draft";
  const currency = typeof item.currency === "string" ? item.currency : "USD";
  const rawPrice = typeof item.price_cents === "number" ? item.price_cents : Number(item.price_cents ?? 0);
  const priceCents = Number.isFinite(rawPrice) ? rawPrice : 0;
  const displayPrice = Math.max(0, Math.round(priceCents / 100)).toLocaleString();

  return (
    <OptionCard
      title="Lock this fare"
      subtitle="Edge function price-lock-offer uses idempotency so you never double-charge."
      chip={<CountdownChip expiresAt={expiresAt} />}
      actionLabel="Hold price"
      actionHref={`/itinerary/${itineraryId}?action=price-lock`}
    >
      <p>Hold {currency} {displayPrice} for 15 minutes while ConciergeGuide coordinates payment. If suppliers are offline we fall back to fixtures and log it via withObs.</p>
    </OptionCard>
  );
}

