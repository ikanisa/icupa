"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
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
  const [toast, setToast] = useState<ToastState>(null);
  const [pending, setPending] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionAvailable, setSessionAvailable] = useState(false);
  const [authError, setAuthError] = useState<string | null>(
    SUPABASE_URL && SUPABASE_ANON_KEY
      ? null
      : "Checkout unavailable. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  );
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      setSessionReady(true);
      setSessionAvailable(false);
      return;
    }

    const supabase = createClientComponentClient({
      supabaseUrl: SUPABASE_URL,
      supabaseKey: SUPABASE_ANON_KEY,
    });

    let mounted = true;

    const syncSession = (session: Session | null) => {
      if (!mounted) return;
      const hasSession = Boolean(session);
      setSessionAvailable(hasSession);
      setAccessToken(session?.access_token ?? null);
      if (!hasSession && !ALLOW_ANON_CHECKOUT) {
        setAuthError("Sign in to continue checkout.");
      } else {
        setAuthError(null);
      }
      setSessionReady(true);
    };

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) {
        setAuthError(`Unable to load session: ${error.message}`);
        setSessionReady(true);
        setSessionAvailable(false);
        return;
      }
      syncSession(data.session ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session);
    });

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  const client = useMemo(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
    return createEcoTripsFunctionClient({
      supabaseUrl: SUPABASE_URL,
      anonKey: SUPABASE_ANON_KEY,
      getAccessToken: async () => accessToken,
    });
  }, [accessToken]);

  const interpretError = (error: unknown): ToastState => {
    const fallback: ToastState = {
      id: "checkout_error",
      title: "Checkout failed",
      description: "An unexpected error occurred while creating the payment intent.",
    };

    const message = error instanceof Error ? error.message : String(error ?? "");
    const jsonStart = message.indexOf("{");
    let parsed: Record<string, unknown> | null = null;
    if (jsonStart >= 0) {
      try {
        parsed = JSON.parse(message.slice(jsonStart));
      } catch (_err) {
        parsed = null;
      }
    }

    if (parsed && Array.isArray(parsed.errors) && parsed.errors.length > 0) {
      const description = parsed.errors.map((item) => String(item)).join("\n");
      return {
        id: "validation",
        title: "Fix checkout inputs",
        description,
      };
    }

    if (parsed && typeof parsed.error === "string" && parsed.error === "stripe_unavailable") {
      const requestId = typeof parsed.request_id === "string" ? parsed.request_id : null;
      const fallbackMode = typeof parsed.fallback_mode === "string" ? parsed.fallback_mode : null;
      const reason = typeof parsed.message === "string"
        ? parsed.message
        : "Stripe temporarily unavailable.";
      const suffix = [
        requestId ? `Request ${requestId}` : null,
        fallbackMode ? `mode ${fallbackMode}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        id: "stripe_unavailable",
        title: "Stripe unavailable",
        description: suffix ? `${reason} (${suffix}).` : reason,
      };
    }

    const normalized = message.toLowerCase();
    if (normalized.includes("23505") || normalized.includes("duplicate key") || normalized.includes("idempotency")) {
      return {
        id: "idempotency_conflict",
        title: "Payment already initialized",
        description:
          "An existing payment intent already exists for this itinerary. Refresh to reuse it or adjust the idempotency key.",
      };
    }

    if (parsed && typeof parsed.message === "string" && parsed.message.toLowerCase().includes("idempotency")) {
      return {
        id: "idempotency_conflict",
        title: "Payment already initialized",
        description: parsed.message,
      };
    }

    return fallback;
  };

  const submit = async () => {
    const parsed = CheckoutInput.safeParse({
      itineraryId,
      quoteId: itineraryId,
      amountCents: amount,
      currency,
      paymentProvider: "stripe",
      idempotencyKey: `intent-${itineraryId}`,
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
      setPending(true);
      const response = await client.call("checkout.intent", parsed.data, {
        idempotencyKey: parsed.data.idempotencyKey,
      });
      const paymentIntentId =
        response.payment_intent_id ?? (response as { payment_intent?: string }).payment_intent ?? null;
      setIntent(paymentIntentId);

      const fallbackDetails = response as { fallback?: boolean; fallback_reason?: string; request_id?: string };
      if (fallbackDetails.fallback) {
        setToast({
          id: "fallback",
          title: "Stripe fallback active",
          description:
            fallbackDetails.fallback_reason ??
            "Stripe degraded. Using mock payment intent while live mode is unavailable.",
        });
        return;
      }

      setToast({
        id: "success",
        title: "Checkout ready",
        description: paymentIntentId ? `Intent ${paymentIntentId}` : "Payment intent created.",
      });
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
      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
