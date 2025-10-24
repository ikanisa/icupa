import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { CircuitBreaker, retryWithBackoff, TokenBucket } from "../_shared/inventory.ts";
import {
  MemoryCache,
  jsonResponse,
  logAudit,
  normalizeCurrency,
  normalizeIata,
  requireIsoDate,
} from "../_shared/providers.ts";

const PROVIDERS_OFFLINE = Deno.env.get("PROVIDERS_OFFLINE") !== "0";
const HOLD_TTL_MS = Number(Deno.env.get("PROVIDERS_AIR_HOLD_TTL_MS") ?? "900000");
const bucket = new TokenBucket({ capacity: 15, refillIntervalMs: 1000 });
const breaker = new CircuitBreaker({ failureThreshold: 4, coolDownMs: 60000 });
const idempotencyCache = new MemoryCache<{ hold_ref: string; expires_at: string; source: string }>();

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("providers-air-hold");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const offerIdRaw = pickString(body, ["offer_id", "offerId", "id"]);
  const originRaw = pickString(body, ["origin", "origin_code", "originCode"]);
  const destinationRaw = pickString(body, ["destination", "destination_code", "destinationCode"]);
  const departureRaw = pickString(body, ["departure_date", "departureDate", "depart"]);
  const returnRaw = pickString(body, ["return_date", "returnDate", "return"]);
  const currencyRaw = pickString(body, ["currency"]);
  const contact = pickString(body, ["contact", "email", "phone"]);
  const idempotencyKey = pickString(body, ["idempotency_key", "idempotencyKey"]);

  const errors: string[] = [];
  let offerId = offerIdRaw ?? "";
  if (!offerId) {
    errors.push("offer_id is required");
  }

  let origin = "";
  let destination = "";
  let departureDate = "";
  let returnDate: string | undefined;
  let currency = "USD";

  try {
    origin = normalizeIata(originRaw ?? "", "origin");
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    destination = normalizeIata(destinationRaw ?? "", "destination");
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    departureDate = requireIsoDate(departureRaw ?? "", "departure_date");
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (returnRaw) {
    try {
      returnDate = requireIsoDate(returnRaw, "return_date");
    } catch (error) {
      errors.push((error as Error).message);
    }
  }

  try {
    currency = normalizeCurrency(currencyRaw, "USD");
  } catch (error) {
    errors.push((error as Error).message);
  }

  if (!idempotencyKey) {
    errors.push("idempotency_key is required");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const dedupeKey = `air-hold:${idempotencyKey}`;
  const existing = idempotencyCache.get(dedupeKey);
  if (existing) {
    return jsonResponse({
      ok: true,
      request_id: requestId,
      hold_ref: existing.hold_ref,
      expires_at: existing.expires_at,
      source: existing.source,
      idempotency_key: idempotencyKey,
      reused: true,
    });
  }

  if (!breaker.canRequest() && !PROVIDERS_OFFLINE) {
    const error = new Error("air provider circuit open");
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  let hold: { hold_ref: string; expires_at: string; source: string };
  try {
    if (PROVIDERS_OFFLINE) {
      hold = await retryWithBackoff(async () => createMockHold());
      hold.source = "fixtures";
      breaker.recordSuccess();
    } else {
      bucket.consume();
      throw new Error("live air supplier not configured");
    }
  } catch (error) {
    breaker.recordFailure();
    if (!(error instanceof Error)) {
      const wrapped = new Error(String(error));
      (wrapped as { code?: string }).code = ERROR_CODES.UNKNOWN;
      throw wrapped;
    }
    if (!(error as { code?: string }).code) {
      (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    }
    throw error;
  }

  idempotencyCache.set(dedupeKey, hold, HOLD_TTL_MS);

  logAudit("providers.air.hold", {
    request_id: requestId,
    offer_id: offerId,
    origin,
    destination,
    departure_date: departureDate,
    return_date: returnDate ?? null,
    source: hold.source,
    idempotency_key: idempotencyKey,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    hold_ref: hold.hold_ref,
    expires_at: hold.expires_at,
    source: hold.source,
    idempotency_key: idempotencyKey,
    contact: contact ?? null,
    currency,
  });
}, { fn: "providers-air-hold", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function pickString(
  source: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

async function createMockHold(): Promise<{ hold_ref: string; expires_at: string; source: string }> {
  const holdRef = `hold-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + HOLD_TTL_MS).toISOString();
  return { hold_ref: holdRef, expires_at: expiresAt, source: "fixtures" };
}
