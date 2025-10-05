import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import Stripe from "npm:stripe@12.18.0";
import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  markPaymentCaptured,
  markPaymentFailed,
} from "../../../_shared/payments.ts";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
const STRIPE_ACCOUNT = Deno.env.get("STRIPE_ACCOUNT_ID") ?? undefined;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: "2023-10-16", stripeAccount: STRIPE_ACCOUNT })
  : null;

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    return errorResponse(500, "stripe_not_configured", "Stripe secrets missing on webhook endpoint");
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return errorResponse(400, "missing_signature", "Stripe signature header missing");
  }

  const rawBody = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return errorResponse(400, "invalid_signature", "Webhook signature verification failed");
  }

  const client = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const paymentIntentId = typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.payment_intent?.id;

        const captureResult = await markPaymentCaptured(client, {
          providerRef: session.id,
          captureAmountCents: session.amount_total ?? undefined,
          newProviderRef: paymentIntentId ?? undefined,
        });

        if (!captureResult && paymentIntentId) {
          await markPaymentCaptured(client, {
            providerRef: paymentIntentId,
            captureAmountCents: session.amount_total ?? undefined,
          });
        }
        break;
      }
      case "payment_intent.succeeded": {
        const intent = event.data.object as Stripe.PaymentIntent;
        await markPaymentCaptured(client, {
          providerRef: intent.id,
          captureAmountCents: intent.amount_received ?? intent.amount ?? undefined,
        });
        break;
      }
      case "payment_intent.payment_failed": {
        const failedIntent = event.data.object as Stripe.PaymentIntent;
        await markPaymentFailed(client, failedIntent.id, failedIntent.last_payment_error?.message);
        break;
      }
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        if (typeof charge.payment_intent === "string") {
          await markPaymentFailed(client, charge.payment_intent, "Refunded via Stripe");
        }
        break;
      }
      default: {
        console.log("Stripe webhook received", event.type);
      }
    }
  } catch (error) {
    console.error("Stripe webhook processing failed", error, { type: event.type });
    return errorResponse(500, "webhook_processing_failed", "Failed to process Stripe webhook");
  }

  return jsonResponse({ received: true });
});
