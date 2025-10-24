"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CardGlass, Badge, buttonClassName } from "@ecotrips/ui";
import { createEcoTripsFunctionClient } from "@ecotrips/api";

import { PromoPricingFooter } from "../components/PromoPricingFooter";

interface ResultItem {
  id?: string;
  name?: string;
  supplier?: string;
  price_cents: number;
  currency?: string;
}

interface ResultsListProps {
  title: string;
  subtitle: string;
  items: ResultItem[];
  defaultCurrency: string;
}

const DISPLAY_CURRENCIES = ["USD", "EUR", "RWF"] as const;

const FX_TABLE: Record<string, Record<string, number>> = {
  USD: { USD: 1, EUR: 0.92, RWF: 1285 },
  EUR: { EUR: 1, USD: 1.087, RWF: 1400 },
  RWF: { RWF: 1, USD: 0.00078, EUR: 0.00071 },
};

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

function convertAmount(
  amountCents: number,
  from: string,
  to: string,
  dynamicRates: Record<string, number>,
): number {
  if (from === to) return amountCents;
  const key = `${from}_${to}`;
  const table = FX_TABLE[from] ?? FX_TABLE.USD;
  const fallbackRate = table?.[to] ?? 1;
  const rate = dynamicRates[key] ?? fallbackRate;
  return Math.round(amountCents * rate);
}

export function ResultsList({ title, subtitle, items, defaultCurrency }: ResultsListProps) {
  const normalizedDefault = defaultCurrency.toUpperCase();
  const [currency, setCurrency] = useState(normalizedDefault);
  const [fxRates, setFxRates] = useState<Record<string, number>>({
    [`${normalizedDefault}_${normalizedDefault}`]: 1,
  });

  useEffect(() => {
    const normalized = defaultCurrency.toUpperCase();
    setFxRates((prev) => ({
      ...prev,
      [`${normalized}_${normalized}`]: 1,
    }));
  }, [defaultCurrency]);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFxRates() {
      const client = await clientPromise;
      if (!client) {
        setFxRates((prev) => ({
          ...prev,
          [`${currency}_${currency}`]: 1,
        }));
        return;
      }

      const normalizedCurrency = currency.toUpperCase();
      const uniqueSources = new Set<string>();
      for (const item of items) {
        const source = (item.currency ?? defaultCurrency).toUpperCase();
        uniqueSources.add(source);
      }
      uniqueSources.add(normalizedDefault);

      const queries = Array.from(uniqueSources)
        .filter((source) => source !== normalizedCurrency)
        .map(async (source) => {
          try {
            const result = await client.finance.quoteFx({
              base_currency: source,
              quote_currency: normalizedCurrency,
              amount_cents: 10_000,
            });
            if (result.ok && typeof result.rate === "number" && Number.isFinite(result.rate)) {
              return { key: `${source}_${normalizedCurrency}`, rate: result.rate };
            }
          } catch (error) {
            console.error("finance.quoteFx failed", { source, quote: normalizedCurrency, error });
          }
          return null;
        });

      const results = await Promise.all(queries);
      if (cancelled) return;
      setFxRates((prev) => {
        const next = { ...prev };
        next[`${normalizedCurrency}_${normalizedCurrency}`] = 1;
        for (const entry of results) {
          if (entry) {
            next[entry.key] = entry.rate;
          }
        }
        return next;
      });
    }

    void hydrateFxRates();

    return () => {
      cancelled = true;
    };
  }, [items, currency, defaultCurrency]);

  const enriched = useMemo(() => {
    return items.map((item) => {
      const sourceCurrency = (item.currency ?? defaultCurrency).toUpperCase();
      const price = convertAmount(item.price_cents, sourceCurrency, currency, fxRates);
      return { ...item, displayPrice: price, sourceCurrency };
    });
  }, [items, currency, defaultCurrency, fxRates]);

  return (
    <CardGlass title={title} subtitle={`${subtitle} · currency ${currency}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/70">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Dynamic promos</Badge>
          <span>Switcher keeps VAT inclusive pricing transparent.</span>
        </div>
        <label className="flex items-center gap-2 text-xs">
          <span className="uppercase tracking-wide text-white/50">Currency</span>
          <select
            value={currency}
            onChange={(event) => setCurrency(event.target.value.toUpperCase())}
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-1 text-white focus:outline-none focus:ring-2 focus:ring-sky-400"
          >
            {DISPLAY_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
      </div>
      {enriched.length === 0 ? (
        <p className="text-sm text-white/80">
          No live inventory yet. Offline cache fixtures keep the experience responsive; PlannerCoPilot will notify once suppliers respond.
        </p>
      ) : (
        <ul className="space-y-4">
          {enriched.map((item, index) => {
            const stableId = item.id ?? `fixture-${index}`;
            return (
              <li key={stableId} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold">{item.name ?? "Itinerary option"}</h3>
                      <Badge variant="default">VAT inclusive</Badge>
                    </div>
                    <p className="text-sm text-white/70">Supplier {item.supplier ?? "tbd"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold text-sky-200">
                      {currency} {Math.round(item.displayPrice / 100).toLocaleString()}
                    </p>
                    <p className="text-xs text-white/60">Converted from {item.sourceCurrency} · VAT & levies included</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/itinerary/${stableId}`} className={buttonClassName("glass")}>
                    View itinerary
                  </Link>
                  <Link href={`/itinerary/${stableId}?action=quote`} className={buttonClassName("secondary")}>
                    Request quote
                  </Link>
                </div>
                <PromoPricingFooter
                  itineraryId={stableId}
                  baseTotalCents={item.displayPrice}
                  currency={currency}
                />
              </li>
            );
          })}
        </ul>
      )}
    </CardGlass>
  );
}
