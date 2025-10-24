import { ERROR_CODES } from "../_obs/constants.ts";
import { healthResponse, withObs } from "../_obs/withObs.ts";
import { B2BAuthError, requireB2BKey } from "../b2b-auth/mod.ts";
import inventoryIndex from "../../../ops/fixtures/b2b_inventory_index.json" assert { type: "json" };

interface InventoryRecord {
  id: string;
  name: string;
  headline?: string;
  city?: string;
  country?: string;
  region?: string;
  tags?: string[];
  min_nights?: number;
  max_nights?: number;
  sleeps?: Record<string, unknown>;
  from_price_cents?: number;
  currency?: string;
  availability?: Record<string, unknown>;
  amenities?: string[];
  experiences?: string[];
  updated_at?: string;
}

const handler = withObs(async (req) => {
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("b2b-inventory");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  try {
    await requireB2BKey(req, { scopes: ["inventory.read"] });
  } catch (error) {
    if (error instanceof B2BAuthError) {
      return jsonResponse({ ok: false, error: error.code, message: error.message }, error.status);
    }
    throw error;
  }

  const page = clampNumber(url.searchParams.get("page"), 1);
  const pageSize = clampNumber(url.searchParams.get("page_size"), 20, 1, 100);
  const query = (url.searchParams.get("query") ?? "").toLowerCase();

  const filtered = (inventoryIndex as InventoryRecord[]).filter((record) =>
    matchesQuery(record, query)
  );

  const start = (page - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return jsonResponse({
    ok: true,
    page,
    page_size: pageSize,
    total: filtered.length,
    has_next_page: start + pageSize < filtered.length,
    items: paged.map(maskInventoryRecord),
  });
}, { fn: "b2b-inventory", defaultErrorCode: ERROR_CODES.AUTH_REQUIRED });

Deno.serve(handler);

export { handler };

function matchesQuery(record: InventoryRecord, query: string): boolean {
  if (!query) return true;
  const haystack = [
    record.name,
    record.headline,
    record.city,
    record.country,
    record.region,
    ...(Array.isArray(record.tags) ? record.tags : []),
  ]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function maskInventoryRecord(record: InventoryRecord) {
  return {
    id: record.id,
    name: record.name,
    headline: record.headline,
    location: {
      city: record.city,
      country: record.country,
      region: record.region,
    },
    tags: record.tags ?? [],
    min_nights: record.min_nights ?? null,
    max_nights: record.max_nights ?? null,
    sleeps: record.sleeps ?? null,
    from_price_cents: record.from_price_cents ?? null,
    currency: record.currency ?? "USD",
    availability: record.availability ?? {},
    amenities: record.amenities ?? [],
    experiences: record.experiences ?? [],
    updated_at: record.updated_at ?? null,
  };
}

function clampNumber(value: string | null, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
