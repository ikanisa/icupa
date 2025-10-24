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
  normalizeIata,
  requireIsoDate,
} from "../_shared/providers.ts";
import fixture from "../../../ops/fixtures/providers_air_search.json" assert { type: "json" };

type FixtureOffer = typeof fixture extends { offers: infer T } ? T extends Array<infer U> ? U : never : never;

type FlightSegment = {
  origin: string;
  destination: string;
  departure_at: string;
  arrival_at: string;
  duration_minutes: number;
  cabin: string;
  fare_class: string;
  carrier: string;
  flight_number: string;
};

type FlightOffer = {
  id: string;
  carrier: string;
  flight_number: string;
  segments: FlightSegment[];
  price: {
    currency: string;
    base_cents: number;
    taxes_cents: number;
    total_cents: number;
  };
  baggage?: Record<string, unknown>;
  seats_remaining?: number;
  refundable?: boolean;
};

type SearchResponse = {
  ok: boolean;
  request_id: string;
  source: string;
  offers: FlightOffer[];
  cache?: {
    hit: boolean;
    stale: boolean;
    expires_at: string;
  };
};

const PROVIDERS_OFFLINE = Deno.env.get("PROVIDERS_OFFLINE") !== "0";
const CACHE_TTL_SECONDS = Number(Deno.env.get("PROVIDERS_AIR_CACHE_TTL_SECONDS") ?? "900");
const bucket = new TokenBucket({ capacity: 20, refillIntervalMs: 1000 });
const breaker = new CircuitBreaker({ failureThreshold: 4, coolDownMs: 60000 });
const cache = new MemoryCache<SearchResponse>({ maxEntries: 150 });

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("providers-air-search");
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

  const originRaw = pickString(body, ["origin", "origin_code", "originCode"]);
  const destinationRaw = pickString(body, ["destination", "destination_code", "destinationCode"]);
  const departureRaw = pickString(body, ["departure_date", "departureDate", "depart"]);
  const returnRaw = pickString(body, ["return_date", "returnDate", "return"]);
  const currencyRaw = pickString(body, ["currency"]);

  const pax = pickObject(body, ["travelers", "pax", "party"]);
  const adultsRaw = Number(pickNumber(pax, ["adults"])) || Number(body.adults ?? body.Adults ?? 0);
  const childrenRaw = Number(pickNumber(pax, ["children"])) || Number(body.children ?? body.Children ?? 0);

  const errors: string[] = [];
  let origin = "";
  let destination = "";
  let departureDate = "";
  let returnDate: string | undefined;
  let currency = "USD";
  let adults = 0;
  let children = 0;

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

  if (origin && destination && origin === destination) {
    errors.push("origin and destination must differ");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const params = {
    origin,
    destination,
    departure_date: departureDate,
    return_date: returnDate ?? null,
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
    const error = new Error("air provider circuit open");
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  let offers: FlightOffer[] = [];
  let source = "";
  try {
    if (PROVIDERS_OFFLINE) {
      offers = await retryWithBackoff(async () => {
        cache.purgeExpired();
        return loadFixtureOffers({ origin, destination, departureDate, returnDate, currency });
      });
      source = "fixtures";
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

  const response: SearchResponse = {
    ok: true,
    request_id: requestId,
    source,
    offers,
    cache: {
      hit: false,
      stale: false,
      expires_at: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString(),
    },
  };

  cache.set(cacheKey, response, CACHE_TTL_SECONDS * 1000);

  logAudit("providers.air.search", {
    request_id: requestId,
    origin,
    destination,
    departure_date: departureDate,
    return_date: returnDate ?? null,
    offers: offers.length,
    source,
  });

  return jsonResponse(response);
}, { fn: "providers-air-search", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

function pickObject(
  source: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  for (const key of keys) {
    const value = source?.[key];
    if (value && typeof value === "object") {
      return value as Record<string, unknown>;
    }
  }
  return {};
}

function pickNumber(
  source: Record<string, unknown>,
  keys: string[],
): number | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function loadFixtureOffers(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  currency: string;
}): FlightOffer[] {
  const base = Array.isArray(fixture.offers) ? fixture.offers as FixtureOffer[] : [];
  const candidates = base.filter((offer) => {
    return offer.origin?.toUpperCase() === params.origin &&
      offer.destination?.toUpperCase() === params.destination;
  });
  const source = candidates.length > 0 ? candidates : base;

  return source.map((offer) => formatOffer(offer, params, candidates.length > 0));
}

function formatOffer(
  offer: FixtureOffer,
  params: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    currency: string;
  },
  matched: boolean,
): FlightOffer {
  const segments = Array.isArray(offer.segments)
    ? offer.segments
    : [];

  const formattedSegments = segments.map((segment, index) => {
    const isReturn = index > 0;
    const date = isReturn && params.returnDate ? params.returnDate : params.departureDate;
    const departureAt = combine(date, segment?.departure_time_local ?? "08:00");
    const arrivalAt = combine(date, segment?.arrival_time_local ?? "10:00");
    return {
      origin: matched ? String(segment?.origin ?? params.origin) : isReturn ? params.destination : params.origin,
      destination: matched
        ? String(segment?.destination ?? (isReturn ? params.origin : params.destination))
        : isReturn
        ? params.origin
        : params.destination,
      departure_at: departureAt,
      arrival_at: arrivalAt,
      duration_minutes: Number(segment?.duration_minutes ?? 120),
      cabin: String(segment?.cabin ?? "economy"),
      fare_class: String(segment?.fare_class ?? "Y"),
      carrier: String(segment?.carrier ?? offer.carrier ?? "Unknown"),
      flight_number: String(segment?.flight_number ?? offer.flight_number ?? "000"),
    } satisfies FlightSegment;
  });

  return {
    id: String(offer.id ?? crypto.randomUUID()),
    carrier: String(offer.carrier ?? formattedSegments[0]?.carrier ?? "Unknown"),
    flight_number: String(offer.flight_number ?? formattedSegments[0]?.flight_number ?? "000"),
    segments: formattedSegments,
    price: {
      currency: params.currency,
      base_cents: Number(offer.price?.base_cents ?? offer.price?.base ?? offer.price?.baseCents ?? 0),
      taxes_cents: Number(offer.price?.taxes_cents ?? offer.price?.taxes ?? 0),
      total_cents: Number(offer.price?.total_cents ?? offer.price?.total ?? 0),
    },
    baggage: typeof offer.baggage === "object" ? offer.baggage as Record<string, unknown> : undefined,
    seats_remaining: Number(offer.seats_remaining ?? offer.seatsRemaining ?? 0) || undefined,
    refundable: typeof offer.refundable === "boolean" ? offer.refundable : undefined,
  } satisfies FlightOffer;
}

function combine(date: string, time: string): string {
  const normalized = time && /^(\d{2}:\d{2})/.test(time)
    ? `${RegExp.$1}:00`
    : "08:00:00";
  return `${date}T${normalized}Z`;
}
