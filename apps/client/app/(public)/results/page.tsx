import { CardGlass, buttonClassName } from "@ecotrips/ui";
import Link from "next/link";

import { createPageMetadata } from "../../../lib/seo/metadata";
import { loadInventorySearch, parseSearchParams } from "../../../lib/loaders/search";
import type { RawSearchParams } from "../../../lib/loaders/search";
import { PublicPage } from "../components/PublicPage";
import { ResultsHydrator } from "./ResultsHydrator";

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

  return (
    <PublicPage>
      <ResultsHydrator input={input} results={results} />
      <CardGlass
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
            {results.items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold">{item.name ?? "Itinerary option"}</h3>
                    <p className="text-sm text-white/70">Supplier {item.supplier ?? "tbd"}</p>
                  </div>
                  <ExplainPrice
                    amountCents={typeof item.price_cents === "number" ? item.price_cents : 0}
                    currency={item.currency ?? "USD"}
                    breakdown={(item as { explain_price?: string[] }).explain_price}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/itinerary/${item.id ?? "draft"}`}
                    className={buttonClassName("glass")}
                  >
                    View itinerary
                  </Link>
                  <Link
                    href={`/itinerary/${item.id ?? "draft"}?action=quote`}
                    className={buttonClassName("secondary")}
                  >
                    Request quote
                  </Link>
                </div>
                <div className="mt-4">
                  <PriceLockOption item={item as unknown as Record<string, unknown>} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardGlass>
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

