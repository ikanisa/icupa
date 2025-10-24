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

interface PriceLockRequestBody {
  itinerary_id?: unknown;
  user_id?: unknown;
  price_cents?: unknown;
  currency?: unknown;
  hold_reference?: unknown;
  hold_expires_at?: unknown;
  idempotency_key?: unknown;
  consent?: unknown;
  telemetry?: unknown;
  metadata?: unknown;
}

interface PriceLockRow {
  id: string;
  itinerary_id: string | null;
  user_id: string | null;
  price_cents: number;
  currency: string;
  status: string;
  hold_reference: string | null;
  hold_expires_at: string | null;
  idempotency_key: string | null;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("price-lock-offer");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const auth = await resolveGrowthAuth(req);
  const authorized = isGrowthAuthorized(auth, { allowServiceRole: true, allowUser: true });
  if (!authorized) {
    const status = auth.type === "anonymous" ? 401 : 403;
    logGrowthAuthFailure({
      fn: "price-lock-offer",
      requestId,
      auth,
      required: "user_or_service",
      status,
    });
    return jsonResponse({ ok: false, error: "unauthorized", request_id: requestId }, status);
  }

  let body: PriceLockRequestBody;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const itineraryId = typeof body.itinerary_id === "string" ? body.itinerary_id : undefined;
  const userId = typeof body.user_id === "string" ? body.user_id : undefined;
  const priceCents = typeof body.price_cents === "number"
    ? Math.trunc(body.price_cents)
    : Number(body.price_cents ?? 0);
  const currency = typeof body.currency === "string" && body.currency.length >= 3
    ? body.currency
    : "USD";
  const holdReference = typeof body.hold_reference === "string" ? body.hold_reference : undefined;
  const holdExpiresAt = typeof body.hold_expires_at === "string" ? body.hold_expires_at : undefined;
  const idempotencyKey = typeof body.idempotency_key === "string" && body.idempotency_key.length > 0
    ? body.idempotency_key
    : undefined;
  const consent = body.consent === true;
  const telemetry = typeof body.telemetry === "object" && body.telemetry !== null
    ? body.telemetry
    : {};
  const metadata = typeof body.metadata === "object" && body.metadata !== null
    ? body.metadata
    : {};

  const errors: string[] = [];
  if (!consent) errors.push("consent required");
  if (!priceCents || !Number.isFinite(priceCents) || priceCents <= 0) errors.push("price_cents must be > 0");
  if (!idempotencyKey) errors.push("idempotency_key required");

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
      offer: {
        id: crypto.randomUUID(),
        itinerary_id: itineraryId ?? null,
        user_id: userId ?? null,
        price_cents: priceCents,
        currency,
        hold_reference: holdReference ?? `mock-hold-${crypto.randomUUID().slice(0, 8)}`,
        hold_expires_at: holdExpiresAt ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        status: "issued",
      },
    });
  }

  const existing = await lookupOffer(growthConfig, idempotencyKey);
  if (existing) {
    return jsonResponse({
      ok: true,
      request_id: requestId,
      reused: true,
      offer: existing,
    });
  }

  const insertResponse = await fetch(`${growthConfig.url}/rest/v1/price_lock_offers`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", growthConfig.serviceRoleKey),
    body: JSON.stringify({
      itinerary_id: itineraryId ?? null,
      user_id: userId ?? null,
      price_cents: priceCents,
      currency,
      status: "issued",
      hold_reference: holdReference ?? null,
      hold_expires_at: holdExpiresAt ?? null,
      idempotency_key: idempotencyKey,
      consent_captured_at: new Date().toISOString(),
      telemetry,
      metadata: {
        ...metadata as Record<string, unknown>,
        request_id: requestId,
      },
    }),
  });

  if (!insertResponse.ok) {
    const text = await insertResponse.text();
    const error = new Error(`Failed to create price lock offer: ${text || insertResponse.statusText}`);
    (error as { code?: string }).code = insertResponse.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await insertResponse.json() as PriceLockRow[];
  const offer = Array.isArray(rows) && rows.length > 0
    ? rows[0]
    : {
      id: crypto.randomUUID(),
      itinerary_id: itineraryId ?? null,
      user_id: userId ?? null,
      price_cents: priceCents,
      currency,
      status: "issued",
      hold_reference: holdReference ?? null,
      hold_expires_at: holdExpiresAt ?? null,
      idempotency_key: idempotencyKey,
    };

  await recordEvent(growthConfig, offer.id, "offer_issued", {
    price_cents: priceCents,
    currency,
    telemetry,
    request_id: requestId,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    offer,
  });
}, { fn: "price-lock-offer", defaultErrorCode: ERROR_CODES.UNKNOWN });

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
    event: "pricelock.offline_fallback",
    fn: "price-lock-offer",
    request_id: details.requestId,
    reason: details.reason,
  }));
}

async function lookupOffer(config: ReturnType<typeof resolveGrowthConfig>, idempotencyKey: string) {
  const params = new URLSearchParams();
  params.set("select", "id,itinerary_id,user_id,price_cents,currency,status,hold_reference,hold_expires_at,idempotency_key");
  params.set("idempotency_key", `eq.${idempotencyKey}`);
  params.set("limit", "1");

  const response = await fetch(`${config.url}/rest/v1/price_lock_offers?${params.toString()}`, {
    method: "GET",
    headers: buildGetHeaders("growth", config.serviceRoleKey),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`Failed to lookup price lock offer: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await response.json() as PriceLockRow[];
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function recordEvent(
  config: ReturnType<typeof resolveGrowthConfig>,
  offerId: string,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${config.url}/rest/v1/price_lock_events`, {
    method: "POST",
    headers: buildGrowthHeaders("growth", config.serviceRoleKey),
    body: JSON.stringify({
      offer_id: offerId,
      event_type: eventType,
      payload,
    }),
  });

  if (!response.ok) {
    console.log(JSON.stringify({
      level: "WARN",
      event: "pricelock.event_insert_failed",
      fn: "price-lock-offer",
      offer_id: offerId,
      status: response.status,
    }));
  }
}
