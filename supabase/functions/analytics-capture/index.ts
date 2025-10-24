// Edge function to capture analytics events into analytics.events table.
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "0") === "1";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
} as const;

type AnalyticsPayload = {
  event: string;
  session_id?: string;
  actor_id?: string;
  source?: string;
  payload?: Record<string, unknown>;
  user_agent?: string;
  referrer?: string;
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...CORS_HEADERS,
      ...init.headers,
    },
  });
}

function validateEvent(input: unknown): AnalyticsPayload | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const shape = input as Record<string, unknown>;
  const event = typeof shape.event === "string" ? shape.event.trim() : "";
  if (!event || event.length > 128) {
    return null;
  }
  const payload = shape.payload && typeof shape.payload === "object" ? (shape.payload as Record<string, unknown>) : {};
  const sanitized: AnalyticsPayload = {
    event,
    payload,
  };
  if (typeof shape.session_id === "string") {
    sanitized.session_id = shape.session_id.slice(0, 128);
  }
  if (typeof shape.actor_id === "string") {
    sanitized.actor_id = shape.actor_id.slice(0, 128);
  }
  if (typeof shape.source === "string") {
    sanitized.source = shape.source.slice(0, 64);
  }
  if (typeof shape.user_agent === "string") {
    sanitized.user_agent = shape.user_agent.slice(0, 512);
  }
  if (typeof shape.referrer === "string") {
    sanitized.referrer = shape.referrer.slice(0, 512);
  }
  return sanitized;
}

async function insertEvent(event: AnalyticsPayload, requestId: string) {
  if (USE_FIXTURES) {
    console.info(
      JSON.stringify({
        level: "INFO",
        fn: "analytics-capture",
        event: "analytics.fixture",
        requestId,
        payload: event,
      }),
    );
    return;
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw Object.assign(new Error("Supabase configuration missing"), {
      code: ERROR_CODES.CONFIGURATION,
    });
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/analytics.events`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      event: event.event,
      session_id: event.session_id ?? null,
      actor_id: event.actor_id ?? null,
      source: event.source ?? "client",
      payload: event.payload ?? {},
      user_agent: event.user_agent ?? null,
      referrer: event.referrer ?? null,
      request_id: requestId,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to persist analytics event: ${text}`), {
      code: ERROR_CODES.SUPPLIER_TIMEOUT,
    });
  }
}

Deno.serve(
  withObs(async (req) => {
    const requestId = getRequestId(req) ?? crypto.randomUUID();
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      const health = healthResponse("analytics-capture");
      const payload = await health.json();
      return json(payload);
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
      return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const bodyText = await req.text();
    if (!bodyText) {
      return json({ ok: false, error: "empty_payload" }, { status: 400 });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyText);
    } catch (_err) {
      return json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const event = validateEvent(parsed);
    if (!event) {
      return json({ ok: false, error: "invalid_payload" }, { status: 400 });
    }

    await insertEvent({ ...event, source: event.source ?? "client" }, requestId);

    console.log(
      JSON.stringify({
        level: "AUDIT",
        fn: "analytics-capture",
        event: "analytics.recorded",
        requestId,
        name: event.event,
      }),
    );

    return json({ ok: true, request_id: requestId }, { status: 202 });
  }, { fn: "analytics-capture", defaultErrorCode: ERROR_CODES.UNKNOWN }),
);
