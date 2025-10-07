import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  markPaymentCaptured,
  markPaymentFailed,
} from "../../../_shared/payments.ts";

const MOMO_WEBHOOK_SECRET = Deno.env.get("MOMO_WEBHOOK_SECRET") ?? "";

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

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  const signature = req.headers.get("x-mtn-signature");
  if (MOMO_WEBHOOK_SECRET && signature !== MOMO_WEBHOOK_SECRET) {
    return errorResponse(401, "unauthorized", "Invalid MTN MoMo signature");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  const payload = (await req.json()) as MoMoWebhookPayload;
  const reference = payload.referenceId ?? payload.reference_id ?? payload.reference ?? "";
  const status = (payload.status ?? "").toUpperCase();

  if (!reference) {
    return errorResponse(400, "missing_reference", "Webhook payload missing reference identifier");
  }

  const client = createServiceRoleClient();

  try {
    if (status === "SUCCESSFUL" || status === "SUCCESS") {
      const amountValue = typeof payload.amount === "string" ? Number(payload.amount) : payload.amount;
      const captureAmount = Number.isFinite(amountValue ?? NaN) ? Math.floor(Number(amountValue)) : undefined;
      await markPaymentCaptured(client, {
        providerRef: reference,
        captureAmountCents: captureAmount,
      });
    } else if (status === "FAILED" || status === "REJECTED") {
      await markPaymentFailed(client, reference, payload.description ?? "MoMo reported failure");
    } else {
      console.log("Received MTN MoMo webhook", { reference, status });
    }
  } catch (error) {
    console.error("Failed to process MTN MoMo webhook", error, { reference, status });
    return errorResponse(500, "momo_webhook_failed", "Failed to process MTN MoMo webhook");
  }

  return jsonResponse({ received: true });
});
