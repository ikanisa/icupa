import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { retryWithBackoff } from "../_shared/inventory.ts";
import {
  jsonResponse,
  logAudit,
  normalizeCurrency,
  normalizeIata,
  requireIsoDate,
} from "../_shared/providers.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "air-price-watch" });
const TABLE_URL = `${SUPABASE_URL}/rest/v1/travel.price_watches`;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("air-price-watch");
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
  const contact = pickString(body, ["contact", "email", "phone"]);
  const channel = pickString(body, ["channel"]);
  const notes = pickString(body, ["notes", "memo"]);

  const targetCentsRaw = pickNumber(body, ["target_price_cents", "targetPriceCents", "max_price_cents"]);
  const targetDollarsRaw = pickNumber(body, ["target_price", "targetPrice", "max_price"]);

  const errors: string[] = [];
  let origin = "";
  let destination = "";
  let departureDate = "";
  let returnDate: string | null = null;
  let currency = "USD";

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

  let targetPriceCents = 0;
  if (typeof targetCentsRaw === "number" && Number.isFinite(targetCentsRaw)) {
    targetPriceCents = Math.trunc(targetCentsRaw);
  } else if (typeof targetDollarsRaw === "number" && Number.isFinite(targetDollarsRaw)) {
    targetPriceCents = Math.round(targetDollarsRaw * 100);
  }

  if (!Number.isInteger(targetPriceCents) || targetPriceCents <= 0) {
    errors.push("target_price_cents must be > 0");
  }

  if (origin && destination && origin === destination) {
    errors.push("origin and destination must differ");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const trimmedNotes = typeof notes === "string" ? notes.trim() : undefined;

  const payload = {
    origin,
    destination,
    departure_date: departureDate,
    return_date: returnDate,
    currency,
    target_price_cents: targetPriceCents,
    contact: contact ?? null,
    channel: (channel ?? "chat").toLowerCase(),
    metadata: buildMetadata({ notes: trimmedNotes, raw: body }),
    request_id: requestId,
    notes: trimmedNotes ?? null,
  };

  const response = await insertPriceWatch(payload);

  logAudit("travel.price_watch.created", {
    request_id: requestId,
    watch_id: response.id,
    origin,
    destination,
    departure_date: departureDate,
    return_date: returnDate,
    currency,
    target_price_cents: targetPriceCents,
    channel: payload.channel,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    watch_id: response.id,
    status: response.status ?? "active",
    next_refresh_at: response.next_refresh_at ?? null,
  });
}, { fn: "air-price-watch", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

function pickNumber(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function buildMetadata(input: { notes?: string; raw: Record<string, unknown> }): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    raw_request: input.raw,
  };
  if (input.notes) {
    metadata.notes = input.notes;
  }
  return metadata;
}

async function insertPriceWatch(body: Record<string, unknown>): Promise<{
  id: string;
  status?: string;
  next_refresh_at?: string | null;
}> {
  const headers: HeadersInit = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    "Accept-Profile": "travel",
    "Content-Profile": "travel",
  };

  const result = await retryWithBackoff(async () => {
    let response: Response;
    try {
      response = await fetch(TABLE_URL, {
        method: "POST",
        headers,
        body: JSON.stringify([body]),
      });
    } catch (cause) {
      const networkError = cause instanceof Error ? cause : new Error(String(cause));
      (networkError as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
      (networkError as { retryable?: boolean }).retryable = true;
      throw networkError;
    }

    if (!response.ok) {
      const text = await response.text();
      const error = new Error(`price watch insert failed: ${text || response.statusText}`);
      (error as { code?: string }).code = classifyStatus(response.status);
      if (response.status >= 500 || response.status === 429) {
        (error as { retryable?: boolean }).retryable = true;
      }
      throw error;
    }

    const json = await response.json();
    if (Array.isArray(json) && json[0] && typeof json[0].id === "string") {
      return json[0] as {
        id: string;
        status?: string;
        next_refresh_at?: string | null;
      };
    }

    const error = new Error("price watch insert missing id");
    (error as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw error;
  }, { attempts: 3, baseDelayMs: 250 });

  return result;
}

function classifyStatus(status: number): typeof ERROR_CODES[keyof typeof ERROR_CODES] {
  if (status === 409) return ERROR_CODES.DATA_CONFLICT;
  if (status === 401 || status === 403) return ERROR_CODES.AUTH_REQUIRED;
  if (status === 429) return ERROR_CODES.RATE_LIMITED;
  if (status >= 500) return ERROR_CODES.SUPPLIER_TIMEOUT;
  return ERROR_CODES.UNKNOWN;
}
