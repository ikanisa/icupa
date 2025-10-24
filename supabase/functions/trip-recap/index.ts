import recapsFixture from "../../../ops/fixtures/trip_recaps.json" assert { type: "json" };
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface TripRecapBody {
  itinerary_id?: unknown;
  email?: unknown;
  locale?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("trip-recap");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: TripRecapBody;
  try {
    payload = (await req.json()) as TripRecapBody;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const itineraryId = typeof payload.itinerary_id === "string" ? payload.itinerary_id : null;
  const email = typeof payload.email === "string" ? payload.email : null;
  const locale = typeof payload.locale === "string" ? payload.locale : "en";

  if (!itineraryId) {
    return jsonResponse({ ok: false, error: "itinerary_id_required" }, 422);
  }

  const recap = findRecap(itineraryId) ?? buildFallbackRecap(itineraryId, locale);

  console.log(
    JSON.stringify({
      level: "INFO",
      event: "wallet.trip.recap",
      fn: "trip-recap",
      requestId,
      itineraryId,
      recapId: recap.recap_id,
      email: email ?? undefined,
    }),
  );

  return jsonResponse({ ok: true, recap, request_id: requestId, email });
}, { fn: "trip-recap" });

Deno.serve(handler);

type RecapRecord = {
  itinerary_id: string;
  recap_id: string;
  subject: string;
  summary: string;
  highlights: string[];
  cta_url: string;
  preview_html: string;
  generated_at: string;
};

function findRecap(itineraryId: string): RecapRecord | null {
  if (!Array.isArray(recapsFixture)) return null;
  const match = (recapsFixture as Array<Record<string, unknown>>).find(
    (entry) => String(entry.itinerary_id ?? "") === itineraryId,
  );
  if (!match) return null;
  return {
    itinerary_id: String(match.itinerary_id ?? itineraryId),
    recap_id: String(match.recap_id ?? crypto.randomUUID()),
    subject: String(match.subject ?? "Your ecoTrips recap"),
    summary: String(match.summary ?? "Highlights from your ecoTrip."),
    highlights: Array.isArray(match.highlights)
      ? match.highlights.map((item) => String(item))
      : ["Offline recap generated"],
    cta_url: String(match.cta_url ?? "https://demo.ecotrips.app/wallet"),
    preview_html: String(match.preview_html ?? "<p>Offline recap ready.</p>"),
    generated_at: String(match.generated_at ?? new Date().toISOString()),
  };
}

function buildFallbackRecap(itineraryId: string, locale: string): RecapRecord {
  return {
    itinerary_id: itineraryId,
    recap_id: crypto.randomUUID(),
    subject: locale.startsWith("fr")
      ? "Résumé de votre aventure ecoTrips"
      : "Your ecoTrips recap is ready",
    summary: "Offline recap assembled with fixtures because live generator is offline.",
    highlights: [
      "PlannerCoPilot synced ledger entries and photos.",
      "Push notifications queued for wallet and email.",
      "Voice agent summary cached for offline playback.",
    ],
    cta_url: "https://demo.ecotrips.app/wallet/recap",
    preview_html: "<p>Offline recap generated via fixtures. Enable live mode for production runs.</p>",
    generated_at: new Date().toISOString(),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
