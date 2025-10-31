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
import searchFixtures from "../../../ops/fixtures/inventory_search_kigali.json" assert {
  type: "json",
};

const HBX_BASE = Deno.env.get("HBX_BASE") ?? "https://api.test.hotelbeds.com";
const HBX_API_KEY = Deno.env.get("HBX_API_KEY") ?? "";
const HBX_API_SECRET = Deno.env.get("HBX_API_SECRET") ?? "";
const HBX_SIGNATURE_MOCK = Deno.env.get("HBX_SIGNATURE_MOCK") === "1";
const INVENTORY_OFFLINE = Deno.env.get("INVENTORY_OFFLINE") === "1";
if (!INVENTORY_OFFLINE && (!HBX_API_KEY || !HBX_API_SECRET)) {
  throw new Error(
    "HBX_API_KEY and HBX_API_SECRET are required for inventory-search. Set INVENTORY_OFFLINE=1 to rely on fixtures.",
  );
}
const INVENTORY_CACHE_TTL_SECONDS = Number(
  Deno.env.get("INVENTORY_CACHE_TTL_SECONDS") ?? "600",
);
const RATE_LIMIT_CAPACITY = Number(
  Deno.env.get("INVENTORY_RATE_LIMIT") ?? "30",
);
const RATE_LIMIT_REFILL_MS = Number(
  Deno.env.get("INVENTORY_RATE_LIMIT_REFILL_MS") ?? "1000",
);

const bucket = new TokenBucket({
  capacity: RATE_LIMIT_CAPACITY,
  refillIntervalMs: RATE_LIMIT_REFILL_MS,
});

const breaker = new CircuitBreaker({
  failureThreshold: 5,
  coolDownMs: Number(Deno.env.get("INVENTORY_CIRCUIT_COOLDOWN_MS") ?? "60000"),
});

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("inventory-search");
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

  const city = typeof body.city === "string" ? body.city.trim() : "";
  const checkIn = typeof body.check_in === "string" ? body.check_in : "";
  const checkOut = typeof body.check_out === "string" ? body.check_out : "";
  const pax = typeof body.pax === "object" && body.pax !== null
    ? body.pax as Record<string, unknown>
    : {};
  const adults = Number(pax.adults ?? 0);
  const children = Number(pax.children ?? 0);

  const errors: string[] = [];
  if (!city) errors.push("city is required");
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
    city,
    check_in: checkIn,
    check_out: checkOut,
    pax: { adults, children },
  };
  const paramsHash = await stableHash(params);
  const cacheKey = `search:${paramsHash}`;
  const now = Date.now();

  const cached = await getCachedResponse(cacheKey).catch((error) => {
    console.log(JSON.stringify({
      level: "WARN",
      event: "inventory.cache.error",
      fn: "inventory-search",
      request_id: requestId,
      message: (error as Error).message,
    }));
    return null;
  });

  const isFreshCache = cached && new Date(cached.expires_at).getTime() > now;
  if (isFreshCache) {
    const payload = buildSearchResponse({
      requestId,
      source: "cache",
      items: cached!.response.items as Array<Record<string, unknown>>,
      cache: {
        hit: true,
        stale: false,
        expires_at: cached!.expires_at,
      },
    });
    logAudit({
      requestId,
      source: "cache",
      city,
      checkIn,
      checkOut,
      items: payload.items.length,
      circuit: breaker.state(),
      cache_hit: true,
      stale: false,
    });
    return jsonResponse(payload);
  }

  if (!breaker.canRequest()) {
    if (cached) {
      const payload = buildSearchResponse({
        requestId,
        source: "cache-stale",
        items: cached.response.items as Array<Record<string, unknown>>,
        cache: {
          hit: true,
          stale: true,
          expires_at: cached.expires_at,
        },
      });
      logAudit({
        requestId,
        source: "cache-stale",
        city,
        checkIn,
        checkOut,
        items: payload.items.length,
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

  let responsePayload: ReturnType<typeof buildSearchResponse> | null = null;
  let source = "";
  try {
    if (INVENTORY_OFFLINE) {
      const fixture = await loadFixture(city);
      responsePayload = buildSearchResponse({
        requestId,
        source: "fixtures",
        items: fixture.items,
        cache: {
          hit: false,
          stale: false,
          expires_at: new Date(now + INVENTORY_CACHE_TTL_SECONDS * 1000)
            .toISOString(),
        },
      });
      breaker.recordSuccess();
    } else {
      bucket.consume();
      const providerResponse = await callHBXSearch({
        city,
        checkIn,
        checkOut,
        adults,
        children,
        requestId,
      });
      responsePayload = buildSearchResponse({
        requestId,
        source: "HBX",
        items: providerResponse.items,
        cache: {
          hit: false,
          stale: false,
          expires_at: new Date(now + INVENTORY_CACHE_TTL_SECONDS * 1000)
            .toISOString(),
        },
      });
      breaker.recordSuccess();
    }
    source = responsePayload.source;
  } catch (error) {
    breaker.recordFailure();
    if (cached) {
      const payload = buildSearchResponse({
        requestId,
        source: "cache-stale",
        items: cached.response.items as Array<Record<string, unknown>>,
        cache: {
          hit: true,
          stale: true,
          expires_at: cached.expires_at,
        },
      });
      logAudit({
        requestId,
        source: "cache-stale",
        city,
        checkIn,
        checkOut,
        items: payload.items.length,
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
      response: {
        supplier: responsePayload.supplier,
        items: responsePayload.items,
      },
      etag: null,
      expires_at: responsePayload.cache?.expires_at ??
        new Date(now + INVENTORY_CACHE_TTL_SECONDS * 1000).toISOString(),
    }).catch((error) => {
      console.log(JSON.stringify({
        level: "WARN",
        event: "inventory.cache.write_error",
        fn: "inventory-search",
        request_id: requestId,
        message: (error as Error).message,
      }));
    });

    logAudit({
      requestId,
      source,
      city,
      checkIn,
      checkOut,
      items: responsePayload.items.length,
      circuit: breaker.state(),
      cache_hit: false,
      stale: false,
    });
    return jsonResponse(responsePayload);
  }

  const fallback = new Error("inventory search failed");
  (fallback as { code?: string }).code = ERROR_CODES.UNKNOWN;
  throw fallback;
}, { fn: "inventory-search", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

async function loadFixture(city: string) {
  const fixture = searchFixtures as {
    supplier: string;
    items: Array<Record<string, unknown>>;
  };
  const items = fixture.items.filter((item) => {
    const itemCity = typeof item.city === "string"
      ? item.city.toLowerCase()
      : "";
    return itemCity === city.toLowerCase();
  });
  return {
    supplier: fixture.supplier,
    items: items.length > 0 ? items : fixture.items,
  };
}

async function callHBXSearch(params: {
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  requestId: string;
}) {
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

  const query = new URLSearchParams({
    destination: params.city,
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    occupancy: JSON.stringify([{
      adults: params.adults,
      children: params.children,
    }]),
  });
  const endpoint = `${
    HBX_BASE.replace(/\/$/, "")
  }/hotel-api/1.0/hotels?${query.toString()}`;

  const response = await retryWithBackoff(
    async (attempt) => {
      try {
        const res = await fetch(endpoint, {
          method: "GET",
          headers: {
            "Api-Key": HBX_API_KEY,
            "X-Signature": signature,
            "Content-Type": "application/json",
          },
        });
        if (res.status === 429 || res.status >= 500) {
          const text = await res.clone().text();
          const error = new Error(
            `HBX search status ${res.status}: ${text || res.statusText}`,
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
            event: "inventory.search.retry",
            fn: "inventory-search",
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
    const error = new Error(
      `HBX search failed: ${text || response.statusText}`,
    );
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const payload = await response.json();
  const hotels = Array.isArray(payload?.hotels) ? payload.hotels : [];
  const normalized = hotels.map((hotel: Record<string, unknown>) => ({
    supplier_hotel_id: String(hotel?.code ?? hotel?.id ?? ""),
    name: String(hotel?.name ?? hotel?.hotel_name ?? ""),
    city: String(hotel?.destination?.name ?? hotel?.city ?? params.city),
    price_cents: Number(
      Math.round((hotel?.minRate ?? hotel?.price ?? 0) * 100),
    ),
    currency: String(hotel?.currency ?? "USD"),
    refundable: Boolean(
      hotel?.rates?.[0]?.refundable ?? hotel?.refundable ?? false,
    ),
  })).filter((item) => item.supplier_hotel_id);

  return {
    supplier: "HBX",
    items: normalized,
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

function buildSearchResponse(input: {
  requestId: string;
  source: string;
  items: Array<Record<string, unknown>>;
  cache?: { hit: boolean; stale: boolean; expires_at: string };
}) {
  return {
    ok: true,
    supplier: "HBX",
    request_id: input.requestId,
    source: input.source,
    cache: input.cache,
    items: input.items.map((item) => ({
      supplier_hotel_id: item.supplier_hotel_id,
      name: item.name,
      city: item.city,
      price_cents: item.price_cents,
      currency: item.currency,
      refundable: item.refundable,
    })),
  };
}

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "inventory.search",
      fn: "inventory-search",
      ...fields,
    }),
  );
}
