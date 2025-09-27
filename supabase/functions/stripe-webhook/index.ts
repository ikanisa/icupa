import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { appendLedgerEntry } from "../_shared/fin.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const MOCK_SIGNATURE_OK = Deno.env.get("MOCK_SIGNATURE_OK") === "1";

if (!STRIPE_WEBHOOK_SECRET && !MOCK_SIGNATURE_OK) {
  throw new Error(
    "STRIPE_WEBHOOK_SECRET is required for stripe-webhook. Set MOCK_SIGNATURE_OK=1 only in non-production environments.",
  );
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_TYPES = new Set([
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
]);

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function auditLog(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "stripe.webhook",
      fn: "stripe-webhook",
      ...fields,
    }),
  );
}

async function patchPayment(
  paymentId: string,
  status: string,
  paymentIntent: string,
) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service configuration missing");
  }

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
        p_intent: paymentIntent,
        p_status: status,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to update payment ${paymentId}: ${text}`);
  }
}

async function recordFailureEvent(
  paymentId: string,
  paymentIntent: string,
  type: string,
  stripeObject: Record<string, unknown> | undefined,
) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/rpc/record_payment_failure_event`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        "Accept-Profile": "public",
        Prefer: "params=single-object",
      },
      body: JSON.stringify({
        p_payment: paymentId,
        p_intent: paymentIntent,
        p_type: type,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to record audit event: ${text}`);
  }

  if (stripeObject?.last_payment_error) {
    const errorDetails = stripeObject.last_payment_error as Record<
      string,
      unknown
    >;
    console.log(
      `AUDIT webhook.stripe.failure payment=${paymentId} intent=${paymentIntent} reason=${
        String(errorDetails?.message ?? "unknown")
      }`,
    );
  }
}

async function lookupPaymentId(intentId: string): Promise<string> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service configuration missing");
  }

  const headers = {
    apikey: SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Accept-Profile": "payment",
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment.payments?provider_ref=eq.${intentId}&select=id`,
    { headers },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to lookup payment: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]?.id) {
    return "";
  }
  return String(rows[0].id);
}

async function fetchPaymentMeta(paymentId: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase service configuration missing");
  }

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment.payments?id=eq.${paymentId}&select=id,itinerary_id,amount_cents,currency&limit=1`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "payment",
      },
    },
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch payment meta: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as Record<string, unknown>;
}

async function verifyStripeSignature(
  rawBody: string,
  header: string,
  secret: string,
): Promise<boolean> {
  if (!secret) return false;

  const parts = header.split(",");
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") timestamp = value;
    if (key === "v1" && value) signatures.push(value);
  }

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const encoder = new TextEncoder();
  const payload = `${timestamp}.${rawBody}`;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );
  const expected = bufferToHex(signatureBuffer);

  return signatures.some((sig) => timingSafeEqual(expected, sig));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let result = 0;
  for (let i = 0; i < len; i++) {
    const codeA = a.charCodeAt(i) || 0;
    const codeB = b.charCodeAt(i) || 0;
    result |= codeA ^ codeB;
  }
  return result === 0 && a.length === b.length;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("stripe-webhook");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, { status: 405 });
  }

  const rawBody = await req.text();
  let payload: Record<string, unknown>;
  try {
    payload = rawBody.length ? JSON.parse(rawBody) : {};
  } catch (_error) {
    return jsonResponse({ ok: false, errors: ["Invalid JSON"] }, {
      status: 400,
    });
  }

  const signatureHeader = req.headers.get("stripe-signature");
  if (!signatureHeader && !MOCK_SIGNATURE_OK) {
    return jsonResponse(
      { ok: false, error: "Missing stripe-signature header" },
      { status: 400 },
    );
  }

  if (!MOCK_SIGNATURE_OK) {
    const verified = await verifyStripeSignature(
      rawBody,
      signatureHeader!,
      STRIPE_WEBHOOK_SECRET,
    );
    if (!verified) {
      return jsonResponse({ ok: false, error: "Invalid signature" }, {
        status: 400,
      });
    }
  }

  const type = typeof payload?.type === "string" ? payload.type : "";
  if (!ALLOWED_TYPES.has(type)) {
    return jsonResponse({ ok: false, error: "Unsupported event type" }, {
      status: 400,
    });
  }

  const data = payload?.data as Record<string, unknown> | undefined;
  const object = data?.object as Record<string, unknown> | undefined;
  const paymentIntentId = typeof object?.id === "string" ? object.id : "";
  const metadata = object?.metadata as Record<string, unknown> | undefined;
  let paymentId = typeof metadata?.payment_id === "string"
    ? metadata.payment_id
    : "";

  try {
    if (!paymentId && paymentIntentId) {
      paymentId = await lookupPaymentId(paymentIntentId);
    }

    if (!paymentId || !UUID_REGEX.test(paymentId)) {
      auditLog({
        requestId,
        intent: paymentIntentId,
        type,
        status: "missing_payment",
      });
      return jsonResponse({ ok: true, warning: "payment_id missing" }, {
        status: 202,
      });
    }

    const paymentMeta = await fetchPaymentMeta(paymentId);
    const metaAmount = Number(
      paymentMeta?.amount_cents ?? metadata?.amount_cents ?? 0,
    );
    const intentAmount = Number(
      object?.amount_received ?? object?.amount ?? metaAmount,
    );
    const amountCents = Number.isFinite(intentAmount) && intentAmount > 0
      ? Math.trunc(intentAmount)
      : (Number.isFinite(metaAmount) && metaAmount > 0
        ? Math.trunc(metaAmount)
        : 0);
    const currency = String(
      paymentMeta?.currency ?? metadata?.currency ?? object?.currency ?? "USD",
    ).toUpperCase();
    const itineraryId = typeof metadata?.itinerary_id === "string"
      ? metadata.itinerary_id
      : (typeof paymentMeta?.itinerary_id === "string"
        ? paymentMeta.itinerary_id
        : undefined);

    const ledgerAmount = amountCents > 0 ? amountCents : 0;

    if (type === "payment_intent.succeeded") {
      await patchPayment(paymentId, "succeeded", paymentIntentId);
      await appendLedgerEntry({
        entry_type: "capture_succeeded",
        amount_cents: ledgerAmount,
        currency,
        payment_id: paymentId,
        itinerary_id: itineraryId,
        provider_ref: paymentIntentId,
        requestId,
      });
    } else {
      await patchPayment(paymentId, "failed", paymentIntentId);
      await recordFailureEvent(paymentId, paymentIntentId, type, object);
      const failureMessage = String(
        object?.last_payment_error?.message ?? "unknown",
      ).slice(0, 200);
      await appendLedgerEntry({
        entry_type: "capture_failed",
        amount_cents: ledgerAmount,
        currency,
        payment_id: paymentId,
        itinerary_id: itineraryId,
        provider_ref: paymentIntentId,
        requestId,
        note: failureMessage,
      });
    }

    auditLog({
      requestId,
      payment: paymentId,
      intent: paymentIntentId,
      type,
      status: "ok",
    });
    return jsonResponse({ ok: true });
  } catch (error) {
    auditLog({
      requestId,
      payment: paymentId,
      intent: paymentIntentId,
      type,
      status: "error",
    });
    const wrapped = error instanceof Error ? error : new Error(String(error));
    (wrapped as { code?: string }).code ??= ERROR_CODES.PAYMENT_PROVIDER_ERROR;
    throw wrapped;
  }
}, {
  fn: "stripe-webhook",
  defaultErrorCode: ERROR_CODES.PAYMENT_PROVIDER_ERROR,
});

serve(handler);
