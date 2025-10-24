"use client";

import { useMemo, useState } from "react";
import { Button, Toast } from "@ecotrips/ui";
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

interface PromoPricingFooterProps {
  itineraryId: string;
  baseTotalCents: number;
  currency: string;
}

interface PromoState {
  code: string;
  discountCents: number;
  totalAfterCents: number;
  loyaltyPoints: number;
  message?: string;
}

const formatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function PromoPricingFooter({ itineraryId, baseTotalCents, currency }: PromoPricingFooterProps) {
  const [promoCode, setPromoCode] = useState("");
  const [state, setState] = useState<PromoState | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ id: string; title: string; description?: string } | null>(null);

  const formattedBase = useMemo(() => formatCurrency(baseTotalCents, currency), [baseTotalCents, currency]);
  const formattedTotal = useMemo(() => {
    if (!state) return null;
    return formatCurrency(state.totalAfterCents, currency);
  }, [state, currency]);

  const discountDisplay = useMemo(() => {
    if (!state) return null;
    return formatCurrency(state.discountCents, currency);
  }, [state, currency]);

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code || code.length < 3) {
      setToast({ id: "promo-invalid", title: "Promo required", description: "Enter a promo code to apply savings." });
      return;
    }
    const client = await clientPromise;
    if (!client) {
      setToast({ id: "promo-offline", title: "Offline mode", description: "Connect Supabase to apply promos." });
      return;
    }
    setLoading(true);
    try {
      const response = await client.pricing.apply({
        itinerary_id: itineraryId,
        promo_code: code,
        base_total_cents: baseTotalCents,
        currency,
        line_items: [
          { id: "itinerary", label: "Itinerary base", quantity: 1, amount_cents: baseTotalCents },
        ],
      });
      if (!response.ok) {
        setToast({ id: "promo-error", title: "Promo rejected", description: response.message ?? "Try another code." });
        return;
      }
      setState({
        code,
        discountCents: response.discount_cents ?? 0,
        totalAfterCents: response.total_after_cents ?? baseTotalCents,
        loyaltyPoints: response.loyalty_points ?? 0,
        message: response.message,
      });
      setToast({ id: "promo-success", title: "Promo applied", description: response.message ?? "Savings locked in." });
    } catch (error) {
      console.error("pricing.apply failed", error);
      setToast({ id: "promo-error", title: "Promo failed", description: "Pricing apply edge function offline." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 space-y-3 text-sm text-white/80">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:gap-3">
        <label className="flex-1">
          <span className="block text-xs uppercase tracking-wide text-white/50">Promo code</span>
          <input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value)}
            placeholder="ECOLOYALTY"
            className="mt-1 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </label>
        <Button onClick={applyPromo} disabled={loading}>
          {loading ? "Applying…" : "Apply promo"}
        </Button>
      </div>
      <dl className="space-y-1">
        <div className="flex items-center justify-between">
          <dt>Base total</dt>
          <dd className="font-medium text-white">{formattedBase}</dd>
        </div>
        {state && (
          <>
            <div className="flex items-center justify-between text-rose-200">
              <dt>Savings ({state.code})</dt>
              <dd>-{discountDisplay}</dd>
            </div>
            <div className="flex items-center justify-between text-sky-200">
              <dt>New total</dt>
              <dd>{formattedTotal}</dd>
            </div>
            <div className="flex items-center justify-between text-xs text-amber-200/90">
              <dt>Loyalty points</dt>
              <dd>{state.loyaltyPoints.toLocaleString()}</dd>
            </div>
            {state.message && <p className="text-xs text-white/60">{state.message}</p>}
          </>
        )}
        {!state && (
          <p className="text-xs text-white/50">Promo savings and loyalty multipliers are logged to pricing.applications for audit.</p>
        )}
      </dl>
      <div className="fixed bottom-24 left-1/2 z-40 w-full max-w-sm -translate-x-1/2">
        {toast && (
          <Toast id={toast.id} title={toast.title} description={toast.description} onDismiss={() => setToast(null)} />
        )}
      </div>
    </div>
  );
}

function formatCurrency(amountCents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amountCents / 100);
  } catch (_error) {
    return formatter.format(amountCents / 100);
  }
}
