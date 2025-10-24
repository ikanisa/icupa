import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { ERROR_CODES } from "../_obs/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for metrics-incr");
}

interface IncomingPayload {
  name?: unknown;
  delta?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("metrics-incr");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let payload: IncomingPayload;
  try {
    payload = (await req.json()) as IncomingPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const name = typeof payload?.name === "string" ? payload.name.trim() : "";
  const deltaRaw = Number(payload?.delta ?? 1);

  if (!name) {
    return jsonResponse({ ok: false, error: "name is required" }, 400);
  }
  if (!Number.isFinite(deltaRaw)) {
    return jsonResponse({ ok: false, error: "delta must be numeric" }, 400);
  }

  const delta = Math.trunc(deltaRaw);

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/metrics_increment_counter`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "params=single-object",
        "Accept-Profile": "metrics",
      },
      body: JSON.stringify({ p_name: name, p_delta: delta }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`metrics_increment_counter failed: ${text}`);
    (error as { code?: string }).code = ERROR_CODES.DATA_CONFLICT;
    throw error;
  }

  const body = await response.json();
  return jsonResponse({ ok: true, counter: body, request_id: requestId });
}, { fn: "metrics-incr", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
