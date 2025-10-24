import fixture from "./fixture.json" with { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface SafetyAdvisoryFixture {
  itinerary_id: string;
  region?: string;
  source?: string;
  advisories: Array<{
    id: string;
    level: string;
    title: string;
    summary: string;
    details: string;
    effective_from: string;
    effective_to: string;
    actions?: string[];
    channels?: string[];
    external_reference?: string;
  }>;
}

const data = fixture as SafetyAdvisoryFixture;
const USE_FIXTURES = (Deno.env.get("SAFETY_ADVISORY_FIXTURES") ?? "1") !== "0";

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("safety-advisory");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, { status: 405 });
  }

  if (!USE_FIXTURES) {
    console.warn(
      "SAFETY_ADVISORY_FIXTURES=0 requested live mode but only fixture payloads are available. Returning fixtures.",
    );
  }

  const level = url.searchParams.get("level");
  const channel = url.searchParams.get("channel");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const fromTs = fromParam ? new Date(fromParam).getTime() : NaN;
  const toTs = toParam ? new Date(toParam).getTime() : NaN;

  let advisories = data.advisories ?? [];

  if (level) {
    advisories = advisories.filter((item) => item.level.toLowerCase() === level.toLowerCase());
  }

  if (channel) {
    advisories = advisories.filter((item) => item.channels?.some((entry) => entry === channel));
  }

  if (!Number.isNaN(fromTs)) {
    advisories = advisories.filter((item) => {
      const ts = new Date(item.effective_to).getTime();
      if (Number.isNaN(ts)) return true;
      return ts >= fromTs;
    });
  }

  if (!Number.isNaN(toTs)) {
    advisories = advisories.filter((item) => {
      const ts = new Date(item.effective_from).getTime();
      if (Number.isNaN(ts)) return true;
      return ts <= toTs;
    });
  }

  advisories = advisories.slice().sort((a, b) => {
    const aTime = new Date(a.effective_from).getTime();
    const bTime = new Date(b.effective_from).getTime();
    if (Number.isNaN(aTime) || Number.isNaN(bTime)) {
      return 0;
    }
    return aTime - bTime;
  });

  const payload = {
    ok: true,
    request_id: requestId,
    source: USE_FIXTURES ? "fixtures" : "fixtures_fallback",
    itinerary_id: data.itinerary_id,
    region: data.region ?? "",
    advisories,
    provider: data.source ?? "ConciergeGuide",
  };

  return jsonResponse(payload);
}, { fn: "safety-advisory", defaultErrorCode: ERROR_CODES.UNKNOWN });

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
