import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  markPaymentCaptured,
  markPaymentFailed,
  markWebhookEventStatus,
  recordWebhookEvent,
  startEdgeTrace,
} from "../../../_shared/payments.ts";

const AIRTEL_WEBHOOK_SECRET = Deno.env.get("AIRTEL_WEBHOOK_SECRET") ?? "";
const AIRTEL_WEBHOOK_HMAC_SECRET = Deno.env.get("AIRTEL_WEBHOOK_HMAC_SECRET") ?? "";

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const bytes = new Uint8Array(signature);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

interface AirtelWebhookPayload {
  reference?: string;
  transaction?: { id?: string; status?: string; amount?: number | string; currency?: string };
  status?: string;
  amount?: number | string;
  reason?: string;
}

export async function handleAirtelWebhook(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  const rawBody = await req.text();

  // HMAC verification (preferred when configured)
  const providedHmac = req.headers.get("x-airtel-signature-hmac") ?? req.headers.get("x-airtel-signature");
  if (AIRTEL_WEBHOOK_HMAC_SECRET) {
    if (!providedHmac) {
      return errorResponse(401, "unauthorized", "Missing Airtel Money HMAC signature header");
    }
    try {
      const expected = await hmacSha256Hex(AIRTEL_WEBHOOK_HMAC_SECRET, rawBody);
      if (!timingSafeEqual(providedHmac.toLowerCase(), expected.toLowerCase())) {
        return errorResponse(401, "unauthorized", "Invalid Airtel Money HMAC signature");
      }
    } catch (e) {
      console.error("Airtel HMAC verification failed", e);
      return errorResponse(401, "unauthorized", "Invalid Airtel Money HMAC signature");
    }
  } else {
    // Legacy shared-secret equality fallback if HMAC secret is not configured
    const legacySig = req.headers.get("x-airtel-signature");
    if (AIRTEL_WEBHOOK_SECRET && legacySig !== AIRTEL_WEBHOOK_SECRET) {
      return errorResponse(401, "unauthorized", "Invalid Airtel Money signature");
    }
  }

  let payload: AirtelWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as AirtelWebhookPayload;
  } catch (_e) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }
  const transaction = payload.transaction ?? {};
  const reference = transaction.id ?? payload.reference ?? "";
  const status = (transaction.status ?? payload.status ?? "").toUpperCase();

  if (!reference) {
    return errorResponse(400, "missing_reference", "Webhook payload missing reference identifier");
  }

  const span = startEdgeTrace('payments.airtel.webhook');
  const client = createServiceRoleClient();

  const { alreadyProcessed } = await recordWebhookEvent(
    client,
    "airtel_money",
    reference,
    payload as Record<string, unknown>,
    signature,
  );

  if (alreadyProcessed) {
    return jsonResponse({ received: true, duplicate: true });
  }

  try {
    if (status === "SUCCESS" || status === "COMPLETED") {
      const amountValue = typeof transaction.amount === "string"
        ? Number(transaction.amount)
        : typeof payload.amount === "string"
          ? Number(payload.amount)
          : transaction.amount ?? payload.amount;
      const captureAmount = Number.isFinite(amountValue ?? NaN) ? Math.floor(Number(amountValue)) : undefined;
      await markPaymentCaptured(client, {
        providerRef: reference,
        captureAmountCents: captureAmount,
      });
      await markWebhookEventStatus(client, "airtel_money", reference, "captured");
    } else if (status === "FAILED" || status === "CANCELLED") {
      await markPaymentFailed(client, reference, payload.reason ?? "Airtel Money reported failure");
      await markWebhookEventStatus(client, "airtel_money", reference, "failed");
    } else {
      console.log("Received Airtel Money webhook", { reference, status });
      await markWebhookEventStatus(client, "airtel_money", reference, status.toLowerCase());
    }
    await span.end(client, {
      status: 'success',
      attributes: { reference, status },
    });
  } catch (error) {
    console.error("Failed to process Airtel Money webhook", error, { reference, status });
    await span.end(client, {
      status: 'error',
      attributes: { reference, status },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(500, "airtel_webhook_failed", "Failed to process Airtel Money webhook");
  }

  return jsonResponse({ received: true });
}

export default handleAirtelWebhook;
