import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  CircuitBreaker,
  retryWithBackoff,
  TokenBucket,
} from "../_shared/inventory.ts";

const HBX_BASE = Deno.env.get("HBX_BASE") ?? "https://api.test.hotelbeds.com";
const HBX_API_KEY = Deno.env.get("HBX_API_KEY") ?? "";
const HBX_API_SECRET = Deno.env.get("HBX_API_SECRET") ?? "";
const HBX_SIGNATURE_MOCK = Deno.env.get("HBX_SIGNATURE_MOCK") === "1";
const INVENTORY_OFFLINE = Deno.env.get("INVENTORY_OFFLINE") === "1";
const HOLD_IDEMPOTENCY_TTL_MS = Number(
  Deno.env.get("INVENTORY_HOLD_IDEMPOTENCY_TTL_MS") ?? "900000",
);

const bucket = new TokenBucket({ capacity: 20, refillIntervalMs: 1000 });
const breaker = new CircuitBreaker({ failureThreshold: 5, coolDownMs: 60000 });

interface HoldRecord {
  hold_ref: string;
  expires_at: string;
  source: string;
  stored_at: number;
}

const idempotencyStore = new Map<string, HoldRecord>();

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("inventory-hold");
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

  const supplierHotelId = typeof body.supplier_hotel_id === "string"
    ? body.supplier_hotel_id
    : "";
  const planId = typeof body.plan_id === "string" ? body.plan_id : undefined;
  const checkIn = typeof body.check_in === "string" ? body.check_in : "";
  const checkOut = typeof body.check_out === "string" ? body.check_out : "";
  const pax = typeof body.pax === "object" && body.pax !== null
    ? body.pax as Record<string, unknown>
    : {};
  const adults = Number(pax.adults ?? 0);
  const children = Number(pax.children ?? 0);
  const idempotencyKey = typeof body.idempotency_key === "string"
    ? body.idempotency_key
    : "";

  const errors: string[] = [];
  if (!supplierHotelId) errors.push("supplier_hotel_id is required");
  if (!planId) errors.push("plan_id is required");
  if (!isValidDate(checkIn)) errors.push("check_in must be YYYY-MM-DD");
  if (!isValidDate(checkOut)) errors.push("check_out must be YYYY-MM-DD");
  if (!Number.isInteger(adults) || adults <= 0) {
    errors.push("pax.adults must be > 0");
  }
  if (!Number.isInteger(children) || children < 0) {
    errors.push("pax.children must be >= 0");
  }
  if (!idempotencyKey) errors.push("idempotency_key is required");

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  purgeStaleHolds();
  const dedupeKey = `hold:${idempotencyKey}`;
  const existing = idempotencyStore.get(dedupeKey);
  if (existing) {
    logAudit({
      requestId,
      source: existing.source,
      supplier_hotel_id: supplierHotelId,
      plan_id: planId,
      idempotency_key: idempotencyKey,
      reused: true,
    });
    return jsonResponse({
      ok: true,
      request_id: requestId,
      source: existing.source,
      hold_ref: existing.hold_ref,
      expires_at: existing.expires_at,
      idempotency_key: idempotencyKey,
    });
  }

  if (!breaker.canRequest() && !INVENTORY_OFFLINE) {
    const error = new Error("inventory circuit open");
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  let hold: { hold_ref: string; expires_at: string } | null = null;
  let source = "";
  try {
    if (INVENTORY_OFFLINE) {
      source = "fixtures";
      hold = await createMockHold();
      breaker.recordSuccess();
    } else {
      bucket.consume();
      const liveHold = await callHBXHold({
        supplierHotelId,
        planId,
        checkIn,
        checkOut,
        adults,
        children,
        idempotencyKey,
        requestId,
      });
      hold = { hold_ref: liveHold.hold_ref, expires_at: liveHold.expires_at };
      source = "HBX";
      breaker.recordSuccess();
    }
  } catch (error) {
    breaker.recordFailure();
    const wrapped = error instanceof Error ? error : new Error(String(error));
    if (!(wrapped as { code?: string }).code) {
      (wrapped as { code?: string }).code = ERROR_CODES.UNKNOWN;
    }
    throw wrapped;
  }

  if (!hold) {
    const error = new Error("hold creation failed");
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }

  idempotencyStore.set(dedupeKey, {
    hold_ref: hold.hold_ref,
    expires_at: hold.expires_at,
    source,
    stored_at: Date.now(),
  });

  logAudit({
    requestId,
    source,
    supplier_hotel_id: supplierHotelId,
    plan_id: planId,
    idempotency_key: idempotencyKey,
    reused: false,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    source,
    hold_ref: hold.hold_ref,
    expires_at: hold.expires_at,
    idempotency_key: idempotencyKey,
  });
}, { fn: "inventory-hold", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function isValidDate(value: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) &&
    !Number.isNaN(new Date(value).getTime());
}

function purgeStaleHolds() {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (record.stored_at + HOLD_IDEMPOTENCY_TTL_MS <= now) {
      idempotencyStore.delete(key);
    }
  }
}

async function createMockHold() {
  const holdRef = `mock-${crypto.randomUUID()}`;
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return { hold_ref: holdRef, expires_at: expiresAt };
}

async function callHBXHold(params: {
  supplierHotelId: string;
  planId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  idempotencyKey: string;
  requestId: string;
}): Promise<{ hold_ref: string; expires_at: string }> {
  if (!HBX_API_KEY || !HBX_API_SECRET) {
    const error = new Error("HBX credentials are not configured");
    (error as { code?: string }).code = ERROR_CODES.AUTH_REQUIRED;
    throw error;
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = HBX_SIGNATURE_MOCK
    ? "mock-signature"
    : (await computeSignature(`${HBX_API_KEY}${HBX_API_SECRET}${timestamp}`))
      .toUpperCase();

  const endpoint = `${HBX_BASE.replace(/\/$/, "")}/hotel-api/1.0/bookings`;
  const body = {
    holder: { name: "Eco", surname: "Trips" },
    clientReference: params.idempotencyKey,
    rooms: [
      {
        rateKey: params.planId,
        paxes: buildPaxes(params.adults, params.children),
      },
    ],
    stay: {
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    },
  };

  const response = await retryWithBackoff(
    async (attempt) => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Api-Key": HBX_API_KEY,
            "X-Signature": signature,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });
        if (res.status === 429 || res.status >= 500) {
          const text = await res.clone().text();
          const error = new Error(
            `HBX hold status ${res.status}: ${text || res.statusText}`,
          );
          (error as { code?: string }).code = res.status === 429
            ? ERROR_CODES.RATE_LIMITED
            : ERROR_CODES.TRANSIENT_RETRY;
          if (attempt < 3) {
            (error as { retryable?: boolean }).retryable = true;
          }
          throw error;
        }
        return res;
      } catch (error) {
        const wrapped = error instanceof Error
          ? error
          : new Error(String(error));
        const hasRetryFlag =
          typeof (wrapped as { retryable?: boolean }).retryable === "boolean";
        if (!hasRetryFlag && attempt < 3) {
          (wrapped as { retryable?: boolean }).retryable = true;
        }
        if (!(wrapped as { code?: string }).code) {
          (wrapped as { code?: string }).code = ERROR_CODES.TRANSIENT_RETRY;
        }
        throw wrapped;
      }
    },
    {
      attempts: 3,
      baseDelayMs: 250,
      onRetry: ({ attempt, waitMs, error }) => {
        console.log(
          JSON.stringify({
            level: "WARN",
            event: "inventory.hold.retry",
            fn: "inventory-hold",
            request_id: params.requestId,
            attempt,
            wait_ms: waitMs,
            message: error.message,
          }),
        );
      },
    },
  );

  if (response.status === 429) {
    const error = new Error("HBX rate limit");
    (error as { code?: string }).code = ERROR_CODES.RATE_LIMITED;
    throw error;
  }

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`HBX hold failed: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  const booking = payload?.booking ?? payload?.bookings?.[0] ?? {};
  const holdRef = String(
    booking?.reference ?? booking?.referenceCode ?? crypto.randomUUID(),
  );
  const expiresAt = booking?.deadline ??
    new Date(Date.now() + 15 * 60 * 1000).toISOString();

  return {
    hold_ref: holdRef,
    expires_at: String(expiresAt),
  };
}

async function computeSignature(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function buildPaxes(adults: number, children: number) {
  const paxes: Array<Record<string, unknown>> = [];
  for (let i = 0; i < adults; i += 1) {
    paxes.push({ type: "AD", age: 30 });
  }
  for (let i = 0; i < children; i += 1) {
    paxes.push({ type: "CH", age: 8 });
  }
  return paxes;
}

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "inventory.hold",
      fn: "inventory-hold",
      ...fields,
    }),
  );
}
