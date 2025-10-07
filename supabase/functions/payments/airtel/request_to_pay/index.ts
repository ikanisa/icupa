import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  calculateTotals,
  createOrderAndPayment,
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  resolveSessionContext,
  type PaymentCartItem,
} from "../../../_shared/payments.ts";

interface AirtelMoneyRequest {
  currency?: string;
  items?: PaymentCartItem[];
  tax_cents?: number;
  tip_cents?: number;
  service_cents?: number;
  expected_subtotal_cents?: number;
  expected_total_cents?: number;
  msisdn?: string;
}

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
    }

    const payload = (await req.json()) as AirtelMoneyRequest;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return errorResponse(400, "empty_cart", "At least one cart item is required");
    }

    const tableSessionId =
      req.headers.get("x-icupa-session") ?? req.headers.get("x-ICUPA-session") ?? "";
    if (!tableSessionId) {
      return errorResponse(401, "missing_session", "x-icupa-session header is required");
    }

    const client = createServiceRoleClient();
    const sessionContext = await resolveSessionContext(client, tableSessionId);

    const requestedCurrency = (payload.currency ?? sessionContext.currency ?? "RWF").toUpperCase();
    if (requestedCurrency !== "RWF") {
      return errorResponse(400, "unsupported_currency", "Airtel Money is available for RWF payments only");
    }

    const totals = calculateTotals(items, {
      tip_cents: payload.tip_cents,
      tax_cents: payload.tax_cents,
      service_cents: payload.service_cents,
      expected_subtotal_cents: payload.expected_subtotal_cents,
      expected_total_cents: payload.expected_total_cents,
    });

    const { orderId, paymentId } = await createOrderAndPayment(
      client,
      { ...sessionContext, currency: requestedCurrency },
      totals,
      items,
      "airtel_money"
    );

    const providerRef = `airtel_stub_${crypto.randomUUID()}`;
    const updateResult = await client
      .from("payments")
      .update({ provider_ref: providerRef })
      .eq("id", paymentId);

    if (updateResult.error) {
      console.error("Failed to update Airtel Money provider reference", updateResult.error, { paymentId });
    }

    const eventInsert = await client.from("events").insert({
      tenant_id: sessionContext.tenantId,
      location_id: sessionContext.locationId,
      table_session_id: sessionContext.tableSessionId,
      type: "payment.airtel.requested",
      payload: {
        order_id: orderId,
        payment_id: paymentId,
        msisdn: payload.msisdn ?? null,
      },
    });

    if (eventInsert.error) {
      console.error("Failed to log Airtel Money request event", eventInsert.error, {
        orderId,
        paymentId,
      });
    }

    return jsonResponse({
      order_id: orderId,
      payment_id: paymentId,
      payment_status: "pending",
      payment_method: "airtel_money",
      provider_ref: providerRef,
      total_cents: totals.totalCents,
      message:
        "Airtel Money integration is stubbed for local development. Configure AIRTEL_KEY and AIRTEL_SECRET before enabling live payments.",
    });
  } catch (error) {
    console.error("Airtel request-to-pay error", error);
    return errorResponse(500, "airtel_request_failed", "Failed to initiate Airtel Money payment");
  }
});
