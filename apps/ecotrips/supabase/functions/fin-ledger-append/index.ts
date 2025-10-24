import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase service role configuration missing");
}

const ENTRY_TYPES = new Set([
  "intent_created",
  "capture_succeeded",
  "capture_failed",
  "refund_requested",
  "refund_succeeded",
  "refund_failed",
]);

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("fin-ledger-append");
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

  const entryType = typeof body.entry_type === "string"
    ? body.entry_type.trim()
    : "";
  if (!ENTRY_TYPES.has(entryType)) {
    const error = new Error("unsupported entry_type");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const paymentId = typeof body.payment_id === "string"
    ? body.payment_id.trim()
    : undefined;
  const itineraryId = typeof body.itinerary_id === "string"
    ? body.itinerary_id.trim()
    : undefined;
  const providerRef = typeof body.provider_ref === "string"
    ? body.provider_ref.trim()
    : undefined;
  const note = typeof body.note === "string" ? body.note.trim() : undefined;

  const amountCents = Number(body.amount_cents);
  if (!Number.isFinite(amountCents) || !Number.isInteger(amountCents)) {
    const error = new Error("amount_cents must be an integer");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const currency = typeof body.currency === "string"
    ? body.currency.trim().toUpperCase()
    : "USD";
  if (!currency) {
    const error = new Error("currency is required");
    (error as { code?: string }).code = ERROR_CODES.INPUT_INVALID;
    throw error;
  }

  const insertResponse = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fin_insert_ledger`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_payment_id: paymentId ?? null,
        p_itinerary_id: itineraryId ?? null,
        p_entry_type: entryType,
        p_amount_cents: amountCents,
        p_currency: currency,
        p_provider_ref: providerRef ?? null,
        p_note: note ?? null,
      }),
    },
  );

  if (!insertResponse.ok) {
    const text = await insertResponse.text();
    const error = new Error(`ledger insert failed: ${text}`);
    (error as { code?: string }).code = insertResponse.status === 409
      ? ERROR_CODES.DATA_CONFLICT
      : ERROR_CODES.UNKNOWN;
    throw error;
  }

  const rows = await insertResponse.json();
  const ledger = Array.isArray(rows) && rows[0] ? rows[0] : null;
  const ledgerId = ledger?.id as string | undefined;

  logEvent({
    requestId,
    status: ledgerId ? "inserted" : "ok",
    entryType,
    paymentId,
    providerRef,
    amountCents,
    currency,
  });

  return jsonResponse({ ok: true, ledger_id: ledgerId ?? null });
}, { fn: "fin-ledger-append", defaultErrorCode: ERROR_CODES.UNKNOWN });

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

async function findExisting(input: {
  entryType: string;
  paymentId?: string;
  providerRef?: string;
}) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/fin_find_ledger`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_entry_type: input.entryType,
        p_payment_id: input.paymentId ?? null,
        p_provider_ref: input.providerRef ?? null,
      }),
    },
  );
  if (!response.ok) {
    return null;
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  return rows[0] as { id: string };
}

function logEvent(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "fin.ledger.append",
      fn: "fin-ledger-append",
      ...fields,
    }),
  );
}
