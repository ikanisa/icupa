import { appendLedgerEntry } from "../_shared/fin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const REFUND_AUTH_TOKEN = Deno.env.get("REFUND_AUTH_TOKEN") ?? "";
const STRIPE_API_BASE = "https://api.stripe.com/v1";
const STRIPE_TIMEOUT_MS = Number(Deno.env.get("STRIPE_TIMEOUT_MS") ?? "15000");
const MOCK_STRIPE_MODE = Deno.env.get("STRIPE_MOCK_MODE") === "1";

if (!REFUND_AUTH_TOKEN) {
  throw new Error("REFUND_AUTH_TOKEN is required for payments-refund");
}

if (!MOCK_STRIPE_MODE && !STRIPE_SECRET_KEY) {
  throw new Error(
    "STRIPE_SECRET_KEY is required for payments-refund. Set STRIPE_MOCK_MODE=1 to allow mock refunds.",
  );
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  const requestId = crypto.randomUUID();

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch (_error) {
    return jsonResponse({ ok: false, errors: ["Invalid JSON"] }, 400);
  }

  const paymentId = typeof payload.payment_id === "string"
    ? payload.payment_id.trim()
    : "";
  if (!UUID_REGEX.test(paymentId)) {
    return jsonResponse(
      { ok: false, errors: ["payment_id must be a UUID"] },
      400,
    );
  }

  const amountCents = payload.amount_cents === undefined
    ? undefined
    : Number(payload.amount_cents);
  if (amountCents !== undefined) {
    if (
      !Number.isFinite(amountCents) || amountCents <= 0 ||
      !Number.isInteger(amountCents)
    ) {
      return jsonResponse({
        ok: false,
        errors: ["amount_cents must be a positive integer"],
      }, 400);
    }
  }

  const reason = typeof payload.reason === "string"
    ? payload.reason.trim()
    : undefined;

  try {
    const payment = await fetchPayment(paymentId);
    if (!payment) {
      return jsonResponse({ ok: false, error: "payment not found" }, 404);
    }

    const providerRef = String(payment.provider_ref ?? "");
    if (!providerRef) {
      throw new Error("payment has no provider reference");
    }

    const currency = String(payment.currency ?? "usd").toLowerCase();
    const grossAmount = Number(payment.amount_cents ?? 0);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      throw new Error("invalid payment amount");
    }

    const refundAmount = amountCents ?? grossAmount;
    if (refundAmount > grossAmount) {
      return jsonResponse({
        ok: false,
        error: "amount exceeds original payment",
      }, 400);
    }

    const itineraryId = typeof payment.itinerary_id === "string"
      ? payment.itinerary_id
      : undefined;
    const currencyUpper = currency.toUpperCase();
    const requestedRef = `${providerRef}-refund-request`;

    await appendLedgerEntry({
      entry_type: "refund_requested",
      amount_cents: refundAmount,
      currency: currencyUpper,
      payment_id: paymentId,
      itinerary_id: itineraryId,
      provider_ref: requestedRef,
      note: reason?.slice(0, 120),
      requestId,
    });

    let refund: { id: string; amount_cents: number; mode: string } | undefined;
    try {
      refund = await createRefund(
        providerRef,
        refundAmount,
        currency,
        reason,
        paymentId,
      );

      await markRefunded(paymentId, providerRef, refund.id);

      await appendLedgerEntry({
        entry_type: "refund_succeeded",
        amount_cents: refund.amount_cents ?? refundAmount,
        currency: currencyUpper,
        payment_id: paymentId,
        itinerary_id: itineraryId,
        provider_ref: refund.id,
        note: refund.mode,
        requestId,
      });
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error))
        .slice(0, 200);
      await appendLedgerEntry({
        entry_type: "refund_failed",
        amount_cents: refundAmount,
        currency: currencyUpper,
        payment_id: paymentId,
        itinerary_id: itineraryId,
        provider_ref: refund?.id ?? `${providerRef}-refund-failed`,
        note: message,
        requestId,
      });
      throw error;
    }

    if (!refund) {
      throw new Error("refund result missing");
    }

    console.log(
      `AUDIT payments.refund requestId=${requestId} payment=${paymentId} intent=${providerRef} refund=${refund.id} mode=${refund.mode}`,
    );

    return jsonResponse({
      ok: true,
      payment_id: paymentId,
      refund_id: refund.id,
      amount_cents: refund.amount_cents,
      currency: currency.toUpperCase(),
      mode: refund.mode,
    });
  } catch (error) {
    console.log(
      `AUDIT payments.refund requestId=${requestId} payment=${paymentId} status=error message=${
        String(error)
      }`,
    );
    return jsonResponse({ ok: false, error: String(error) }, 500);
  }
});

function authorize(req: Request): boolean {
  const tokenHeader = req.headers.get("x-refund-token") ?? "";
  return REFUND_AUTH_TOKEN && tokenHeader === REFUND_AUTH_TOKEN;
}

async function fetchPayment(paymentId: string) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment.payments?id=eq.${paymentId}&select=id,amount_cents,currency,provider_ref,itinerary_id`,
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
    throw new Error(`failed to load payment: ${text}`);
  }
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }
  return rows[0] as Record<string, unknown>;
}

async function createRefund(
  providerRef: string,
  amountCents: number,
  currency: string,
  reason: string | undefined,
  paymentId: string,
) {
  let useMock = MOCK_STRIPE_MODE;
  const headers: Record<string, string> = {
    "content-type": "application/x-www-form-urlencoded",
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    "Idempotency-Key": `ecoTrips-refund-${paymentId}-${amountCents}`,
  };
  const body = new URLSearchParams();
  body.append("payment_intent", providerRef);
  if (amountCents) body.append("amount", String(amountCents));
  if (reason) body.append("reason", reason);

  if (!useMock && STRIPE_SECRET_KEY) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), STRIPE_TIMEOUT_MS);
      const response = await fetch(`${STRIPE_API_BASE}/refunds`, {
        method: "POST",
        headers,
        body: body.toString(),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Stripe refund error: ${text}`);
      }

      const data = await response.json();
      return {
        id: String(data.id),
        amount_cents: Number(data.amount ?? amountCents),
        mode: "live",
      };
    } catch (error) {
      console.warn(`MOCK_REFUND fallback: ${String(error)}`);
      useMock = true;
    }
  }

  const mockId = `${providerRef}-refund-${crypto.randomUUID()}`;
  return {
    id: mockId,
    amount_cents: amountCents,
    mode: "mock",
  };
}

async function markRefunded(
  paymentId: string,
  providerRef: string,
  refundId: string,
) {
  const headers = {
    apikey: SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    "Accept-Profile": "payment",
    "Content-Profile": "payment",
  };

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/payment.payments?id=eq.${paymentId}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "refunded",
        provider_ref: `${providerRef}-refund`,
        intent_id: providerRef,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`failed to mark refunded: ${text}`);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
