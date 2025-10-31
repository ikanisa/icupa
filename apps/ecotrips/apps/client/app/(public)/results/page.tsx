import { CardGlass, ExplainPrice, buttonClassName } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { InventorySearchInput, type PriceBreakdown } from "@ecotrips/types";
import Link from "next/link";
import { PushNotificationBanner } from "../components/PushNotificationBanner";
import { PlannerFeatureGate } from "../components/PlannerFeatureGate";
import { ResultsList } from "./ResultsList";
import { OptionCard } from "../components/OptionCard";
import { CountdownChip } from "../components/CountdownChip";

type RawSearchParams = Record<string, string | string[] | undefined>;

function createPageMetadata(opts: { title: string; description: string; path: string }) {
  return {
    title: opts.title,
    description: opts.description,
  };
}

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
  // Stub: Return fixture data when API is unavailable
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

async function loadPriceBreakdowns(optionIds: string[]): Promise<Map<string, PriceBreakdown>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey || optionIds.length === 0) {
    return new Map();
  }

  const client = createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });

  try {
    const response = await client.call("helpers.price", { option_ids: optionIds });
    if (!response.ok) {
      return new Map();
    }
    const map = new Map<string, PriceBreakdown>();
    for (const entry of response.breakdowns ?? []) {
      map.set(entry.option_id, entry.breakdown);
    }
    return map;
  } catch (error) {
    console.error("helpers.price failed", error);
    return new Map();
  }
}

export default async function ResultsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const input = parseSearchParams(searchParams);
  const results = await loadResults(searchParams);
  const optionIds = results.items
    .map((item) => (typeof item.supplier_hotel_id === "string" ? item.supplier_hotel_id : null))
    .filter((id): id is string => Boolean(id));
  const breakdowns = await loadPriceBreakdowns(optionIds);

  const isOffline = !results.ok || results.cacheHit;
  const defaultCurrency = (results.items[0]?.currency ?? "USD").toUpperCase();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
      <ResultsList
        title={`Top picks for ${input.destination}`}
        subtitle={`Dates ${input.startDate} → ${input.endDate} · party of ${input.party.adults}${input.party.children ? ` + ${input.party.children} children` : ""}`}
      >
        {results.items.length === 0 ? (
          <PlannerFeatureGate
            debugLabel="results.empty"
            fallback={
              <p className="text-sm text-white/80">
                No live inventory yet. Offline cache fixtures keep the experience responsive while ConciergeGuide monitors supplier
                updates.
              </p>
            }
          >
            <p className="text-sm text-white/80">
              No live inventory yet. Offline cache fixtures keep the experience responsive; PlannerCoPilot will notify once
              suppliers respond.
            </p>
          </PlannerFeatureGate>
        ) : (
          <ul className="space-y-4">
            {results.items.map((item, index) => {
              const optionId = typeof item.supplier_hotel_id === "string" ? item.supplier_hotel_id : `option-${index}`;
              const breakdown = breakdowns.get(optionId) ?? breakdowns.get("default");
              const itinerarySlug = typeof item.id === "string" && item.id.length > 0 ? item.id : "draft";
              return (
                <li key={optionId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{item.name ?? "Itinerary option"}</h3>
                      <p className="text-sm text-white/70">Supplier {item.supplier ?? "tbd"}</p>
                    </div>
                    <p className="text-base font-semibold text-sky-200">
                      {item.currency ?? "USD"} {Math.round(item.price_cents / 100).toLocaleString()}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/itinerary/${itinerarySlug}`} className={buttonClassName("glass")}>
                      View itinerary
                    </Link>
                    <Link
                      href={`/itinerary/${itinerarySlug}?action=quote`}
                      className={buttonClassName("secondary")}
                    >
                      Request quote
                    </Link>
                  </div>
                  {breakdown && (
                    <div className="mt-4">
                      <ExplainPrice breakdown={breakdown} headline="Fixture pricing" />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ResultsList>
      {isOffline && (
        <CardGlass title="Offline fallback" subtitle="Fixtures served within 3 seconds to maintain experience.">
          <p className="text-sm text-white/80">
            inventory-search uses cache-first strategy with breaker + retries. When suppliers are offline we serve curated
            itineraries and log TRANSIENT_RETRY taxonomy entries via withObs.
          </p>
        </CardGlass>
      )}
      <PushNotificationBanner context="results" tags={["results", isOffline ? "offline" : "live"]} />

    </div>
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

