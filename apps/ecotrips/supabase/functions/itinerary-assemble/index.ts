import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "itinerary-assemble" });

interface AssemblyItemInput {
  item_type?: unknown;
  itemType?: unknown;
  supplier_ref?: unknown;
  supplierRef?: unknown;
  start_at?: unknown;
  startAt?: unknown;
  end_at?: unknown;
  endAt?: unknown;
  price_cents?: unknown;
  priceCents?: unknown;
  currency?: unknown;
  currencyCode?: unknown;
  pax?: unknown;
}

interface AssemblyPayload {
  user_id?: unknown;
  userId?: unknown;
  currency?: unknown;
  currencyCode?: unknown;
  notes?: unknown;
  items?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("itinerary-assemble");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: AssemblyPayload;
  try {
    payload = (await req.json()) as AssemblyPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const userId = normalizeUuid(payload.user_id ?? payload.userId);
  const currency = normalizeCurrency(payload.currency ?? payload.currencyCode);
  const notes = typeof payload.notes === "string" ? payload.notes.trim() : undefined;
  const items = Array.isArray(payload.items) ? payload.items as AssemblyItemInput[] : [];

  if (!userId) {
    return jsonResponse({ ok: false, error: "user_id_required" }, 400);
  }

  if (!items.length) {
    return jsonResponse({ ok: false, error: "items_required" }, 400);
  }

  const normalizedItems = items.map((item, index) => normalizeItem(item, index)).filter((item) => item !== null);

  if (!normalizedItems.length) {
    return jsonResponse({ ok: false, error: "no_valid_items" }, 422);
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/assemble_itinerary`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify({
      user_id: userId,
      currency,
      notes,
      items: normalizedItems,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    console.error("assemble_itinerary_failed", {
      status: response.status,
      body: errorText,
      requestId,
    });
    return jsonResponse({ ok: false, error: "assemble_failed", request_id: requestId }, 502);
  }

  const result = await response.json() as Record<string, unknown>;
  return jsonResponse({ ok: true, request_id: requestId, result });
}, { fn: "itinerary-assemble", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function normalizeItem(item: AssemblyItemInput, index: number): Record<string, unknown> | null {
  const itemTypeRaw = item.item_type ?? item.itemType ?? "other";
  const itemType = typeof itemTypeRaw === "string" && itemTypeRaw.trim()
    ? itemTypeRaw.trim().toLowerCase()
    : "other";

  const supplierRefRaw = item.supplier_ref ?? item.supplierRef;
  const supplierRef = typeof supplierRefRaw === "string" && supplierRefRaw.trim()
    ? supplierRefRaw.trim()
    : undefined;

  const startRaw = item.start_at ?? item.startAt;
  const startAt = typeof startRaw === "string" && startRaw.trim() ? startRaw.trim() : undefined;

  const endRaw = item.end_at ?? item.endAt;
  const endAt = typeof endRaw === "string" && endRaw.trim() ? endRaw.trim() : undefined;

  const priceRaw = item.price_cents ?? item.priceCents;
  const priceCents = typeof priceRaw === "number"
    ? Math.max(0, Math.trunc(priceRaw))
    : typeof priceRaw === "string" && priceRaw.trim()
      ? Number.parseInt(priceRaw.trim(), 10)
      : 0;

  if (Number.isNaN(priceCents) || priceCents < 0) {
    console.warn("invalid_price_cents", { index, priceRaw });
    return null;
  }

  const currencyRaw = item.currency ?? item.currencyCode;
  const currency = normalizeCurrency(currencyRaw) ?? "USD";

  const pax = Array.isArray(item.pax) || typeof item.pax === "object" ? item.pax : [];

  return {
    item_type: itemType,
    supplier_ref: supplierRef,
    start_at: startAt,
    end_at: endAt,
    price_cents: priceCents,
    currency,
    pax,
  };
}

function normalizeUuid(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim();
  const uuidRegex = /^[0-9a-fA-F-]{36}$/;
  return uuidRegex.test(value) ? value : undefined;
}

function normalizeCurrency(input: unknown): string | undefined {
  if (typeof input !== "string") return undefined;
  const value = input.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(value) ? value : undefined;
}

function authorize(req: Request): boolean {
  const apiKey = req.headers.get("apikey") ?? req.headers.get("Apikey") ?? "";
  const bearer = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  return apiKey === SERVICE_ROLE_KEY || bearer === `Bearer ${SERVICE_ROLE_KEY}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
