import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { appendLedgerEntry } from "../_shared/fin.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = Number(Deno.env.get("STRIPE_TIMEOUT_MS") ?? "15000");
const MOCK_STRIPE_MODE = Deno.env.get("STRIPE_MOCK_MODE") === "1";

if (!MOCK_STRIPE_MODE && !STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is required for bff-checkout. Set STRIPE_MOCK_MODE=1 to allow mock intents.",
  );
}

const ALLOWED_CURRENCIES = new Set(["USD", "EUR", "RWF"]);
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

async function deriveIdempotency(
  itineraryId: string,
  amountCents: number,
  currency: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const input = encoder.encode(`${itineraryId}:${amountCents}:${currency}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 48);
}

async function ensurePaymentRecord(
  itineraryId: string,
  amountCents: number,
  currency: string,
  idempotencyKey: string,
): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/ensure_payment_record`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
      },
      body: JSON.stringify({
        p_itinerary: itineraryId,
        p_amount_cents: amountCents,
        p_currency: currency,
        p_idempotency: idempotencyKey,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to insert payment record: ${text}`);
  }

  const data = await response.json();
  if (typeof data === "string") {
    return data;
  }
  if (data && typeof data === "object") {
    const values = Object.values(data);
    if (values.length === 1 && typeof values[0] === "string") {
      return values[0];
    }
  }
  throw new Error("Unexpected RPC response");
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("bff-checkout");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, errors: ["Invalid JSON body"] }, {
      status: 400,
    });
  }

  const errors: string[] = [];

  const itineraryId = typeof payload?.itinerary_id === "string"
    ? payload.itinerary_id.trim()
    : "";
  if (!UUID_REGEX.test(itineraryId)) {
    errors.push("itinerary_id must be a valid UUID");
  }

  const amountCents = Number(payload?.amount_cents);
  if (
    !Number.isFinite(amountCents) || amountCents <= 0 ||
    !Number.isInteger(amountCents)
  ) {
    errors.push("amount_cents must be a positive integer");
  }

  const currency = typeof payload?.currency === "string"
    ? payload.currency.toUpperCase()
    : "";
  if (!ALLOWED_CURRENCIES.has(currency)) {
    errors.push("currency must be one of USD|EUR|RWF");
  }

  let idempotencyKey = "";
  if (payload?.idempotency_key !== undefined) {
    if (typeof payload.idempotency_key !== "string") {
      errors.push("idempotency_key must be a string");
    } else {
      const trimmed = payload.idempotency_key.trim();
      if (trimmed.length === 0 || trimmed.length > 64) {
        errors.push("idempotency_key must be 1-64 characters");
      } else {
        idempotencyKey = trimmed;
      }
    }
  }

  if (errors.length > 0) {
    return jsonResponse({ ok: false, errors }, { status: 400 });
  }

  try {
    if (!idempotencyKey) {
      idempotencyKey = await deriveIdempotency(
        itineraryId,
        amountCents,
        currency,
      );
    }

    const paymentId = await ensurePaymentRecord(
      itineraryId,
      amountCents,
      currency,
      idempotencyKey,
    );

    const intent = await createPaymentIntent(
      paymentId,
      itineraryId,
      amountCents,
      currency,
      idempotencyKey,
    );

    await updatePaymentRecord(paymentId, intent);

    await appendLedgerEntry({
      entry_type: "intent_created",
      amount_cents: amountCents,
      currency,
      payment_id: paymentId,
      itinerary_id: itineraryId,
      provider_ref: intent.id,
      requestId,
      note: `mode=${intent.mode}`,
    });

    console.log(
      `AUDIT checkout.intent requestId=${requestId} payment=${paymentId} intent=${intent.id} mode=${intent.mode} status=${intent.status}`,
    );

    const responseBody: Record<string, unknown> = {
      ok: true,
      payment_id: paymentId,
      payment_intent: intent.id,
      idempotency: idempotencyKey,
      request_id: requestId,
      provider_status: intent.status,
    };
    if (intent.client_secret) {
      responseBody.client_secret = intent.client_secret;
    }

    return jsonResponse(responseBody);
  } catch (error) {
    console.log(
      `AUDIT checkout.intent requestId=${requestId} status=error message=${
        String(error)
      }`,
    );
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code = ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "bff-checkout", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);

async function createPaymentIntent(
  paymentId: string,
  itineraryId: string,
  amountCents: number,
  currency: string,
  idempotencyKey: string,
) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase configuration missing");
  }

  let useMock = MOCK_STRIPE_MODE;
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Idempotency-Key": `ecoTrips-${idempotencyKey}`,
  };

  const body = new URLSearchParams();
  body.append("amount", String(amountCents));
  body.append("currency", currency.toLowerCase());
  body.append("metadata[payment_id]", paymentId);
  body.append("metadata[itinerary_id]", itineraryId);
  body.append("metadata[amount_cents]", String(amountCents));
  body.append("metadata[currency]", currency);
  body.append("description", `ecoTrips itinerary ${itineraryId}`);
  body.append("automatic_payment_methods[enabled]", "true");

  if (!useMock && STRIPE_SECRET_KEY) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
      const response = await fetch(`${STRIPE_API_BASE}/payment_intents`, {
        method: "POST",
        headers,
        body: body.toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Stripe error: ${errorBody}`);
      }

      const data = await response.json();
      return {
        id: data.id as string,
        client_secret: data.client_secret as string | undefined,
        status: String(data.status ?? "processing"),
        mode: "live",
      };
    } catch (error) {
      console.warn(`MOCK_INTENT fallback: ${String(error)}`);
      useMock = true;
    }
  }

  const mockId = `pi_mock_${paymentId}`;
  return {
    id: mockId,
    client_secret: undefined,
    status: "requires_confirmation",
    mode: "mock",
  };
}

async function updatePaymentRecord(
  paymentId: string,
  intent: { id: string; status: string; mode: string; client_secret?: string },
) {
  const mappedStatus = mapPaymentStatus(intent.status);
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/update_payment_intent_metadata`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({
        p_payment: paymentId,
        p_intent: intent.id,
        p_status: mappedStatus,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update payment record: ${text}`);
  }
}

function mapPaymentStatus(status: string): string {
  const normalized = status?.toLowerCase?.() ?? "";
  switch (normalized) {
    case "succeeded":
      return "succeeded";
    case "canceled":
    case "canceled_by_customer":
      return "voided";
    case "payment_failed":
      return "failed";
    default:
      return "processing";
  }
}
