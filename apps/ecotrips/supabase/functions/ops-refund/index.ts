// AUDIT: This handler emits structured audit logs that mirror operator actions.
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

type RefundRequest = {
  itinerary_id: unknown;
  amount_cents: unknown;
  reason: unknown;
  currency?: unknown;
};

type RefundMode = "live" | "mock";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const REFUND_AUTH_TOKEN = Deno.env.get("REFUND_AUTH_TOKEN") ?? "";
const OPS_REFUND_MODE = (Deno.env.get("OPS_REFUND_MODE") ?? "live").toLowerCase() as
  RefundMode;

const MOCK_MODE = OPS_REFUND_MODE === "mock";

if (!MOCK_MODE && (!SUPABASE_URL || !SERVICE_ROLE_KEY || !REFUND_AUTH_TOKEN)) {
  throw new Error(
    "ops-refund requires SUPABASE_URL, SUPABASE_SERVICE_ROLE, and REFUND_AUTH_TOKEN. Set OPS_REFUND_MODE=mock to opt into offline fixtures.",
  );
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const actor = req.headers.get("authorization") ? "bearer" : "anonymous";
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("ops-refund");
  }

  if (req.method !== "POST") {
    logAudit({ requestId, actor, details: "method_not_allowed" });
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let payload: RefundRequest;
  try {
    payload = (await req.json()) as RefundRequest;
  } catch (_error) {
    logAudit({ requestId, actor, details: "invalid_json" });
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    logAudit({ requestId, actor, details: "validation_error" });
    return jsonResponse({ ok: false, errors: validation.errors }, 400);
  }

  if (MOCK_MODE) {
    const responseId = `mock-${requestId}`;
    logAudit({ requestId, actor, details: "accepted_mock", amount: validation.amountCents });
    return jsonResponse({ ok: true, request_id: responseId });
  }

  try {
    const payment = await fetchLatestPayment(validation.itineraryId, actor, requestId);
    if (!payment) {
      logAudit({
        requestId,
        actor,
        details: "payment_not_found",
        itinerary: validation.itineraryId,
      });
      return jsonResponse({
        ok: false,
        error: "No payment found for itinerary",
      }, 404);
    }

    if (payment.amount_cents && validation.amountCents > payment.amount_cents) {
      logAudit({
        requestId,
        actor,
        details: "amount_exceeds_payment",
        itinerary: validation.itineraryId,
        payment_id: payment.id,
      });
      return jsonResponse({
        ok: false,
        error: "amount exceeds original payment",
      }, 400);
    }

    const refundResponse = await triggerRefund(payment.id, {
      amount_cents: validation.amountCents,
      reason: validation.reason,
    });

    logAudit({
      requestId,
      actor,
      details: "forwarded",
      payment_id: payment.id,
      itinerary: validation.itineraryId,
      amount: validation.amountCents,
    });

    return jsonResponse({ ...refundResponse, request_id: requestId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logAudit({ requestId, actor, details: "error", message });
    const wrapped = error instanceof Error ? error : new Error(message);
    (wrapped as { code?: string }).code ??= ERROR_CODES.UNKNOWN;
    throw wrapped;
  }
}, { fn: "ops-refund", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function validatePayload(payload: RefundRequest):
  | { ok: false; errors: string[] }
  | { ok: true; itineraryId: string; amountCents: number; reason: string } {
  const errors: string[] = [];

  const itineraryId = typeof payload.itinerary_id === "string"
    ? payload.itinerary_id.trim()
    : "";
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(itineraryId)) {
    errors.push("itinerary_id must be a valid UUID");
  }

  const amountCents = Number(payload.amount_cents);
  if (!Number.isFinite(amountCents) || amountCents <= 0 || !Number.isInteger(amountCents)) {
    errors.push("amount_cents must be a positive integer");
  }

  const reason = typeof payload.reason === "string" ? payload.reason.trim() : "";
  if (!reason || reason.length > 200) {
    errors.push("reason must be between 1 and 200 characters");
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, itineraryId, amountCents, reason };
}

async function fetchLatestPayment(
  itineraryId: string,
  actor: string,
  requestId: string,
): Promise<Record<string, number | string | null> | null> {
  const params = new URLSearchParams();
  params.set("select", "id,amount_cents,currency,status,created_at");
  params.append("itinerary_id", `eq.${itineraryId}`);
  params.append("status", "eq.succeeded");
  params.append("order", "created_at.desc");
  params.append("limit", "1");

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment.payments?${params.toString()}`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Accept-Profile": "payment",
      },
    },
  );

  if (!response.ok) {
    const text = await response.text();
    logAudit({
      requestId,
      actor,
      details: "payment_lookup_failed",
      status: response.status,
    });
    throw new Error(`failed to load payment: ${text}`);
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as Record<string, number | string | null>;
}

async function triggerRefund(paymentId: string, payload: { amount_cents: number; reason: string }) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/payments-refund`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-refund-token": REFUND_AUTH_TOKEN,
    },
    body: JSON.stringify({
      payment_id: paymentId,
      amount_cents: payload.amount_cents,
      reason: payload.reason,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`payments-refund returned ${response.status}: ${text}`);
  }

  const data = await response.json();
  if (!data || typeof data !== "object") {
    throw new Error("payments-refund returned unexpected payload");
  }
  return data as Record<string, unknown>;
}

function logAudit(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "ops.refund",
      fn: "ops-refund",
      ...fields,
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
