import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const PROVIDER_BASE = Deno.env.get("AIR_STATUS_BASE") ?? "";
const PROVIDER_TOKEN = Deno.env.get("AIR_STATUS_TOKEN") ?? "";
const OFFLINE = Deno.env.get("GROWTH_AIR_STATUS_OFFLINE") === "1" || !PROVIDER_BASE || !PROVIDER_TOKEN;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("providers-air-status");
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return jsonResponse({ ok: false, error: "GET or POST only" }, 405);
  }

  const params = req.method === "GET"
    ? url.searchParams
    : await extractParams(req);

  const provider = params.get("provider") ?? "mockair";
  const flight = params.get("flight") ?? "EC100";
  const date = params.get("date") ?? new Date().toISOString().slice(0, 10);
  const route = params.get("route") ?? "KGL-NBO";

  if (OFFLINE) {
    logOfflineFallback({ requestId, provider, flight, date });
    return jsonResponse({
      ok: true,
      request_id: requestId,
      mode: "offline",
      provider,
      flight,
      date,
      route,
      status: buildFixtureStatus(provider, flight),
    });
  }

  try {
    const upstream = await fetch(`${PROVIDER_BASE.replace(/\/$/, "")}/status?provider=${encodeURIComponent(provider)}&flight=${encodeURIComponent(flight)}&date=${encodeURIComponent(date)}&route=${encodeURIComponent(route)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${PROVIDER_TOKEN}`,
      },
    });

    if (!upstream.ok) {
      const text = await upstream.text();
      const error = new Error(`provider status ${upstream.status}: ${text || upstream.statusText}`);
      (error as { code?: string }).code = upstream.status >= 500
        ? ERROR_CODES.TRANSIENT_RETRY
        : ERROR_CODES.UNKNOWN;
      throw error;
    }

    const payload = await upstream.json();
    return jsonResponse({
      ok: true,
      request_id: requestId,
      provider,
      flight,
      date,
      route,
      status: payload,
    });
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    console.log(JSON.stringify({
      level: "WARN",
      event: "air.status.fallback",
      fn: "providers-air-status",
      request_id: requestId,
      provider,
      message: wrapped.message,
    }));
    return jsonResponse({
      ok: true,
      request_id: requestId,
      provider,
      flight,
      date,
      route,
      status: buildFixtureStatus(provider, flight),
      mode: "offline-fallback",
    });
  }
}, { fn: "providers-air-status", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function extractParams(req: Request): Promise<URLSearchParams> {
  try {
    const json = await req.json() as Record<string, string>;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(json)) {
      if (typeof value === "string") {
        params.set(key, value);
      }
    }
    return params;
  } catch (_err) {
    return new URLSearchParams();
  }
}

function buildFixtureStatus(provider: string, flight: string) {
  return {
    provider,
    flight,
    reliability_score: 0.92,
    segments: [
      {
        leg: 1,
        route: "KGL-NBO",
        scheduled_departure: new Date().toISOString(),
        estimated_departure: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        status: "on_time",
      },
    ],
    advisories: [
      {
        type: "wx",
        severity: "low",
        message: "Scattered showers near Nairobi expected.",
      },
    ],
  };
}

function logOfflineFallback(details: { requestId: string; provider: string; flight: string; date: string }) {
  console.log(JSON.stringify({
    level: "WARN",
    event: "air.status.offline",
    fn: "providers-air-status",
    request_id: details.requestId,
    provider: details.provider,
    flight: details.flight,
    date: details.date,
  }));
}
