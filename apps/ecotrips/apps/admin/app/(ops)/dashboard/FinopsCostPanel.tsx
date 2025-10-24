import { CardGlass } from "@ecotrips/ui";

import type { AdminDatabase } from "../../../lib/databaseTypes";
import { createAdminServerClient } from "../../../lib/supabaseServer";

type CostEstimateRow = AdminDatabase["fin"]["Tables"]["cost_estimates"]["Row"];

type PresentableEstimate = Pick<CostEstimateRow, "month" | "category" | "label" | "estimated_cents" | "currency" | "confidence" | "usage_notes">;

const FALLBACK_ESTIMATES: PresentableEstimate[] = [
  {
    month: "2025-02-01",
    category: "llm_tokens",
    label: "Claude autopilot + concierge prompts",
    estimated_cents: 1285000,
    currency: "USD",
    confidence: "medium",
    usage_notes: "52M input/output tokens across concierge and ops pilot batches.",
  },
  {
    month: "2025-02-01",
    category: "storage",
    label: "Object storage buckets (invoices + media)",
    estimated_cents: 685000,
    currency: "USD",
    confidence: "high",
    usage_notes: "9.1 TB stored across invoices/, supplier_media/ with 45 day retention.",
  },
  {
    month: "2025-02-01",
    category: "egress",
    label: "Supabase → Vercel API responses",
    estimated_cents: 472000,
    currency: "USD",
    confidence: "medium",
    usage_notes: "High read volume from concierge itineraries + nightly analytics exports.",
  },
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

function formatCurrency(cents: number, currency: string) {
  const amount = Number.isFinite(cents) ? cents / 100 : 0;
  if (currency.toUpperCase() !== "USD") {
    return `${currency} ${amount.toFixed(2)}`;
  }
  return currencyFormatter.format(amount);
}

function formatMonth(value: string) {
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return monthFormatter.format(date);
  }
  return value;
}

function normalizeConfidence(confidence: PresentableEstimate["confidence"]) {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Directional";
    default:
      return "Estimate";
  }
}

function describeCategory(category: PresentableEstimate["category"]) {
  switch (category) {
    case "llm_tokens":
      return "LLM tokens";
    case "storage":
      return "Storage";
    case "egress":
      return "Network egress";
    default:
      return category;
  }
}

async function loadCostEstimates(): Promise<{ estimates: PresentableEstimate[]; offline: boolean }> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return { estimates: FALLBACK_ESTIMATES, offline: true };
  }

  const { data, error } = await supabase
    .from("fin.cost_estimates")
    .select("month,category,label,estimated_cents,currency,confidence,usage_notes")
    .order("estimated_cents", { ascending: false })
    .limit(5);

  if (error) {
    console.error("fin.cost_estimates", error);
    return { estimates: FALLBACK_ESTIMATES, offline: true };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { estimates: FALLBACK_ESTIMATES, offline: true };
  }

  const normalized = data
    .map((entry) => {
      if (!entry) {
        return null;
      }

      const estimatedCents =
        typeof entry.estimated_cents === "string"
          ? Number(entry.estimated_cents)
          : entry.estimated_cents;

      if (typeof estimatedCents !== "number" || Number.isNaN(estimatedCents)) {
        return null;
      }

      return {
        ...entry,
        estimated_cents: estimatedCents,
        currency: entry.currency ?? "USD",
        usage_notes: entry.usage_notes ?? null,
      } satisfies PresentableEstimate;
    })
    .filter((entry): entry is PresentableEstimate => entry !== null);

  if (normalized.length === 0) {
    return { estimates: FALLBACK_ESTIMATES, offline: true };
  }

  return { estimates: normalized.slice(0, 3), offline: false };
}

export async function FinopsCostPanel() {
  const { estimates, offline } = await loadCostEstimates();

  return (
    <CardGlass title="FinOps Cost Leaders" subtitle="Top three cost drivers from fin.cost_estimates fixtures.">
      <div className="space-y-4">
        {estimates.map((estimate) => {
          const key = `${estimate.month}-${estimate.category}`;
          return (
            <div key={key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-white/60">{formatMonth(estimate.month)}</p>
                  <p className="text-sm font-semibold text-white/90">{describeCategory(estimate.category)}</p>
                  <p className="text-xs text-white/70">{estimate.label}</p>
                </div>
                <div className="text-right text-xs text-white/60">
                  <p className="text-sm font-semibold text-sky-200">{formatCurrency(estimate.estimated_cents, estimate.currency)}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wide">{normalizeConfidence(estimate.confidence)}</p>
                </div>
              </div>
              {estimate.usage_notes ? (
                <p className="mt-3 text-xs text-white/60">{estimate.usage_notes}</p>
              ) : null}
            </div>
          );
        })}
      </div>
      {offline ? (
        <p className="mt-4 text-xs text-amber-200/80">
          Using seeded fallback estimates while Supabase session metadata is unavailable.
        </p>
      ) : null}
    </CardGlass>
  );
}
