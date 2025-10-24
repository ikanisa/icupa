import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { assertAuthenticated, assertOpsAccess, resolveUserContext } from "../_shared/auth.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "finance_fx" });

const FX_HEADERS = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Accept-Profile": "fin",
  "Content-Profile": "fin",
  "Content-Type": "application/json",
  Prefer: "return=representation",
} as const;

interface FxSnapshotRow {
  id: string;
  invoice_id: string;
  base_currency: string;
  quote_currency: string;
  rate: number;
  converted_cents: number | null;
  request_key: string | null;
}

interface FxRequest {
  baseCurrency: string;
  quoteCurrency: string;
  amountCents: number;
  invoiceId?: string;
  requestKey?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("fx-rate-quote");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  const user = await resolveUserContext(req);
  assertAuthenticated(user);

  let raw: Record<string, unknown>;
  try {
    raw = await req.json() as Record<string, unknown>;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const parsed = parseFxRequest(raw);
  const derivedKey = parsed.requestKey ?? await deriveRequestKey([
    parsed.baseCurrency,
    parsed.quoteCurrency,
    String(parsed.amountCents),
    parsed.invoiceId ?? "none",
  ]);

  const existing = await fetchSnapshotByRequestKey(derivedKey, parsed.invoiceId, parsed.quoteCurrency);
  if (existing) {
    logEvent({
      requestId,
      invoiceId: existing.invoice_id,
      snapshotId: existing.id,
      reused: true,
    });
    const converted = existing.converted_cents ?? Math.round(parsed.amountCents * existing.rate);
    return jsonResponse({
      ok: true,
      rate: existing.rate,
      converted_cents: converted,
      base_currency: existing.base_currency,
      quote_currency: existing.quote_currency,
      snapshot_id: existing.id,
      request_id: derivedKey,
      provider: "fixture",
    });
  }

  const rate = computeRate(parsed.baseCurrency, parsed.quoteCurrency);
  if (rate <= 0) {
    const error = new Error("Unable to quote FX rate");
    (error as { code?: string }).code = ERROR_CODES.SUPPLIER_TIMEOUT;
    throw error;
  }

  const convertedCents = Math.round(parsed.amountCents * rate);

  let snapshotId: string | undefined;
  if (parsed.invoiceId) {
    assertOpsAccess(user);
    const snapshot = await insertSnapshot({
      invoiceId: parsed.invoiceId,
      baseCurrency: parsed.baseCurrency,
      quoteCurrency: parsed.quoteCurrency,
      rate,
      convertedCents,
      requestKey: derivedKey,
    });
    snapshotId = snapshot.id;
  }

  logEvent({
    requestId,
    invoiceId: parsed.invoiceId,
    rate,
    convertedCents,
  });

  return jsonResponse({
    ok: true,
    rate,
    converted_cents: convertedCents,
    base_currency: parsed.baseCurrency,
    quote_currency: parsed.quoteCurrency,
    snapshot_id: snapshotId,
    provider: "fixture",
    request_id: derivedKey,
  });
}, { fn: "fx-rate-quote", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

export { handler };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function parseFxRequest(body: Record<string, unknown>): FxRequest {
  const errors: string[] = [];
  const baseCurrency = typeof body.base_currency === "string" ? body.base_currency.trim().toUpperCase() : "";
  const quoteCurrency = typeof body.quote_currency === "string" ? body.quote_currency.trim().toUpperCase() : "";
  const amountCents = Number(body.amount_cents);
  const invoiceId = typeof body.invoice_id === "string" ? body.invoice_id.trim() : undefined;
  const requestKey = typeof body.request_key === "string" ? body.request_key.trim() : undefined;

  if (!/^[A-Z]{3}$/.test(baseCurrency)) {
    errors.push("base_currency must be ISO code");
  }
  if (!/^[A-Z]{3}$/.test(quoteCurrency)) {
    errors.push("quote_currency must be ISO code");
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    errors.push("amount_cents must be a positive integer");
  }
  if (invoiceId && !UUID_REGEX.test(invoiceId)) {
    errors.push("invoice_id must be a UUID when provided");
  }
  if (requestKey && (requestKey.length < 6 || requestKey.length > 128)) {
    errors.push("request_key must be 6-128 characters when provided");
  }

  if (errors.length > 0) {
    const error = new Error(errors.join(", "));
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  return { baseCurrency, quoteCurrency, amountCents, invoiceId, requestKey };
}

async function deriveRequestKey(parts: string[]): Promise<string> {
  const encoder = new TextEncoder();
  const payload = encoder.encode(parts.join(":"));
  const digest = await crypto.subtle.digest("SHA-256", payload);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `fx-${hex.slice(0, 32)}`;
}

async function fetchSnapshotByRequestKey(
  requestKey: string,
  invoiceId: string | undefined,
  quoteCurrency: string,
): Promise<FxSnapshotRow | null> {
  const filters = new URLSearchParams({ request_key: `eq.${requestKey}` });
  if (invoiceId) filters.append("invoice_id", `eq.${invoiceId}`);
  filters.append("quote_currency", `eq.${quoteCurrency}`);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/fin.invoice_fx?select=id,invoice_id,base_currency,quote_currency,rate,metadata,request_key&limit=1&${filters.toString()}`,
    { headers: FX_HEADERS },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to load FX snapshot: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  const record = rows[0] as FxSnapshotRow & {
    metadata?: Record<string, unknown> | null;
  };
  const meta = record.metadata ?? null;
  const converted = typeof meta?.converted_cents === "number"
    ? (meta.converted_cents as number)
    : null;
  return {
    id: record.id,
    invoice_id: record.invoice_id,
    base_currency: record.base_currency,
    quote_currency: record.quote_currency,
    rate: record.rate,
    converted_cents: converted,
    request_key: record.request_key ?? null,
  };
}

async function insertSnapshot(params: {
  invoiceId: string;
  baseCurrency: string;
  quoteCurrency: string;
  rate: number;
  convertedCents: number;
  requestKey: string;
}): Promise<FxSnapshotRow> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/fin.invoice_fx`, {
    method: "POST",
    headers: FX_HEADERS,
    body: JSON.stringify({
      invoice_id: params.invoiceId,
      base_currency: params.baseCurrency,
      quote_currency: params.quoteCurrency,
      rate: params.rate,
      metadata: { converted_cents: params.convertedCents },
      request_key: params.requestKey,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert FX snapshot: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    throw new Error("Unexpected response inserting FX snapshot");
  }
  const row = rows[0] as FxSnapshotRow;
  row.converted_cents = params.convertedCents;
  return row;
}

function computeRate(base: string, quote: string): number {
  if (base === quote) return 1;
  const key = `${base}_${quote}`;
  const fallback = 1;
  const fixtureValue = FX_FIXTURES[key];
  if (fixtureValue && fixtureValue > 0) {
    return fixtureValue;
  }
  const inverse = FX_FIXTURES[`${quote}_${base}`];
  if (inverse && inverse > 0) {
    return Math.round((1 / inverse) * 1e6) / 1e6;
  }
  return fallback;
}

const FX_FIXTURES: Record<string, number> = {
  USD_EUR: Number(Deno.env.get("FX_FIXTURE_USD_EUR") ?? "0.92"),
  EUR_USD: Number(Deno.env.get("FX_FIXTURE_EUR_USD") ?? "1.087"),
  USD_RWF: Number(Deno.env.get("FX_FIXTURE_USD_RWF") ?? "1285"),
  RWF_USD: Number(Deno.env.get("FX_FIXTURE_RWF_USD") ?? "0.00078"),
  EUR_RWF: Number(Deno.env.get("FX_FIXTURE_EUR_RWF") ?? "1400"),
  RWF_EUR: Number(Deno.env.get("FX_FIXTURE_RWF_EUR") ?? "0.00071"),
};

function logEvent(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "finance.fx.quote",
      fn: "fx-rate-quote",
      ...fields,
    }),
  );
}
