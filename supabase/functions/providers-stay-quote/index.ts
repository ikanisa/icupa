import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  CircuitBreaker,
  retryWithBackoff,
  stableHash,
  TokenBucket,
} from "../_shared/inventory.ts";
import {
  MemoryCache,
  assertNonNegativeInteger,
  assertPositiveInteger,
  jsonResponse,
  logAudit,
  normalizeCurrency,
  requireIsoDate,
} from "../_shared/providers.ts";
import fixture from "../../../ops/fixtures/providers_stay_quote.json" assert { type: "json" };

type FixtureQuote = typeof fixture extends { quotes: infer T } ? T extends Array<infer U> ? U : never : never;

type StayQuote = {
  property_id: string;
  plan_code: string;
  currency: string;
  nights: number;
  check_in: string;
  check_out: string;
  rate: {
    base_cents: number;
    taxes_cents: number;
    fees_cents: number;
    total_cents: number;
  };
  inclusions: string[];
  cancellation_policy?: string;
  pax: {
    adults: number;
    children: number;
  };
};

type QuoteResponse = {
  ok: boolean;
  request_id: string;
  source: string;
  quote: StayQuote;
  cache?: {
    hit: boolean;
    stale: boolean;
    expires_at: string;
  };
};

const PROVIDERS_OFFLINE = Deno.env.get("PROVIDERS_OFFLINE") !== "0";
const CACHE_TTL_SECONDS = Number(Deno.env.get("PROVIDERS_STAY_QUOTE_CACHE_TTL_SECONDS") ?? "300");
const bucket = new TokenBucket({ capacity: 20, refillIntervalMs: 1000 });
const breaker = new CircuitBreaker({ failureThreshold: 4, coolDownMs: 60000 });
const cache = new MemoryCache<QuoteResponse>({ maxEntries: 120 });

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("providers-stay-quote");
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

  const propertyIdRaw = pickString(body, ["property_id", "propertyId", "id"]);
  const planCodeRaw = pickString(body, ["plan_code", "planCode", "rate_plan"]);
  const checkInRaw = pickString(body, ["check_in", "checkIn", "startDate"]);
  const checkOutRaw = pickString(body, ["check_out", "checkOut", "endDate"]);
  const currencyRaw = pickString(body, ["currency"]);
  const pax = pickObject(body, ["pax", "party", "travellers", "travelers"]);
  const adultsRaw = Number(pickNumber(pax, ["adults"])) || Number(body.adults ?? 0);
  const childrenRaw = Number(pickNumber(pax, ["children"])) || Number(body.children ?? 0);

  const errors: string[] = [];
  const propertyId = propertyIdRaw ?? "";
  if (!propertyId) {
    errors.push("property_id is required");
  }

  const planCode = planCodeRaw ?? "";
  if (!planCode) {
    errors.push("plan_code is required");
  }

  let checkIn = "";
  let checkOut = "";
  try {
    checkIn = requireIsoDate(checkInRaw ?? "", "check_in");
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    checkOut = requireIsoDate(checkOutRaw ?? "", "check_out");
  } catch (error) {
    errors.push((error as Error).message);
  }

  let currency = "USD";
  try {
    currency = normalizeCurrency(currencyRaw, "USD");
  } catch (error) {
    errors.push((error as Error).message);
  }

  let adults = 0;
  let children = 0;
  try {
    adults = assertPositiveInteger(Number.isFinite(adultsRaw) ? Math.trunc(adultsRaw) : 0, "adults");
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    children = assertNonNegativeInteger(Number.isFinite(childrenRaw) ? Math.trunc(childrenRaw) : 0, "children");
  } catch (error) {
    errors.push((error as Error).message);
  }

  const nights = computeNights(checkIn, checkOut);
  if (nights <= 0) {
    errors.push("check_out must be after check_in");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const params = {
    property_id: propertyId,
    plan_code: planCode,
    check_in: checkIn,
    check_out: checkOut,
    currency,
    pax: { adults, children },
  };

  const cacheKey = await stableHash(params);
  const cached = cache.get(cacheKey);
  if (cached) {
    return jsonResponse({
      ...cached,
      cache: {
        hit: true,
        stale: false,
        expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
      },
    });
  }

  if (!breaker.canRequest() && !PROVIDERS_OFFLINE) {
    const error = new Error("stay provider circuit open");
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  let quote: StayQuote;
  let source = "";
  try {
    if (PROVIDERS_OFFLINE) {
      quote = await retryWithBackoff(async () => loadFixtureQuote({
        propertyId,
        planCode,
        checkIn,
        checkOut,
        nights,
        currency,
        adults,
        children,
      }));
      source = "fixtures";
      breaker.recordSuccess();
    } else {
      bucket.consume();
      throw new Error("live stay supplier not configured");
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

  const response: QuoteResponse = {
    ok: true,
    request_id: requestId,
    source,
    quote,
    cache: {
      hit: false,
      stale: false,
      expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    },
  };

  cache.set(cacheKey, response, CACHE_TTL_SECONDS * 1000);

  logAudit("providers.stay.quote", {
    request_id: requestId,
    property_id: propertyId,
    plan_code: planCode,
    check_in: checkIn,
    check_out: checkOut,
    source,
  });

  return jsonResponse(response);
}, { fn: "providers-stay-quote", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function pickString(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function pickObject(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  for (const key of keys) {
    const value = source?.[key];
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function computeNights(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  if (Number.isNaN(inDate.getTime()) || Number.isNaN(outDate.getTime())) return 0;
  const diff = outDate.getTime() - inDate.getTime();
  return Math.round(diff / (24 * 60 * 60 * 1000));
}

function loadFixtureQuote(params: {
  propertyId: string;
  planCode: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  currency: string;
  adults: number;
  children: number;
}): StayQuote {
  const base = Array.isArray(fixture.quotes) ? fixture.quotes as FixtureQuote[] : [];
  const found = base.find((entry) =>
    String(entry.property_id ?? "").toLowerCase() === params.propertyId.toLowerCase() &&
    String(entry.plan_code ?? "").toLowerCase() === params.planCode.toLowerCase()
  ) ?? base[0];

  if (!found) {
    throw Object.assign(new Error("quote fixture missing"), { code: ERROR_CODES.UNKNOWN });
  }

  const rate = {
    base_cents: Number(found.rate?.base_cents ?? found.rate?.base ?? 0),
    taxes_cents: Number(found.rate?.taxes_cents ?? found.rate?.taxes ?? 0),
    fees_cents: Number(found.rate?.fees_cents ?? found.rate?.fees ?? 0),
    total_cents: Number(found.rate?.total_cents ?? found.rate?.total ?? 0),
  };

  return {
    property_id: params.propertyId,
    plan_code: params.planCode,
    currency: params.currency,
    nights: Math.max(1, params.nights),
    check_in: params.checkIn,
    check_out: params.checkOut,
    rate,
    inclusions: Array.isArray(found.inclusions)
      ? found.inclusions.map((item) => String(item))
      : [],
    cancellation_policy: found.cancellation_policy
      ? String(found.cancellation_policy)
      : undefined,
    pax: { adults: params.adults, children: params.children },
  } satisfies StayQuote;
}
