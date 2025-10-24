import fixture from "./fixture.json" with { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface ConciergeDailyBriefFixture {
  itinerary_id: string;
  traveler_names?: string[];
  timezone?: string;
  briefs: Array<{
    day: number;
    date: string;
    headline: string;
    summary: string;
    segments: Array<{
      id: string;
      time_window: string;
      title: string;
      instruction: string;
      contact?: { name: string; role?: string; phone?: string };
      notes?: string[];
      map_link?: string;
      safety_note?: string;
    }>;
    alerts?: Array<{
      id: string;
      type: string;
      message: string;
      severity?: string;
    }>;
    group_savings?: {
      escrow_id: string;
      target_cents: number;
      collected_cents: number;
      due_date: string;
      nudge_copy: string;
      next_step?: string;
    };
  }>;
}

const data = fixture as ConciergeDailyBriefFixture;
const USE_FIXTURES = (Deno.env.get("CONCIERGE_FIXTURES") ?? "1") !== "0";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("concierge-daily-brief");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, { status: 405 });
  }

  if (!USE_FIXTURES) {
    console.warn(
      "CONCIERGE_FIXTURES=0 requested live mode but only fixture payloads are available. Returning fixtures.",
    );
  }

  const dayParam = url.searchParams.get("day");
  const limitParam = url.searchParams.get("limit");

  const day = dayParam ? Number.parseInt(dayParam, 10) : undefined;
  const limitRaw = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw ?? 0, 1), 7) : undefined;

  let briefs = data.briefs ?? [];
  if (Number.isFinite(day) && day) {
    briefs = briefs.filter((brief) => brief.day === day);
  }

  if (limit) {
    briefs = briefs.slice(0, limit);
  }

  const payload = {
    ok: true,
    request_id: requestId,
    source: USE_FIXTURES ? "fixtures" : "fixtures_fallback",
    itinerary_id: data.itinerary_id,
    traveler_names: data.traveler_names ?? [],
    timezone: data.timezone ?? "UTC",
    briefs,
  };

  return jsonResponse(payload);
}, { fn: "concierge-daily-brief", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}
