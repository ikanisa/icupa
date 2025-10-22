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
          <p className="text-sm text-white/80">
            No live inventory yet. Offline cache fixtures keep the experience responsive; PlannerCoPilot will notify once
            suppliers respond.
          </p>
        ) : (
          <ul className="space-y-4">
            {results.items.map((item) => (
              <li key={item.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
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
