"use client";

import { useMemo, useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
import { CheckoutInput, type PaymentEscalationAction, type PaymentEscalationResponse } from "@ecotrips/types";
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
  const [escalation, setEscalation] = useState<PaymentEscalationResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const baseIdempotencyKey = useMemo(() => `intent-${itineraryId}`, [itineraryId]);

  const deriveFailureCode = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (message.includes("stripe_unavailable") || message.includes("429")) {
      return "stripe_unavailable";
    }
    if (message.toLowerCase().includes("declined")) {
      return "card_declined";
    }
    return "unknown";
  };

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
      setToast({ id: "validation", title: "Fix checkout inputs", description: "Amount and currency required." });
      return false;
    }
    const client = await clientPromise;
    if (!client) {
      setToast({ id: "offline", title: "Offline mode", description: "Showing ledger fixtures until auth is granted." });
      return false;
    }

    try {
      setIsSubmitting(true);
      const response = await client.call("checkout.intent", parsed.data, { idempotencyKey: parsed.data.idempotencyKey });
      setIntent(response.payment_intent_id ?? null);
      setToast({ id: "success", title: "Checkout ready", description: `Intent ${response.payment_intent_id ?? "fixture"}` });
      setEscalation(null);
      return true;
    } catch (error) {
      console.error(error);
      setIntent(null);
      await resolveEscalation(client, parsed.data, error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusColors: Record<string, string> = {
    pass: "bg-emerald-400",
    warn: "bg-amber-400",
    fail: "bg-rose-500",
  };

  const formatTimestamp = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, { hour12: false });
  };

  const handleAction = async (action: PaymentEscalationAction) => {
    if (action.cta_type === "retry_intent") {
      setActionBusy(action.id);
      try {
        await submit({ idempotencyKey: action.idempotency_hint ?? baseIdempotencyKey });
      } finally {
        setActionBusy(null);
      }
      return;
    }

    if (action.cta_type === "open_url" && action.href) {
      if (action.href.startsWith("http")) {
        window.open(action.href, "_blank", "noopener");
      } else {
        window.location.href = action.href;
      }
      return;
    }

    if (action.cta_type === "copy_text" && action.text) {
      try {
        await navigator.clipboard?.writeText(action.text);
        setToast({ id: `copy-${action.id}`, title: "Copied", description: "Checklist copied to clipboard." });
      } catch (copyError) {
        console.error("clipboard", copyError);
        setToast({ id: `copy-${action.id}`, title: "Copy failed", description: action.text });
      }
      return;
    }

    if (action.cta_type === "contact_ops") {
      const description = action.contact_channel
        ? `Ping ${action.contact_channel} with the latest request ID.`
        : "Notify the finance duty manager.";
      setToast({ id: action.id, title: "Escalate to ops", description });
      if (action.contact_channel?.startsWith("http")) {
        window.open(action.contact_channel, "_blank", "noopener");
      }
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
      <Button fullWidth onClick={() => submit()} disabled={isSubmitting}>
        {isSubmitting ? "Creating intent…" : "Create payment intent"}
      </Button>
      {intent && <p className="text-sm text-sky-200">Payment intent {intent}</p>}
      {escalation && (
        <div className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          <div>
            <p className="text-base font-semibold text-white">{escalation.headline}</p>
            <p className="mt-1 text-xs text-white/70">{escalation.summary}</p>
          </div>
          <div className="space-y-3">
            {escalation.next_actions.map((action) => (
              <div key={action.id} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">{action.title}</p>
                    <p className="mt-1 text-xs text-white/70">{action.description}</p>
                    {action.wait_seconds && (
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">
                        Wait {action.wait_seconds}s before executing.
                      </p>
                    )}
                    {action.idempotency_hint && (
                      <p className="mt-1 text-[11px] uppercase tracking-wide text-white/40">
                        Idempotency {action.idempotency_hint}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => handleAction(action)}
                    disabled={isSubmitting || actionBusy === action.id}
                  >
                    {actionBusy === action.id ? "Working…" : action.cta_label}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Health checks</p>
            <ul className="mt-2 space-y-3 text-sm">
              {escalation.health_checks.map((check) => {
                const timestamp = formatTimestamp(check.last_checked);
                return (
                  <li key={check.id} className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${statusColors[check.status] ?? statusColors.pass}`}></span>
                    <div>
                      <p className="text-sm font-medium text-white">{check.name}</p>
                      <p className="text-xs text-white/70">{check.detail}</p>
                      {timestamp && (
                        <p className="text-[10px] uppercase tracking-wide text-white/40">Checked {timestamp}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-sm -translate-x-1/2">
        {toast && <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
