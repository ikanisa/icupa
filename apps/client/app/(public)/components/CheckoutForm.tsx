"use client";

import { useState } from "react";
import { Badge, Button, Toast } from "@ecotrips/ui";
import { CheckoutInput } from "@ecotrips/types";
import { createEcoTripsFunctionClient } from "@ecotrips/api";

const clientPromise = (async () => {
  if (typeof window === "undefined") return null;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createEcoTripsFunctionClient({
    supabaseUrl,
    anonKey,
    getAccessToken: async () => null,
  });
})();

export function CheckoutForm({ itineraryId }: { itineraryId: string }) {
  const [amount, setAmount] = useState(182000);
  const [currency, setCurrency] = useState("USD");
  const [intent, setIntent] = useState<string | null>(null);
  const [toast, setToast] = useState<{ id: string; title: string; description?: string } | null>(null);
  const loyaltyProjection = Math.max(0, Math.round(amount / 100));

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
      setToast({ id: "validation", title: "Fix checkout inputs", description: "Amount and currency required." });
      return;
    }
    const client = await clientPromise;
    if (!client) {
      setToast({ id: "offline", title: "Offline mode", description: "Showing ledger fixtures until auth is granted." });
      return;
    }

    try {
      const response = await client.call("checkout.intent", parsed.data, { idempotencyKey: parsed.data.idempotencyKey });
      setIntent(response.payment_intent_id ?? null);
      setToast({ id: "success", title: "Checkout ready", description: `Intent ${response.payment_intent_id ?? "fixture"}` });
    } catch (error) {
      console.error(error);
      setToast({ id: "error", title: "Checkout failed", description: "Using PAYMENT_MOCK fallback." });
    }
  };

  return (
    <div className="space-y-4">
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
      <Button fullWidth onClick={submit}>
        Create payment intent
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
