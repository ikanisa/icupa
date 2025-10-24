"use client";

import { useEffect } from "react";
import { useFeatureFlag } from "@ecotrips/ui";

import { useAnalytics } from "./useAnalytics";

export function ExplainPrice({
  amountCents,
  currency,
  breakdown,
}: {
  amountCents: number;
  currency: string;
  breakdown?: string[];
}) {
  const explainEnabled = useFeatureFlag("client.explain_price.glass");
  const { track } = useAnalytics();

  useEffect(() => {
    if (!explainEnabled) return;
    track("explain_price_rendered", { currency, amount: amountCents });
  }, [amountCents, currency, explainEnabled, track]);

  if (!explainEnabled) {
    return (
      <p className="text-base font-semibold text-sky-200">
        {currency} {Math.round(amountCents / 100).toLocaleString()}
      </p>
    );
  }

  const total = Math.round(amountCents / 100).toLocaleString();
  const items = breakdown?.length ? breakdown : ["Lodging", "Guides", "Park permits"];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-sky-200/30 bg-gradient-to-br from-sky-500/20 via-slate-900/40 to-sky-900/10 px-4 py-3 text-right text-sm text-white/90 shadow-[0_0_40px_rgba(56,189,248,0.25)] backdrop-blur">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.35),transparent_60%)]" aria-hidden />
      <div className="relative">
        <p className="text-xs uppercase tracking-widest text-sky-200/80">ExplainPrice</p>
        <p className="text-lg font-semibold text-white">
          {currency} {total}
        </p>
        <ul className="mt-2 space-y-1 text-right text-xs text-white/70">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
