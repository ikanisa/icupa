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

const MOMO_WEBHOOK_SECRET = Deno.env.get("MOMO_WEBHOOK_SECRET") ?? "";
const MOMO_WEBHOOK_HMAC_SECRET = Deno.env.get("MOMO_WEBHOOK_HMAC_SECRET") ?? "";

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

interface MoMoWebhookPayload {
  referenceId?: string;
  reference_id?: string;
  reference?: string;
  status?: string;
  amount?: number | string;
  currency?: string;
  payer?: { partyId?: string };
  externalId?: string;
  description?: string;
}

export async function handleMtnWebhook(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  // Read raw body once for signature verification and JSON parsing
  const rawBody = await req.text();

  // HMAC verification (preferred when configured)
  const providedHmac = req.headers.get("x-mtn-signature-hmac") ?? req.headers.get("x-mtn-signature");
  if (MOMO_WEBHOOK_HMAC_SECRET) {
    if (!providedHmac) {
      return errorResponse(401, "unauthorized", "Missing MoMo HMAC signature header");
    }
    try {
      const expected = await hmacSha256Hex(MOMO_WEBHOOK_HMAC_SECRET, rawBody);
      if (!timingSafeEqual(providedHmac.toLowerCase(), expected.toLowerCase())) {
        return errorResponse(401, "unauthorized", "Invalid MTN MoMo HMAC signature");
      }
    } catch (e) {
      console.error("MoMo HMAC verification failed", e);
      return errorResponse(401, "unauthorized", "Invalid MTN MoMo HMAC signature");
    }
  } else {
    // Legacy shared-secret equality fallback if HMAC secret is not configured
    const legacySig = req.headers.get("x-mtn-signature");
    if (MOMO_WEBHOOK_SECRET && legacySig !== MOMO_WEBHOOK_SECRET) {
      return errorResponse(401, "unauthorized", "Invalid MTN MoMo signature");
    }
  }

  let payload: MoMoWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as MoMoWebhookPayload;
  } catch (_e) {
    return errorResponse(400, "invalid_json", "Request body must be valid JSON");
  }
  const reference = payload.referenceId ?? payload.reference_id ?? payload.reference ?? "";
  const status = (payload.status ?? "").toUpperCase();

  if (!reference) {
    return errorResponse(400, "missing_reference", "Webhook payload missing reference identifier");
  }

  const span = startEdgeTrace('payments.mtn_momo.webhook');
  const client = createServiceRoleClient();

  const { alreadyProcessed } = await recordWebhookEvent(
    client,
    "mtn_momo",
    reference,
    payload as Record<string, unknown>,
    signature,
  );

  if (alreadyProcessed) {
    return jsonResponse({ received: true, duplicate: true });
  }

  try {
    if (status === "SUCCESSFUL" || status === "SUCCESS") {
      const amountValue = typeof payload.amount === "string" ? Number(payload.amount) : payload.amount;
      const captureAmount = Number.isFinite(amountValue ?? NaN) ? Math.floor(Number(amountValue)) : undefined;
      await markPaymentCaptured(client, {
        providerRef: reference,
        captureAmountCents: captureAmount,
      });
      await markWebhookEventStatus(client, "mtn_momo", reference, "captured");
    } else if (status === "FAILED" || status === "REJECTED") {
      await markPaymentFailed(client, reference, payload.description ?? "MoMo reported failure");
      await markWebhookEventStatus(client, "mtn_momo", reference, "failed");
    } else {
      console.log("Received MTN MoMo webhook", { reference, status });
      await markWebhookEventStatus(client, "mtn_momo", reference, status.toLowerCase());
    }
    await span.end(client, {
      status: 'success',
      attributes: { reference, status },
    });
  } catch (error) {
    console.error("Failed to process MTN MoMo webhook", error, { reference, status });
    await span.end(client, {
      status: 'error',
      attributes: { reference, status },
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return errorResponse(500, "momo_webhook_failed", "Failed to process MTN MoMo webhook");
  }

  return jsonResponse({ received: true });
}

export default handleMtnWebhook;
