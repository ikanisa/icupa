import fixture from "./fixture.json" with { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface TimeToLeaveFixture {
  itinerary_id: string;
  timezone?: string;
  departures: Array<{
    id: string;
    label: string;
    recommended_departure: string;
    window_minutes?: number;
    buffer_minutes?: number;
    pickup_point?: string;
    status?: string;
    transport?: {
      provider?: string;
      vehicle?: string;
      driver?: string;
      contact_phone?: string;
    };
    notes?: string[];
  }>;
}

const data = fixture as TimeToLeaveFixture;
const USE_FIXTURES = (Deno.env.get("TIME_TO_LEAVE_FIXTURES") ?? "1") !== "0";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("time-to-leave");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, { status: 405 });
  }

  if (!USE_FIXTURES) {
    console.warn(
      "TIME_TO_LEAVE_FIXTURES=0 requested live mode but only fixture payloads are available. Returning fixtures.",
    );
  }

  const limitParam = url.searchParams.get("limit");
  const limitRaw = limitParam ? Number.parseInt(limitParam, 10) : undefined;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw ?? 0, 1), 7) : undefined;

  const upcomingOnly = url.searchParams.get("upcoming") === "1";
  const nowParam = url.searchParams.get("now");

  let now = new Date();
  if (nowParam) {
    const parsed = new Date(nowParam);
    if (!Number.isNaN(parsed.getTime())) {
      now = parsed;
    }
  }

  let departures = (data.departures ?? []).slice().sort((a, b) => {
    const aTime = new Date(a.recommended_departure).getTime();
    const bTime = new Date(b.recommended_departure).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }
    return aTime - bTime;
  });

  if (upcomingOnly) {
    departures = departures.filter((departure) => {
      const ts = new Date(departure.recommended_departure).getTime();
      if (Number.isNaN(ts)) return true;
      return ts >= now.getTime();
    });
  }

  if (limit) {
    departures = departures.slice(0, limit);
  }

  const payload = {
    ok: true,
    request_id: requestId,
    source: USE_FIXTURES ? "fixtures" : "fixtures_fallback",
    itinerary_id: data.itinerary_id,
    timezone: data.timezone ?? "UTC",
    departures,
    next_departure: departures[0]?.id ?? null,
  };

  return jsonResponse(payload);
}, { fn: "time-to-leave", defaultErrorCode: ERROR_CODES.UNKNOWN });

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
