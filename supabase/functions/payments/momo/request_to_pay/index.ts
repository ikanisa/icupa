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

interface MobileMoneyRequest {
  currency?: string;
  items?: PaymentCartItem[];
  tax_cents?: number;
  tip_cents?: number;
  service_cents?: number;
  expected_subtotal_cents?: number;
  expected_total_cents?: number;
  payer_phone?: string;
  note?: string;
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

    const payload = (await req.json()) as MobileMoneyRequest;
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
      return errorResponse(400, "unsupported_currency", "MTN MoMo is available for RWF payments only");
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
      "mtn_momo"
    );

    const providerRef = `momo_stub_${crypto.randomUUID()}`;
    const updateResult = await client
      .from("payments")
      .update({ provider_ref: providerRef })
      .eq("id", paymentId);

    if (updateResult.error) {
      console.error("Failed to update MoMo provider reference", updateResult.error, { paymentId });
    }

    const eventInsert = await client.from("events").insert({
      tenant_id: sessionContext.tenantId,
      location_id: sessionContext.locationId,
      table_session_id: sessionContext.tableSessionId,
      type: "payment.mtn_momo.requested",
      payload: {
        order_id: orderId,
        payment_id: paymentId,
        payer_phone: payload.payer_phone ?? null,
      },
    });

    if (eventInsert.error) {
      console.error("Failed to log MTN MoMo request event", eventInsert.error, {
        orderId,
        paymentId,
      });
    }

    return jsonResponse({
      order_id: orderId,
      payment_id: paymentId,
      payment_status: "pending",
      payment_method: "mtn_momo",
      provider_ref: providerRef,
      total_cents: totals.totalCents,
      message:
        "MTN MoMo integration is stubbed for local development. Configure MOMO_CLIENT_ID, MOMO_CLIENT_SECRET, and MOMO_API_BASE before enabling live payments.",
    });
  } catch (error) {
    console.error("MoMo request-to-pay error", error);
    return errorResponse(500, "momo_request_failed", "Failed to initiate MTN MoMo payment");
  }
});
