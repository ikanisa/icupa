// Travel discovery ingestion using allowlisted Web Search endpoints and pgvector syncs.
import discoveryFixture from "../../../ops/fixtures/travel_discovery.json" with {
  type: "json",
};
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const USE_FIXTURES = (Deno.env.get("USE_FIXTURES") ?? "0") === "1";
const RAW_ALLOWLIST = Deno.env.get("TRAVEL_DISCOVERY_ALLOWLIST") ?? "";

const ALLOWLIST_MAP = parseAllowlist(RAW_ALLOWLIST);
const EMBEDDING_DIMS = 64;

interface SupplierShape {
  slug: string;
  name: string;
  licence_status?: string;
  licence_expires_at?: string;
}

interface DiscoveryShape {
  id: string;
  title: string;
  summary: string;
  url: string;
  location: string;
  start?: string;
  end?: string;
  supplier?: SupplierShape;
}

type DiscoveryMode = "poi" | "events";

type TravelTripRow = {
  id: string;
  discovery_key: string | null;
};

type TravelSupplierRow = {
  id: string;
  slug: string;
};

type UpsertedItem = {
  id: string;
  embedding: number[];
  item_kind: DiscoveryMode;
  summary: string;
  title: string;
  source_url: string;
  metadata: Record<string, unknown>;
  start_at?: string | null;
  end_at?: string | null;
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function parseAllowlist(raw: string): Map<string, URL> {
  const map = new Map<string, URL>();
  const pieces = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  for (const piece of pieces) {
    const [key, value] = piece.includes("=") ? piece.split("=") : ["default", piece];
    try {
      const url = new URL(value.trim());
      map.set(key.trim(), url);
    } catch (error) {
      console.warn(
        JSON.stringify({
          level: "WARN",
          fn: "travel-discovery",
          event: "allowlist.parse_failed",
          entry: piece,
          message: (error as Error).message,
        }),
      );
    }
  }
  return map;
}

function getAllowlistedEndpoint(mode: DiscoveryMode): URL | null {
  if (ALLOWLIST_MAP.size === 0) return null;
  if (ALLOWLIST_MAP.has(mode)) {
    return new URL(ALLOWLIST_MAP.get(mode)!.toString());
  }
  if (ALLOWLIST_MAP.has("default")) {
    return new URL(ALLOWLIST_MAP.get("default")!.toString());
  }
  return null;
}

function sanitizeLocation(input: string | null): string {
  if (!input) return "";
  return input.trim().slice(0, 120);
}

function normalizeItem(raw: unknown, mode: DiscoveryMode): DiscoveryShape | null {
  if (!raw || typeof raw !== "object") return null;
  const shape = raw as Record<string, unknown>;
  const id = typeof shape.id === "string" ? shape.id.trim() : crypto.randomUUID();
  const title = typeof shape.title === "string" ? shape.title.trim() : "";
  const summary = typeof shape.summary === "string" ? shape.summary.trim() : "";
  const url = typeof shape.url === "string" ? shape.url.trim() : "";
  const location = typeof shape.location === "string" ? shape.location.trim() : "";
  if (!title || !summary || !location) {
    return null;
  }
  let supplier: SupplierShape | undefined;
  if (shape.supplier && typeof shape.supplier === "object") {
    const rawSupplier = shape.supplier as Record<string, unknown>;
    const slug = typeof rawSupplier.slug === "string" ? rawSupplier.slug.trim() : "";
    const name = typeof rawSupplier.name === "string" ? rawSupplier.name.trim() : slug;
    if (slug && name) {
      supplier = {
        slug,
        name,
      };
      if (typeof rawSupplier.licence_status === "string") {
        supplier.licence_status = rawSupplier.licence_status.trim();
      }
      if (typeof rawSupplier.licence_expires_at === "string") {
        supplier.licence_expires_at = rawSupplier.licence_expires_at.slice(0, 10);
      }
    }
  }
  const item: DiscoveryShape = {
    id,
    title,
    summary,
    url,
    location,
    supplier,
  };
  if (mode === "events") {
    if (typeof shape.start === "string") {
      item.start = shape.start;
    }
    if (typeof shape.end === "string") {
      item.end = shape.end;
    }
  }
  return item;
}

function deterministicEmbedding(text: string, dims = EMBEDDING_DIMS): number[] {
  const buffer = new Float64Array(dims);
  const encoder = new TextEncoder();
  const encoded = encoder.encode(text.toLowerCase());
  for (let i = 0; i < encoded.length; i += 1) {
    const idx = i % dims;
    buffer[idx] += encoded[i] / 255;
  }
  const norm = Math.sqrt(buffer.reduce((acc, value) => acc + value * value, 0));
  if (norm === 0) {
    return Array.from({ length: dims }, () => 0);
  }
  return Array.from(buffer, (value) => Number((value / norm).toFixed(6)));
}

function averageEmbedding(vectors: number[][]): number[] | null {
  if (vectors.length === 0) return null;
  const dims = vectors[0]?.length ?? EMBEDDING_DIMS;
  const totals = new Array(dims).fill(0);
  for (const vector of vectors) {
    for (let i = 0; i < dims; i += 1) {
      totals[i] += vector[i] ?? 0;
    }
  }
  const divisor = vectors.length || 1;
  const averaged = totals.map((value) => value / divisor);
  const norm = Math.sqrt(averaged.reduce((acc, value) => acc + value * value, 0));
  if (norm === 0) return averaged;
  return averaged.map((value) => Number((value / norm).toFixed(6)));
}

async function fetchDiscovery(
  mode: DiscoveryMode,
  location: string,
  requestId: string,
): Promise<{ items: DiscoveryShape[]; source: string; fallback: boolean }>
{
  const normalisedLocation = sanitizeLocation(location);
  if (USE_FIXTURES) {
    const dataset = (discoveryFixture as Record<string, unknown>)[mode];
    const collection = Array.isArray(dataset) ? dataset : [];
    const items = collection
      .map((item) => normalizeItem(item, mode))
      .filter((item): item is DiscoveryShape => Boolean(item));
    return { items, source: "fixtures", fallback: true };
  }

  const endpoint = getAllowlistedEndpoint(mode);
  if (!endpoint) {
    const dataset = (discoveryFixture as Record<string, unknown>)[mode];
    const collection = Array.isArray(dataset) ? dataset : [];
    const items = collection
      .map((item) => normalizeItem(item, mode))
      .filter((item): item is DiscoveryShape => Boolean(item));
    return { items, source: "fixtures", fallback: true };
  }

  endpoint.searchParams.set("mode", mode);
  if (normalisedLocation) {
    endpoint.searchParams.set("q", normalisedLocation);
  }

  try {
    const response = await fetch(endpoint.toString(), {
      headers: {
        "user-agent": "travel-discovery/1.0",
      },
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn(
        JSON.stringify({
          level: "WARN",
          fn: "travel-discovery",
          event: "websearch.fetch_failed",
          requestId,
          status: response.status,
          body: text.slice(0, 256),
        }),
      );
      throw new Error(`Allowlisted search responded ${response.status}`);
    }
    const payload = await response.json();
    const collection = Array.isArray(payload) ? payload : (payload?.results ?? []);
    const items = (Array.isArray(collection) ? collection : [])
      .map((item) => normalizeItem(item, mode))
      .filter((item): item is DiscoveryShape => Boolean(item));
    return { items, source: new URL(endpoint.toString()).host, fallback: false };
  } catch (error) {
    const dataset = (discoveryFixture as Record<string, unknown>)[mode];
    const collection = Array.isArray(dataset) ? dataset : [];
    const items = collection
      .map((item) => normalizeItem(item, mode))
      .filter((item): item is DiscoveryShape => Boolean(item));
    console.warn(
      JSON.stringify({
        level: "WARN",
        fn: "travel-discovery",
        event: "websearch.fetch_exception",
        requestId,
        message: (error as Error).message,
      }),
    );
    return { items, source: "fixtures", fallback: true };
  }
}

async function upsertTrip(
  mode: DiscoveryMode,
  location: string,
  embedding: number[] | null,
  ingestionSource: string,
  requestId: string,
): Promise<TravelTripRow> {
  const config = getSupabaseServiceConfig({ feature: "travel-discovery" });
  const nowIso = new Date().toISOString();
  const discoveryKey = `${mode}:${location.toLowerCase()}`;
  const response = await fetch(
    `${config.url}/rest/v1/travel.trips?on_conflict=discovery_key`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        "Accept-Profile": "travel",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify([
        {
          discovery_key: discoveryKey,
          trip_name: `${location || "Unknown"} ${mode === "poi" ? "Highlights" : "Events"}`,
          trip_kind: "discovery",
          summary: `Discovery ingestion for ${location || "unknown"} (${mode}).`,
          ingestion_source: ingestionSource,
          last_ingested_at: nowIso,
          discovery_embedding: embedding,
        },
      ]),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to upsert travel.trips: ${text}`), {
      code: ERROR_CODES.UNKNOWN,
      requestId,
    });
  }
  const payload = (await response.json()) as TravelTripRow[];
  if (!payload[0]) {
    throw Object.assign(new Error("Upserted trip missing response"), {
      code: ERROR_CODES.UNKNOWN,
      requestId,
    });
  }
  return payload[0];
}

async function upsertItineraryItems(
  tripId: string,
  mode: DiscoveryMode,
  items: UpsertedItem[],
  requestId: string,
): Promise<void> {
  if (items.length === 0) return;
  const config = getSupabaseServiceConfig({ feature: "travel-discovery" });
  const payload = items.map((item) => ({
    trip_id: tripId,
    item_kind: item.item_kind,
    title: item.title,
    summary: item.summary,
    source_url: item.source_url,
    metadata: item.metadata,
    start_at: item.start_at ?? null,
    end_at: item.end_at ?? null,
    embedding: item.embedding,
  }));
  const response = await fetch(
    `${config.url}/rest/v1/travel.itinerary_items?on_conflict=trip_id,source_url`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        "Accept-Profile": "travel",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to upsert itinerary items: ${text}`), {
      code: ERROR_CODES.UNKNOWN,
      requestId,
    });
  }
}

async function syncSuppliers(
  items: UpsertedItem[],
  ingestionSource: string,
  requestId: string,
): Promise<Map<string, string>> {
  const config = getSupabaseServiceConfig({ feature: "travel-discovery" });
  const nowIso = new Date().toISOString();
  const grouped = new Map<string, { name: string; status?: string; expires?: string; vectors: number[][] }>();
  for (const item of items) {
    const supplier = item.metadata.supplier as SupplierShape | undefined;
    if (!supplier) continue;
    const bucket = grouped.get(supplier.slug) ?? {
      name: supplier.name,
      status: supplier.licence_status,
      expires: supplier.licence_expires_at,
      vectors: [],
    };
    bucket.status = supplier.licence_status ?? bucket.status;
    bucket.expires = supplier.licence_expires_at ?? bucket.expires;
    bucket.vectors.push(item.embedding);
    grouped.set(supplier.slug, bucket);
  }
  if (grouped.size === 0) return new Map();
  const payload = Array.from(grouped.entries()).map(([slug, value]) => ({
    slug,
    display_name: value.name,
    licence_status: value.status ?? "pending",
    licence_expires_at: value.expires ?? null,
    ingestion_source: ingestionSource,
    last_ingested_at: nowIso,
    catalogue_embedding: averageEmbedding(value.vectors),
  }));
  const response = await fetch(
    `${config.url}/rest/v1/travel.suppliers?on_conflict=slug`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        "Accept-Profile": "travel",
        Prefer: "return=representation,resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to upsert suppliers: ${text}`), {
      code: ERROR_CODES.UNKNOWN,
      requestId,
    });
  }
  const rows = (await response.json()) as TravelSupplierRow[];
  const mapping = new Map<string, string>();
  for (const row of rows) {
    mapping.set(row.slug, row.id);
  }
  return mapping;
}

async function upsertReservations(
  tripId: string,
  items: UpsertedItem[],
  supplierMap: Map<string, string>,
  requestId: string,
): Promise<void> {
  const eventItems = items.filter((item) => item.item_kind === "events");
  if (eventItems.length === 0) return;
  const config = getSupabaseServiceConfig({ feature: "travel-discovery" });
  const payload = eventItems.map((item) => {
    const supplier = item.metadata.supplier as SupplierShape | undefined;
    const supplierId = supplier ? supplierMap.get(supplier.slug) ?? null : null;
    return {
      trip_id: tripId,
      supplier_id: supplierId,
      reservation_kind: "hold",
      status: "tentative",
      confirmation_code: null,
      external_ref: item.id,
      booked_at: new Date().toISOString(),
      hold_expires_at: item.end_at ?? null,
      inventory_reference: item.metadata.url ?? null,
      embedding: item.embedding,
    };
  });
  const response = await fetch(
    `${config.url}/rest/v1/travel.reservations?on_conflict=trip_id,external_ref`,
    {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        "Accept-Profile": "travel",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw Object.assign(new Error(`Failed to upsert reservations: ${text}`), {
      code: ERROR_CODES.UNKNOWN,
      requestId,
    });
  }
}

function buildItems(
  mode: DiscoveryMode,
  results: DiscoveryShape[],
  location: string,
): UpsertedItem[] {
  const items: UpsertedItem[] = [];
  for (const result of results) {
    const baseText = `${result.title} ${result.summary} ${result.location} ${mode}`;
    const embedding = deterministicEmbedding(baseText);
    const sourceUrl = result.url && result.url.length > 0 ? result.url : `internal:${result.id}`;
    items.push({
      id: result.id,
      item_kind: mode,
      title: result.title,
      summary: result.summary,
      source_url: sourceUrl,
      metadata: {
        location: result.location,
        url: result.url ?? null,
        supplier: result.supplier ?? null,
        mode,
        discovery_location: location,
      },
      start_at: result.start ?? null,
      end_at: result.end ?? null,
      embedding,
    });
  }
  return items;
}

Deno.serve(
  withObs(async (req) => {
    const requestId = getRequestId(req) ?? crypto.randomUUID();
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname.endsWith("/health")) {
      const health = healthResponse("travel-discovery");
      const payload = await health.json();
      return jsonResponse(payload);
    }

    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "method_not_allowed" }, { status: 405 });
    }

    const bodyText = await req.text();
    if (!bodyText) {
      return jsonResponse({ ok: false, error: "empty_payload" }, { status: 400 });
    }

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(bodyText) as Record<string, unknown>;
    } catch (_err) {
      return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const mode = payload.mode === "events" ? "events" : "poi";
    const location = typeof payload.location === "string" ? payload.location : "";

    const { items: rawItems, source, fallback } = await fetchDiscovery(mode, location, requestId);
    const items = buildItems(mode, rawItems, location);
    const tripEmbedding = averageEmbedding(items.map((item) => item.embedding));

    const trip = await upsertTrip(mode, location, tripEmbedding, source, requestId);
    await upsertItineraryItems(trip.id, mode, items, requestId);
    const supplierMap = await syncSuppliers(items, source, requestId);
    await upsertReservations(trip.id, items, supplierMap, requestId);

    console.log(
      JSON.stringify({
        level: "AUDIT",
        fn: "travel-discovery",
        event: "travel.discovery.ingested",
        requestId,
        mode,
        location,
        items: items.length,
        suppliers: supplierMap.size,
        fallback,
      }),
    );

    return jsonResponse({
      ok: true,
      request_id: requestId,
      mode,
      location,
      ingested: items.length,
      suppliers: supplierMap.size,
      fallback,
    });
  }, { fn: "travel-discovery", defaultErrorCode: ERROR_CODES.UNKNOWN }),
);
