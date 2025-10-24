"use client";

import { useState } from "react";
import { Badge, Button, Toast } from "@ecotrips/ui";
import { CheckoutInput } from "@ecotrips/types";
import { createEcoTripsFunctionClient } from "@ecotrips/api";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Session } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const ALLOW_ANON_CHECKOUT = process.env.NEXT_PUBLIC_CHECKOUT_ALLOW_ANON === "1";

type ToastState = { id: string; title: string; description?: string } | null;

type BlockingMessageProps = { title: string; description: string };

function BlockingMessage({ title, description }: BlockingMessageProps) {
  return (
    <div className="space-y-2 rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-50">
      <p className="font-semibold text-red-100">{title}</p>
      <p className="text-red-200">{description}</p>
    </div>
  );
}

export function CheckoutForm({ itineraryId }: { itineraryId: string }) {
  const [amount, setAmount] = useState(182000);
  const [currency, setCurrency] = useState("USD");
  const [intent, setIntent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string; description?: string } | null>(null);
  const loyaltyProjection = Math.max(0, Math.round(amount / 100));

  const resolveEscalation = async (
    client: Awaited<typeof clientPromise>,
    payload: CheckoutInput,
    error: unknown,
  ) => {
    if (!client) {
      setToast({ id: "offline", title: "Offline mode", description: "Cannot load escalation guidance without auth." });
      return;
    }
    const failureCode = deriveFailureCode(error);
    try {
      const response = await client.call(
        "checkout.escalate",
        {
          itineraryId: payload.itineraryId,
          paymentId: intent ?? undefined,
          failureCode,
          idempotencyKey: payload.idempotencyKey,
          amountCents: payload.amountCents,
          currency: payload.currency,
        },
        { idempotencyKey: `escalate-${payload.idempotencyKey}` },
      );
      setEscalation(response);
      setToast({ id: "escalate", title: "Checkout failed", description: response.summary });
    } catch (escalateError) {
      console.error("payment-escalate", escalateError);
      setToast({ id: "error", title: "Checkout failed", description: "Could not load escalation guidance." });
    }
  };

  const submit = async (overrides?: Partial<CheckoutInput>) => {
    const parsed = CheckoutInput.safeParse({
      itineraryId,
      quoteId: itineraryId,
      amountCents: overrides?.amountCents ?? amount,
      currency: overrides?.currency ?? currency,
      paymentProvider: overrides?.paymentProvider ?? "stripe",
      idempotencyKey: overrides?.idempotencyKey ?? baseIdempotencyKey,
    });
    if (!parsed.success) {
      const details = parsed.error.issues.map((issue) => issue.message).join("\n");
      setToast({
        id: "validation",
        title: "Fix checkout inputs",
        description: details || "Amount and currency required.",
      });
      return;
    }

    if (!client) {
      setToast({
        id: "offline",
        title: "Checkout unavailable",
        description: "Supabase client unavailable. Check environment configuration and authentication state.",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await client.call("checkout.intent", parsed.data, { idempotencyKey: parsed.data.idempotencyKey });
      setIntent(response.payment_intent_id ?? null);
      setToast({ id: "success", title: "Checkout ready", description: `Intent ${response.payment_intent_id ?? "fixture"}` });
      setEscalation(null);
      const ledgerPaymentId = response.payment_id ?? null;
      const stripeIntentId = response.payment_intent ?? null;
      if (ledgerPaymentId || stripeIntentId) {
        const normalizedIntent = ledgerPaymentId ?? stripeIntentId ?? response.payment_intent_id ?? null;
        const normalizedIntentLabel = stripeIntentId ?? ledgerPaymentId ?? response.payment_intent_id ?? "fixture";
        setIntent(normalizedIntent);
        setToast({ id: "success", title: "Checkout ready", description: `Intent ${normalizedIntentLabel}` });
      }
      return true;
    } catch (error) {
      console.error(error);
      setToast(interpretError(error));
    } finally {
      setPending(false);
    }
  };

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <BlockingMessage
        title="Supabase configuration missing"
        description="Checkout requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to be set in the environment."
      />
    );
  }

  if (!sessionReady) {
    return (
      <div className="space-y-2 rounded-2xl border border-white/15 bg-white/5 p-6 text-sm text-white/70">
        <p className="font-semibold">Preparing checkout…</p>
        <p>Validating Supabase session before enabling payment intents.</p>
      </div>
    );
  }

  if (!ALLOW_ANON_CHECKOUT && !sessionAvailable) {
    return (
      <BlockingMessage
        title="Sign in required"
        description={authError ?? "Authenticate before creating a payment intent."}
      />
    );
  }

  return (
    <div className="space-y-4">
      {authError && ALLOW_ANON_CHECKOUT && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <p className="font-semibold">Authentication unavailable</p>
          <p className="text-amber-200">{authError}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <label className="flex flex-col gap-2">
          <span>Amount (cents)</span>
          <input
            type="number"
            value={amount}
            onChange={(event) => setAmount(Number(event.target.value))}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <label className="flex flex-col gap-2">
          <span>Currency</span>
          <input
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
      </div>
      <Button fullWidth disabled={pending} onClick={submit}>
        {pending ? "Creating payment intent…" : "Create payment intent"}
      </Button>
      {intent && <p className="text-sm text-sky-200">Payment intent {intent}</p>}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
        <div className="flex items-center gap-2">
          <Badge>Loyalty</Badge>
          <p className="font-medium text-white">Projected {loyaltyProjection.toLocaleString()} points</p>
        </div>
        <p className="mt-2 text-xs text-white/60">
          Granting runs through loyalty-grant edge function with request keys to keep ledger idempotent. Points settle once payment.capture succeeds.
        </p>
      </div>
      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
