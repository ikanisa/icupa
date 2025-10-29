import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  CircuitBreaker,
  getCachedResponse,
  retryWithBackoff,
  stableHash,
  TokenBucket,
  upsertCache,
} from "../_shared/inventory.ts";
import quoteFixture from "../../../ops/fixtures/inventory_quote.json" assert {
  type: "json",
};

const HBX_BASE = Deno.env.get("HBX_BASE") ?? "https://api.test.hotelbeds.com";
const HBX_API_KEY = Deno.env.get("HBX_API_KEY") ?? "";
const HBX_API_SECRET = Deno.env.get("HBX_API_SECRET") ?? "";
const HBX_SIGNATURE_MOCK = Deno.env.get("HBX_SIGNATURE_MOCK") === "1";
const INVENTORY_OFFLINE = Deno.env.get("INVENTORY_OFFLINE") === "1";
if (!INVENTORY_OFFLINE && (!HBX_API_KEY || !HBX_API_SECRET)) {
  throw new Error(
    "HBX_API_KEY and HBX_API_SECRET are required for inventory-quote. Set INVENTORY_OFFLINE=1 to rely on fixtures.",
  );
}
const INVENTORY_QUOTE_CACHE_TTL_SECONDS = Number(
  Deno.env.get("INVENTORY_QUOTE_CACHE_TTL_SECONDS") ?? "120",
);

const bucket = new TokenBucket({ capacity: 20, refillIntervalMs: 1000 });
const breaker = new CircuitBreaker({ failureThreshold: 5, coolDownMs: 60000 });

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("inventory-quote");
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

  const errors: string[] = [];
  if (!supplierHotelId) errors.push("supplier_hotel_id is required");
  if (!isValidDate(checkIn)) errors.push("check_in must be YYYY-MM-DD");
  if (!isValidDate(checkOut)) errors.push("check_out must be YYYY-MM-DD");
  if (!Number.isInteger(adults) || adults <= 0) {
    errors.push("pax.adults must be > 0");
  }
  if (!Number.isInteger(children) || children < 0) {
    errors.push("pax.children must be >= 0");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const params = {
    supplier_hotel_id: supplierHotelId,
    plan_id: planId,
    check_in: checkIn,
    check_out: checkOut,
    pax: { adults, children },
  };
  const paramsHash = await stableHash(params);
  const cacheKey = `quote:${paramsHash}`;
  const now = Date.now();

  const cached = await getCachedResponse(cacheKey).catch(() => null);
  const isFreshCache = cached && new Date(cached.expires_at).getTime() > now;
  if (isFreshCache) {
    const payload = buildQuoteResponse({
      requestId,
      source: "cache",
      quote: cached!.response, // stored normalized
      cache: {
        hit: true,
        stale: false,
        expires_at: cached!.expires_at,
      },
    });
    logAudit({
      requestId,
      source: "cache",
      supplier_hotel_id: supplierHotelId,
      circuit: breaker.state(),
      cache_hit: true,
      stale: false,
    });
    return jsonResponse(payload);
  }

  if (!breaker.canRequest()) {
    if (cached) {
      const payload = buildQuoteResponse({
        requestId,
        source: "cache-stale",
        quote: cached.response,
        cache: {
          hit: true,
          stale: true,
          expires_at: cached.expires_at,
        },
      });
      logAudit({
        requestId,
        source: "cache-stale",
        supplier_hotel_id: supplierHotelId,
        circuit: breaker.state(),
        cache_hit: true,
        stale: true,
      });
      return jsonResponse(payload, 200);
    }
    const error = new Error("inventory circuit open");
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  let responsePayload: ReturnType<typeof buildQuoteResponse> | null = null;
  let source = "";
  try {
    if (INVENTORY_OFFLINE) {
      const fixture = await loadQuoteFixture();
      const quote = { ...fixture, supplier_hotel_id: supplierHotelId };
      responsePayload = buildQuoteResponse({
        requestId,
        source: "fixtures",
        quote,
        cache: {
          hit: false,
          stale: false,
          expires_at: new Date(now + INVENTORY_QUOTE_CACHE_TTL_SECONDS * 1000)
            .toISOString(),
        },
      });
      breaker.recordSuccess();
    } else {
      bucket.consume();
      const providerQuote = await callHBXQuote({
        supplierHotelId,
        planId,
        checkIn,
        checkOut,
        adults,
        children,
        requestId,
      });
      responsePayload = buildQuoteResponse({
        requestId,
        source: "HBX",
        quote: providerQuote,
        cache: {
          hit: false,
          stale: false,
          expires_at: new Date(now + INVENTORY_QUOTE_CACHE_TTL_SECONDS * 1000)
            .toISOString(),
        },
      });
      breaker.recordSuccess();
    }
    source = responsePayload.source;
  } catch (error) {
    breaker.recordFailure();
    if (cached) {
      const payload = buildQuoteResponse({
        requestId,
        source: "cache-stale",
        quote: cached.response,
        cache: {
          hit: true,
          stale: true,
          expires_at: cached.expires_at,
        },
      });
      logAudit({
        requestId,
        source: "cache-stale",
        supplier_hotel_id: supplierHotelId,
        circuit: breaker.state(),
        cache_hit: true,
        stale: true,
        error: (error as Error).message,
      });
      return jsonResponse(payload, 200);
    }
    const wrapped = error instanceof Error ? error : new Error(String(error));
    if (!(wrapped as { code?: string }).code) {
      (wrapped as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    }
    throw wrapped;
  }

  if (responsePayload) {
    await upsertCache({
      cache_key: cacheKey,
      params_hash: paramsHash,
      response: responsePayload.quote,
      etag: null,
      expires_at: responsePayload.cache?.expires_at ??
        new Date(now + INVENTORY_QUOTE_CACHE_TTL_SECONDS * 1000).toISOString(),
    }).catch((error) => {
      console.log(JSON.stringify({
        level: "WARN",
        event: "inventory.quote.cache_error",
        fn: "inventory-quote",
        request_id: requestId,
        message: (error as Error).message,
      }));
    });

    logAudit({
      requestId,
      source,
      supplier_hotel_id: supplierHotelId,
      circuit: breaker.state(),
      cache_hit: false,
      stale: false,
    });
    return jsonResponse(responsePayload);
  }

  const fallback = new Error("inventory quote failed");
  (fallback as { code?: string }).code = ERROR_CODES.UNKNOWN;
  throw fallback;
}, { fn: "inventory-quote", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

async function loadQuoteFixture() {
  return quoteFixture as Record<string, unknown>;
}

async function callHBXQuote(params: {
  supplier_hotel_id: string;
  planId?: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  requestId: string;
}): Promise<Record<string, unknown>> {
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

  const endpoint = `${
    HBX_BASE.replace(/\/$/, "")
  }/hotel-api/1.0/bookings/availability`;
  const body = {
    stay: {
      checkIn: params.checkIn,
      checkOut: params.checkOut,
    },
    occupancies: [
      {
        adults: params.adults,
        children: params.children,
        paxes: [],
      },
    ],
    hotels: {
      hotel: [params.supplier_hotel_id],
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
            `HBX quote status ${res.status}: ${text || res.statusText}`,
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
            event: "inventory.quote.retry",
            fn: "inventory-quote",
            request_id: params.requestId,
            attempt,
            wait_ms: waitMs,
            message: error.message,
          }),
        );
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    const error = new Error(`HBX quote failed: ${text || response.statusText}`);
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  const offer = payload?.hotels?.[0]?.rooms?.[0]?.rates?.[0] ?? {};
  const nightly = Array.isArray(offer?.dailyRates)
    ? offer.dailyRates.map((rate: Record<string, unknown>) => ({
      date: String(rate?.date ?? params.checkIn),
      cents: Number(Math.round((rate?.amount ?? 0) * 100)),
    }))
    : [];
  const totalCents = Number(
    Math.round((offer?.net ?? offer?.sellingRate ?? 0) * 100),
  );

  return {
    supplier: "HBX",
    supplier_hotel_id: params.supplier_hotel_id,
    plan_id: String(offer?.rateKey ?? params.planId ?? ""),
    currency: String(offer?.currency ?? "USD"),
    nightly,
    total_cents: totalCents,
    refundable: Boolean(offer?.refundable ?? false),
    hold_supported: true,
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

function buildQuoteResponse(input: {
  requestId: string;
  source: string;
  quote: Record<string, unknown>;
  cache?: { hit: boolean; stale: boolean; expires_at: string };
}) {
  const nightly = Array.isArray(input.quote.nightly)
    ? input.quote.nightly.map((night: Record<string, unknown>) => ({
      date: night.date,
      cents: night.cents,
    }))
    : [];

  return {
    ok: true,
    supplier: "HBX",
    request_id: input.requestId,
    source: input.source,
    cache: input.cache,
    quote: {
      supplier_hotel_id: input.quote.supplier_hotel_id,
      plan_id: input.quote.plan_id,
      nightly,
      total_cents: input.quote.total_cents,
      currency: input.quote.currency,
      refundable: input.quote.refundable,
      hold_supported: input.quote.hold_supported,
    },
  };
}

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "inventory.quote",
      fn: "inventory-quote",
      ...fields,
    }),
  );
}
