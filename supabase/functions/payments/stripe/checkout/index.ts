import Stripe from "npm:stripe@12.18.0";
import {
  calculateTotals,
  createOrderAndPayment,
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  resolveSessionContext,
  startEdgeTrace,
  type PaymentCartItem,
} from "../../../_shared/payments.ts";
import { readHeader } from "../../../_shared/headers.ts";

interface StripeCheckoutRequest {
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
}

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_ACCOUNT = Deno.env.get("STRIPE_ACCOUNT_ID") ?? undefined;

export async function handleStripeCheckout(req: Request): Promise<Response> {
  const span = startEdgeTrace('payments.stripe.checkout');
  let client;
  let sessionContext;

  try {
    if (req.method !== "POST") {
      return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
    }

    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
    }

    const payload = (await req.json()) as StripeCheckoutRequest;
    const items = Array.isArray(payload.items) ? payload.items : [];

    if (items.length === 0) {
      return errorResponse(400, "empty_cart", "At least one cart item is required");
    }

    const paymentProvider = (payload.payment_provider ?? "stripe").toLowerCase();
    if (paymentProvider !== "stripe" && paymentProvider !== "adyen") {
      return errorResponse(400, "unsupported_provider", "Stripe/Adyen checkout is required for this endpoint");
    }

    const tableSessionId = readHeader(req, 'x-icupa-session') ?? '';
    if (!tableSessionId) {
      return errorResponse(401, 'missing_session', 'x-icupa-session header is required');
    }

    client = createServiceRoleClient();
    sessionContext = await resolveSessionContext(client, tableSessionId);

    const requestedCurrency = (payload.currency ?? sessionContext.currency ?? "EUR").toUpperCase();
    if (requestedCurrency !== "EUR") {
      return errorResponse(400, "unsupported_currency", "Stripe checkout currently supports EUR only");
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
      "stripe"
    );

    if (!STRIPE_SECRET_KEY) {
      await span.end(client, {
        status: 'error',
        tenantId: sessionContext.tenantId,
        locationId: sessionContext.locationId,
        tableSessionId: sessionContext.tableSessionId,
        errorMessage: 'stripe_secret_missing',
      });
      return errorResponse(
        503,
        "stripe_not_configured",
        "Stripe secret is not configured for this deployment. Configure STRIPE_SECRET_KEY and redeploy before enabling card payments.",
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
      stripeAccount: STRIPE_ACCOUNT,
    });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = items
      .filter((item) => item.quantity > 0)
      .map((item) => {
        const modifierTotal = (item.modifiers ?? []).reduce(
          (sum, modifier) => sum + Math.max(0, Math.floor(modifier.price_cents ?? 0)),
          0
        );
        const unitAmount = Math.max(0, Math.floor((item.unit_price_cents ?? 0) + modifierTotal));
        return {
          quantity: Math.floor(item.quantity),
          price_data: {
            currency: requestedCurrency.toLowerCase(),
            unit_amount: unitAmount,
            product_data: {
              name: item.name ?? "Menu item",
            },
          },
        } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
      });

    if (totals.taxCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: requestedCurrency.toLowerCase(),
          unit_amount: totals.taxCents,
          product_data: { name: "Tax" },
        },
      });
    }

    if (totals.serviceCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: requestedCurrency.toLowerCase(),
          unit_amount: totals.serviceCents,
          product_data: { name: "Service charge" },
        },
      });
    }

    if (totals.tipCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: requestedCurrency.toLowerCase(),
          unit_amount: totals.tipCents,
          product_data: { name: "Tip" },
        },
      });
    }

    const origin = req.headers.get("origin") ?? "https://icupa.local";
    const successUrl = payload.success_url ?? `${origin}/?payment=success&order=${orderId}`;
    const cancelUrl = payload.cancel_url ?? `${origin}/?payment=cancelled&order=${orderId}`;

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "payment",
      payment_method_types: ["card"],
      success_url: successUrl,
      cancel_url: cancelUrl,
      line_items: lineItems,
      client_reference_id: orderId,
      metadata: {
        order_id: orderId,
        payment_id: paymentId,
        tenant_id: sessionContext.tenantId,
        location_id: sessionContext.locationId,
        table_session_id: sessionContext.tableSessionId,
      },
      payment_intent_data: {
        metadata: {
          order_id: orderId,
          payment_id: paymentId,
        },
      },
      custom_text: {
        submit: {
          message: "You will return to ICUPA once payment completes",
        },
      },
    };

    // Use Stripe idempotency to guard against duplicate checkout attempts for the same payment/order
    // We prefer a deterministic key derived from the paymentId which is unique per provisional payment row.
    const idempotencyKey = `icupa_checkout_${paymentId}`;
    const session = await stripe.checkout.sessions.create(sessionParams, { idempotencyKey });

    const providerRef = session.id ?? session.payment_intent ?? null;
    if (providerRef) {
      const updateResult = await client
        .from("payments")
        .update({ provider_ref: typeof providerRef === "string" ? providerRef : String(providerRef) })
        .eq("id", paymentId);
      if (updateResult.error) {
        console.error("Failed to update payment provider ref", updateResult.error, { paymentId });
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
        checkout_session_id: session.id,
      },
    });

    if (eventInsert.error) {
      console.error("Failed to record checkout event", eventInsert.error, {
        orderId,
        paymentId,
      });
    }

    const response = jsonResponse({
      order_id: orderId,
      payment_id: paymentId,
      payment_status: "pending",
      payment_method: paymentProvider,
      checkout_url: session.url,
      session_id: session.id,
      currency: requestedCurrency,
      total_cents: totals.totalCents,
    });
    await span.end(client, {
      status: 'success',
      tenantId: sessionContext.tenantId,
      locationId: sessionContext.locationId,
      tableSessionId: sessionContext.tableSessionId,
      attributes: {
        payment_id: paymentId,
        order_id: orderId,
        total_cents: totals.totalCents,
      },
    });
    return response;
  } catch (error) {
    console.error("Stripe checkout error", error);
    if (client && sessionContext) {
      await span.end(client, {
        status: 'error',
        tenantId: sessionContext.tenantId,
        locationId: sessionContext.locationId,
        tableSessionId: sessionContext.tableSessionId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    return errorResponse(500, "stripe_checkout_error", "Failed to initiate Stripe checkout");
  }
}

export default handleStripeCheckout;
