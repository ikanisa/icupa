import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  markPaymentCaptured,
  markPaymentFailed,
} from "../../../_shared/payments.ts";

const AIRTEL_WEBHOOK_SECRET = Deno.env.get("AIRTEL_WEBHOOK_SECRET") ?? "";

interface AirtelWebhookPayload {
  reference?: string;
  transaction?: { id?: string; status?: string; amount?: number | string; currency?: string };
  status?: string;
  amount?: number | string;
  reason?: string;
}

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  const signature = req.headers.get("x-airtel-signature");
  if (AIRTEL_WEBHOOK_SECRET && signature !== AIRTEL_WEBHOOK_SECRET) {
    return errorResponse(401, "unauthorized", "Invalid Airtel Money signature");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  const payload = (await req.json()) as AirtelWebhookPayload;
  const transaction = payload.transaction ?? {};
  const reference = transaction.id ?? payload.reference ?? "";
  const status = (transaction.status ?? payload.status ?? "").toUpperCase();

  if (!reference) {
    return errorResponse(400, "missing_reference", "Webhook payload missing reference identifier");
  }

  const client = createServiceRoleClient();

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
    } else if (status === "FAILED" || status === "CANCELLED") {
      await markPaymentFailed(client, reference, payload.reason ?? "Airtel Money reported failure");
    } else {
      console.log("Received Airtel Money webhook", { reference, status });
    }
  } catch (error) {
    console.error("Failed to process Airtel Money webhook", error, { reference, status });
    return errorResponse(500, "airtel_webhook_failed", "Failed to process Airtel Money webhook");
  }

  return jsonResponse({ received: true });
});
