"use client";

import { useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { CheckoutInput } from "@ecotrips/types";

import { useOptionalFunctionClient } from "../../../lib/api/client-provider";
import { useAppStore } from "../../../lib/state/appStore";

export function CheckoutForm({ itineraryId }: { itineraryId: string }) {
  const [amount, setAmount] = useState(182000);
  const [currency, setCurrency] = useState("USD");
  const [toast, setToast] = useState<{ id: string; title: string; description?: string } | null>(null);
  const optionalClient = useOptionalFunctionClient();
  const checkoutResult = useAppStore((state) => state.checkoutResult);
  const setCheckoutResult = useAppStore((state) => state.setCheckoutResult);
  const setCheckoutLastInput = useAppStore((state) => state.setCheckoutLastInput);
  const resetCheckout = useAppStore((state) => state.resetCheckout);
  const checkoutIntent = checkoutResult?.payment_intent_id ?? null;

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
      resetCheckout();
      return;
    }
    setCheckoutLastInput(parsed.data);
    const client = optionalClient;
    if (!client) {
      setToast({ id: "offline", title: "Offline mode", description: "Showing ledger fixtures until auth is granted." });
      setCheckoutResult(null);
      return;
    }

    try {
      const response = await client.call("checkout.intent", parsed.data, { idempotencyKey: parsed.data.idempotencyKey });
      setCheckoutResult(response);
      setToast({ id: "success", title: "Checkout ready", description: `Intent ${response.payment_intent_id ?? "fixture"}` });
    } catch (error) {
      console.error(error);
      setCheckoutResult(null);
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
      {checkoutIntent && <p className="text-sm text-sky-200">Payment intent {checkoutIntent}</p>}
      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
