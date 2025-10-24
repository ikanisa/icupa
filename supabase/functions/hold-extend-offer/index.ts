import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  buildGetHeaders,
  buildGrowthHeaders,
  isGrowthAuthorized,
  logGrowthAuthFailure,
  resolveGrowthAuth,
  resolveGrowthConfig,
} from "../_shared/growth.ts";

interface HoldExtendBody {
  offer_id?: unknown;
  extension_minutes?: unknown;
  idempotency_key?: unknown;
  consent?: unknown;
  reason?: unknown;
}

interface PriceLockRow {
  id: string;
  hold_expires_at: string | null;
  hold_reference: string | null;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("hold-extend-offer");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const auth = await resolveGrowthAuth(req);
  const authorized = isGrowthAuthorized(auth, { allowServiceRole: true });
  if (!authorized) {
    const status = auth.type === "anonymous" ? 401 : 403;
    logGrowthAuthFailure({
      fn: "hold-extend-offer",
      requestId,
      auth,
      required: "service_role",
      status,
    });
    return jsonResponse({ ok: false, error: "unauthorized", request_id: requestId }, status);
  }

  let body: HoldExtendBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const offerId = typeof body.offer_id === "string" ? body.offer_id : "";
  const extensionMinutes = typeof body.extension_minutes === "number"
    ? Math.max(1, Math.trunc(body.extension_minutes))
    : Math.max(1, Number(body.extension_minutes ?? 0));
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length > 0
    ? body.idempotency_key
    : undefined;
  const consent = body.consent !== false; // extension is operational, allow if not explicitly denied
  const reason = typeof body.reason === "string" ? body.reason : "extension";

  const errors: string[] = [];
  if (!offerId) errors.push("offer_id required");
  if (!extensionMinutes || !Number.isFinite(extensionMinutes)) errors.push("extension_minutes invalid");
  if (!idempotencyKey) errors.push("idempotency_key required");
  if (!consent) errors.push("consent denied");

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const growthConfig = resolveGrowthConfig({ offlineFlag: "GROWTH_PRICE_LOCK_OFFLINE" });

  if (growthConfig.offline) {
    logOfflineFallback({ requestId, reason: growthConfig.reason ?? "offline" });
    return jsonResponse({
      ok: true,
      request_id: requestId,
      mode: "offline",
      offer_id: offerId,
      hold_expires_at: new Date(Date.now() + extensionMinutes * 60 * 1000).toISOString(),
      reused: false,
    });
  }

  const existingEvent = await lookupExtensionEvent(growthConfig, idempotencyKey);
  if (existingEvent) {
    return jsonResponse({
      ok: true,
      request_id: requestId,
      reused: true,
      offer_id: offerId,
      hold_expires_at: existingEvent,
    });
  }

  const offer = await fetchOffer(growthConfig, offerId);
  if (!offer) {
    const error = new Error("offer not found");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const currentExpiry = offer.hold_expires_at ? Date.parse(offer.hold_expires_at) : Date.now();
  const base = Number.isFinite(currentExpiry) ? currentExpiry : Date.now();
  const newExpiry = new Date(base + extensionMinutes * 60 * 1000).toISOString();

  const patchResponse = await fetch(`${growthConfig.url}/rest/v1/price_lock_offers?id=eq.${offerId}`, {
    method: "PATCH",
    headers: {
      ...buildGrowthHeaders("growth", growthConfig.serviceRoleKey),
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      hold_expires_at: newExpiry,
      telemetry: {
        ...(offer.hold_reference ? { hold_reference: offer.hold_reference } : {}),
        last_extension_minutes: extensionMinutes,
      },
    }),
  });

  if (!patchResponse.ok) {
    const text = await patchResponse.text();
    const error = new Error(`Failed to extend hold: ${text || patchResponse.statusText}`);
    (error as { code?: string }).code = patchResponse.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }

  await recordExtensionEvent(growthConfig, offerId, {
    idempotency_key: idempotencyKey,
    extension_minutes: extensionMinutes,
    hold_expires_at: newExpiry,
    reason,
    request_id: requestId,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    offer_id: offerId,
    hold_expires_at: newExpiry,
  });
}, { fn: "hold-extend-offer", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function logOfflineFallback(details: { requestId: string; reason: string }) {
  console.log(JSON.stringify({
    level: "WARN",
    event: "pricelock.extend.offline",
    fn: "hold-extend-offer",
    request_id: details.requestId,
    reason: details.reason,
  }));
}

async function lookupExtensionEvent(config: ReturnType<typeof resolveGrowthConfig>, idempotencyKey: string) {
  const params = new URLSearchParams();
  params.set("select", "payload->>hold_expires_at");
  params.set("event_type", "eq.hold_extended");
  params.set("payload->>idempotency_key", `eq.${idempotencyKey}`);
  params.set("limit", "1");

  const response = await fetch(`${config.url}/rest/v1/price_lock_events?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to check extension events: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await response.json() as Array<Record<string, string>>;
  if (Array.isArray(rows) && rows.length > 0) {
    const payloadExpiry = rows[0]["payload->>hold_expires_at"];
    return typeof payloadExpiry === "string" ? payloadExpiry : null;
  }
  return null;
}

async function fetchOffer(config: ReturnType<typeof resolveGrowthConfig>, offerId: string): Promise<PriceLockRow | null> {
  const params = new URLSearchParams();
  params.set("select", "id,hold_expires_at,hold_reference");
  params.set("id", `eq.${offerId}`);
  params.set("limit", "1");

  const response = await fetch(`${config.url}/rest/v1/price_lock_offers?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to fetch offer: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await response.json() as PriceLockRow[];
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function recordExtensionEvent(config: ReturnType<typeof resolveGrowthConfig>, offerId: string, payload: Record<string, unknown>) {
  const response = await fetch(`${config.url}/rest/v1/price_lock_events`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", config.serviceRoleKey),
    body: JSON.stringify({
      offer_id: offerId,
      event_type: "hold_extended",
      payload,
    }),
  });

  if (!response.ok) {
    console.log(JSON.stringify({
      level: "WARN",
      event: "pricelock.extend.event_failed",
      fn: "hold-extend-offer",
      offer_id: offerId,
      status: response.status,
    }));
  }
}
