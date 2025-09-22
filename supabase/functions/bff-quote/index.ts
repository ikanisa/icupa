import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { healthResponse, withObs } from "../_obs/withObs.ts";

const BASE_TOTAL_CENTS = 10000;
const PER_ITEM_CENTS = 2500;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
  "";
const INVENTORY_REQUEST_TIMEOUT_MS = Number(
  Deno.env.get("INVENTORY_BFF_TIMEOUT_MS") ?? "4500",
);

interface InventorySearchResult {
  ok?: boolean;
  supplier?: string;
  source?: string;
  cache?: Record<string, unknown> | null;
  items?: Array<Record<string, unknown>>;
}

interface InventoryQuoteResult {
  ok?: boolean;
  supplier?: string;
  source?: string;
  cache?: Record<string, unknown> | null;
  quote?: Record<string, unknown>;
}

const handler = withObs(async (req) => {
  const url = new URL(req.url);
  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("bff-quote");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    const body = await req.json().catch(() => ({}));
    const items = Array.isArray(body?.items) ? body.items : [];
    let total_cents = BASE_TOTAL_CENTS + items.length * PER_ITEM_CENTS;
    let currency = "USD";

    const city = typeof body?.city === "string" ? body.city.trim() : "";
    const checkIn = typeof body?.check_in === "string" ? body.check_in : "";
    const checkOut = typeof body?.check_out === "string" ? body.check_out : "";
    const pax = typeof body?.pax === "object" && body.pax !== null
      ? body.pax as Record<string, unknown>
      : {};
    const adults = normalizeCount(pax.adults, 2, 1);
    const children = normalizeCount(pax.children, 0, 0);
    const preferredHotelId = typeof body?.supplier_hotel_id === "string"
      ? body.supplier_hotel_id
      : undefined;
    const preferredPlanId = typeof body?.plan_id === "string"
      ? body.plan_id
      : undefined;

    let inventoryAttachment: Record<string, unknown> | null = null;

    if (city && isValidDate(checkIn) && isValidDate(checkOut)) {
      const inventory = await maybeFetchInventory({
        requestId,
        city,
        checkIn,
        checkOut,
        adults,
        children,
        preferredHotelId,
        preferredPlanId,
      });
      if (inventory) {
        total_cents = inventory.total_cents;
        currency = inventory.currency;
        inventoryAttachment = inventory.attachment;
      }
    }

    const payload: Record<string, unknown> = {
      ok: true,
      quote: {
        total_cents,
        currency,
        items,
      },
    };

    if (inventoryAttachment) {
      (payload.quote as Record<string, unknown>).inventory =
        inventoryAttachment;
    }

    return jsonResponse(payload);
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "bff-quote" });

serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function normalizeCount(value: unknown, fallback: number, min: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.trunc(parsed));
}

function isValidDate(value: string): boolean {
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) &&
    !Number.isNaN(new Date(value).getTime());
}

async function maybeFetchInventory(input: {
  requestId: string;
  city: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  preferredHotelId?: string;
  preferredPlanId?: string;
}): Promise<
  {
    total_cents: number;
    currency: string;
    attachment: Record<string, unknown>;
  } | null
> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return null;

  try {
    const searchPayload = {
      city: input.city,
      check_in: input.checkIn,
      check_out: input.checkOut,
      pax: { adults: input.adults, children: input.children },
    };
    const search = await invokeInventory<InventorySearchResult>(
      "inventory-search",
      searchPayload,
      input.requestId,
    );

    if (
      !search?.ok || !Array.isArray(search.items) || search.items.length === 0
    ) {
      console.log(
        JSON.stringify({
          level: "INFO",
          event: "bff.quote.inventory_empty",
          request_id: input.requestId,
          city: input.city,
          check_in: input.checkIn,
          check_out: input.checkOut,
        }),
      );
      return null;
    }

    const target = resolveHotel(search.items, input.preferredHotelId);
    const quotePayload: Record<string, unknown> = {
      supplier_hotel_id: target.supplier_hotel_id,
      check_in: input.checkIn,
      check_out: input.checkOut,
      pax: { adults: input.adults, children: input.children },
    };
    if (input.preferredPlanId) {
      quotePayload.plan_id = input.preferredPlanId;
    }

    const quote = await invokeInventory<InventoryQuoteResult>(
      "inventory-quote",
      quotePayload,
      input.requestId,
    );

    if (!quote?.ok || typeof quote.quote !== "object" || quote.quote === null) {
      return null;
    }

    const total = Number(quote.quote.total_cents ?? 0);
    const currency = typeof quote.quote.currency === "string"
      ? quote.quote.currency
      : "USD";

    const attachment = {
      supplier: quote.supplier ?? search.supplier ?? "HBX",
      hotel: target,
      search_source: search.source ?? "unknown",
      quote_source: quote.source ?? "unknown",
      search_cache: search.cache ?? null,
      quote_cache: quote.cache ?? null,
      search_items: search.items,
      quote: quote.quote,
    };

    return {
      total_cents: Number.isFinite(total) && total > 0
        ? total
        : BASE_TOTAL_CENTS,
      currency,
      attachment,
    };
  } catch (error) {
    const wrapped = error instanceof Error ? error : new Error(String(error));
    console.log(
      JSON.stringify({
        level: "WARN",
        event: "bff.quote.inventory_error",
        request_id: input.requestId,
        message: wrapped.message,
      }),
    );
    return null;
  }
}

function resolveHotel(
  items: Array<Record<string, unknown>>,
  preferredHotelId?: string,
) {
  if (preferredHotelId) {
    const match = items.find((item) =>
      String(item.supplier_hotel_id) === preferredHotelId
    );
    if (match) return match;
  }
  return items[0];
}

async function invokeInventory<T>(
  fn: "inventory-search" | "inventory-quote",
  payload: unknown,
  requestId: string,
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    INVENTORY_REQUEST_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "x-request-id": requestId,
      },
      body: JSON.stringify(payload ?? {}),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(`${fn} failed: ${text || response.statusText}`);
      (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
      throw error;
    }

    return await response.json() as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      const wrapped = new Error(`${fn} timed out`);
      (wrapped as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
      throw wrapped;
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
