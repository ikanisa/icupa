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

interface AdyenCheckoutRequest {
  currency?: string;
  payment_provider?: string;
  items?: PaymentCartItem[];
  tax_cents?: number;
  tip_cents?: number;
  service_cents?: number;
  expected_subtotal_cents?: number;
  expected_total_cents?: number;
  success_url?: string;
  cancel_url?: string;
  country_code?: string;
}

const ADYEN_API_KEY = Deno.env.get("ADYEN_API_KEY") ?? "";
const ADYEN_MERCHANT_ACCOUNT = Deno.env.get("ADYEN_MERCHANT_ACCOUNT") ?? "";
const ADYEN_ENVIRONMENT = (Deno.env.get("ADYEN_ENVIRONMENT") ?? "test").toLowerCase();
const ADYEN_CHECKOUT_VERSION = Deno.env.get("ADYEN_CHECKOUT_VERSION") ?? "v71";

const ADYEN_BASE_URL =
  ADYEN_ENVIRONMENT === "live" ? "https://checkout-live.adyen.com" : "https://checkout-test.adyen.com";

function resolveCountryCode(requested: string | undefined, currency: string): string {
  if (requested && /^[A-Z]{2}$/.test(requested)) {
    return requested;
  }
  if (currency.toUpperCase() === "EUR") {
    return "MT";
  }
  return "RW";
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

    const payload = (await req.json()) as AdyenCheckoutRequest;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return errorResponse(400, "empty_cart", "At least one cart item is required");
    }

    const paymentProvider = (payload.payment_provider ?? "adyen").toLowerCase();
    if (paymentProvider !== "adyen") {
      return errorResponse(400, "unsupported_provider", "This endpoint only handles Adyen checkout");
    }

    const tableSessionId =
      req.headers.get("x-icupa-session") ?? req.headers.get("x-ICUPA-session") ?? "";
    if (!tableSessionId) {
      return errorResponse(401, "missing_session", "x-icupa-session header is required");
    }

    const client = createServiceRoleClient();
    const sessionContext = await resolveSessionContext(client, tableSessionId);

    const requestedCurrency = (payload.currency ?? sessionContext.currency ?? "EUR").toUpperCase();
    if (requestedCurrency !== "EUR") {
      return errorResponse(400, "unsupported_currency", "Adyen checkout currently supports EUR only");
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
      "adyen",
    );

    // Pre-populate provider_ref with the payment identifier so webhooks can reconcile even if Adyen
    // does not return a payment link identifier.
    const seedProviderRef = await client
      .from("payments")
      .update({ provider_ref: paymentId })
      .eq("id", paymentId);

    if (seedProviderRef.error) {
      console.error("Failed to seed provider reference for Adyen payment", seedProviderRef.error, { paymentId });
    }

    if (!ADYEN_API_KEY || !ADYEN_MERCHANT_ACCOUNT) {
      console.error("Adyen credentials are not configured; returning pending status", { orderId, paymentId });
      return jsonResponse(
        {
          order_id: orderId,
          payment_id: paymentId,
          payment_status: "pending",
          payment_method: paymentProvider,
          message:
            "Adyen credentials are not configured in this environment. Configure ADYEN_API_KEY and ADYEN_MERCHANT_ACCOUNT to enable checkout.",
        },
        202,
      );
    }

    const successUrl =
      payload.success_url ?? req.headers.get("origin") ?? "https://icupa.local";
    const countryCode = resolveCountryCode(payload.country_code, requestedCurrency);
    const shopperLocale = req.headers.get("accept-language")?.split(",")?.[0] ?? "en-MT";

    const lineItems = items
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const modifierTotal = (item.modifiers ?? []).reduce((sum, modifier) => {
          const value = Number(modifier?.price_cents ?? 0);
          return sum + (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);
        }, 0);
        const baseAmount = Math.max(0, Math.floor((item.unit_price_cents ?? 0) + modifierTotal));

        return {
          quantity: Math.max(0, Math.floor(item.quantity ?? 0)),
          amountIncludingTax: baseAmount,
          description: item.name ?? "Menu item",
        };
      });

    if (totals.taxCents > 0) {
      lineItems.push({
        quantity: 1,
        amountIncludingTax: totals.taxCents,
        description: "Tax",
      });
    }

    if (totals.serviceCents > 0) {
      lineItems.push({
        quantity: 1,
        amountIncludingTax: totals.serviceCents,
        description: "Service charge",
      });
    }

    if (totals.tipCents > 0) {
      lineItems.push({
        quantity: 1,
        amountIncludingTax: totals.tipCents,
        description: "Tip",
      });
    }

    const requestBody = {
      merchantAccount: ADYEN_MERCHANT_ACCOUNT,
      reference: paymentId,
      returnUrl: `${successUrl}`,
      amount: {
        currency: requestedCurrency,
        value: totals.totalCents,
      },
      countryCode,
      description: `ICUPA order ${orderId}`,
      shopperLocale,
      shopperReference: sessionContext.tableSessionId,
      storePaymentMethod: false,
      lineItems,
    };

    const response = await fetch(`${ADYEN_BASE_URL}/${ADYEN_CHECKOUT_VERSION}/paymentLinks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": ADYEN_API_KEY,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorPayload = await response.text();
      console.error("Adyen paymentLinks request failed", {
        status: response.status,
        statusText: response.statusText,
        body: errorPayload,
        orderId,
        paymentId,
      });
      return errorResponse(502, "adyen_checkout_error", "Failed to initiate Adyen checkout");
    }

    const checkoutPayload = (await response.json()) as {
      id?: string;
      url?: string;
      expiresAt?: string;
    };

    if (checkoutPayload.id) {
      const updateResult = await client
        .from("payments")
        .update({ provider_ref: checkoutPayload.id })
        .eq("id", paymentId);

      if (updateResult.error) {
        console.error("Failed to persist Adyen payment link identifier", updateResult.error, { paymentId });
      }
    }

    const eventInsert = await client.from("events").insert({
      tenant_id: sessionContext.tenantId,
      location_id: sessionContext.locationId,
      table_session_id: sessionContext.tableSessionId,
      type: "payment.checkout.created",
      payload: {
        order_id: orderId,
        payment_id: paymentId,
        adyen_payment_link_id: checkoutPayload.id ?? null,
      },
    });

    if (eventInsert.error) {
      console.error("Failed to record Adyen checkout event", eventInsert.error, { orderId, paymentId });
    }

    return jsonResponse({
      order_id: orderId,
      payment_id: paymentId,
      payment_status: "pending",
      payment_method: paymentProvider,
      checkout_url: checkoutPayload.url ?? null,
      provider_ref: checkoutPayload.id ?? paymentId,
      currency: requestedCurrency,
      total_cents: totals.totalCents,
      expires_at: checkoutPayload.expiresAt ?? null,
    });
  } catch (error) {
    console.error("Adyen checkout error", error);
    return errorResponse(500, "adyen_checkout_error", "Failed to initiate Adyen checkout");
  }
});
