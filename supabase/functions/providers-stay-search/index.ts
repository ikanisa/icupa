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
import fixture from "../../../ops/fixtures/providers_stay_search.json" assert { type: "json" };

type FixtureProperty = typeof fixture extends { properties: infer T } ? T extends Array<infer U> ? U : never : never;

type StayOption = {
  id: string;
  name: string;
  city: string;
  neighborhood?: string;
  supplier?: string;
  currency: string;
  nightly_rate_cents: number;
  total_cents: number;
  check_in: string;
  check_out: string;
  nights: number;
  amenities: string[];
  images: string[];
  rating?: number;
  review_count?: number;
};

type SearchResponse = {
  ok: boolean;
  request_id: string;
  source: string;
  properties: StayOption[];
  cache?: {
    hit: boolean;
    stale: boolean;
    expires_at: string;
  };
};

const PROVIDERS_OFFLINE = Deno.env.get("PROVIDERS_OFFLINE") !== "0";
const CACHE_TTL_SECONDS = Number(Deno.env.get("PROVIDERS_STAY_CACHE_TTL_SECONDS") ?? "900");
const bucket = new TokenBucket({ capacity: 30, refillIntervalMs: 1000 });
const breaker = new CircuitBreaker({ failureThreshold: 5, coolDownMs: 60000 });
const cache = new MemoryCache<SearchResponse>({ maxEntries: 120 });

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("providers-stay-search");
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

  const cityRaw = pickString(body, ["city", "destination", "location"]);
  const checkInRaw = pickString(body, ["check_in", "checkIn", "startDate"]);
  const checkOutRaw = pickString(body, ["check_out", "checkOut", "endDate"]);
  const currencyRaw = pickString(body, ["currency"]);
  const pax = pickObject(body, ["pax", "party", "travellers", "travelers"]);
  const adultsRaw = Number(pickNumber(pax, ["adults"])) || Number(body.adults ?? 0);
  const childrenRaw = Number(pickNumber(pax, ["children"])) || Number(body.children ?? 0);

  const errors: string[] = [];
  const city = typeof cityRaw === "string" && cityRaw.trim() ? cityRaw.trim() : "";
  if (!city) {
    errors.push("city is required");
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
    city: city.toLowerCase(),
    check_in: checkIn,
    check_out: checkOut,
    pax: { adults, children },
    currency,
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

  let properties: StayOption[] = [];
  let source = "";
  try {
    if (PROVIDERS_OFFLINE) {
      properties = await retryWithBackoff(async () => loadFixtureProperties({
        city,
        checkIn,
        checkOut,
        nights,
        currency,
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

  const response: SearchResponse = {
    ok: true,
    request_id: requestId,
    source,
    properties,
    cache: {
      hit: false,
      stale: false,
      expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    },
  };

  cache.set(cacheKey, response, CACHE_TTL_SECONDS * 1000);

  logAudit("providers.stay.search", {
    request_id: requestId,
    city,
    check_in: checkIn,
    check_out: checkOut,
    properties: properties.length,
    source,
  });

  return jsonResponse(response);
}, { fn: "providers-stay-search", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

function loadFixtureProperties(params: {
  city: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  currency: string;
}): StayOption[] {
  const base = Array.isArray(fixture.properties) ? fixture.properties as FixtureProperty[] : [];
  const normalizedCity = params.city.toLowerCase();
  const filtered = base.filter((property) =>
    String(property.city ?? "").toLowerCase() === normalizedCity
  );
  const source = filtered.length > 0 ? filtered : base;

  return source.map((property) => formatProperty(property, params));
}

function formatProperty(
  property: FixtureProperty,
  params: {
    city: string;
    checkIn: string;
    checkOut: string;
    nights: number;
    currency: string;
  },
): StayOption {
  const nightly = Number(property.starting_price_cents ?? property.nightly_rate_cents ?? 0);
  const total = nightly * Math.max(1, params.nights);
  const amenities = Array.isArray(property.amenities)
    ? property.amenities.map((item) => String(item))
    : [];
  const images = Array.isArray(property.images)
    ? property.images.map((item) => String(item))
    : [];

  return {
    id: String(property.id ?? crypto.randomUUID()),
    name: String(property.name ?? "Stay option"),
    city: String(property.city ?? params.city),
    neighborhood: property.neighborhood ? String(property.neighborhood) : undefined,
    supplier: property.supplier ? String(property.supplier) : undefined,
    currency: params.currency,
    nightly_rate_cents: nightly,
    total_cents: total,
    check_in: params.checkIn,
    check_out: params.checkOut,
    nights: Math.max(1, params.nights),
    amenities,
    images,
    rating: property.rating ? Number(property.rating) : undefined,
    review_count: property.review_count ? Number(property.review_count) : undefined,
  } satisfies StayOption;
}
