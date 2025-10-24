import { CardGlass, buttonClassName } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { InventorySearchInput } from "@ecotrips/types";
import Link from "next/link";
import { PushNotificationBanner } from "../components/PushNotificationBanner";

function parseSearchParams(searchParams: Record<string, string | string[] | undefined>) {
  const destination = typeof searchParams.destination === "string" ? searchParams.destination : "Kigali";
  const startDate = typeof searchParams.startDate === "string" ? searchParams.startDate : new Date().toISOString().slice(0, 10);
  const endDate = typeof searchParams.endDate === "string" ? searchParams.endDate : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
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

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 pb-24 pt-10">
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
      <PushNotificationBanner context="results" tags={["results", isOffline ? "offline" : "live"]} />

    </div>
  );
}
