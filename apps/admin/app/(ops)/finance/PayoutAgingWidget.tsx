import { CardGlass } from "@ecotrips/ui";

import { createAdminServerClient } from "../../../lib/supabaseServer";
import { logAdminAction } from "../../../lib/logging";

type ReconRow = {
  id: string;
  amount_cents: number | null;
  currency: string | null;
  recorded_at: string | null;
  reconciled: boolean | null;
};

type BucketId = "recent" | "mid" | "old";

type BucketState = {
  id: BucketId;
  label: string;
  range: [number, number];
  count: number;
  totals: Map<string, { cents: number; count: number }>;
};

const BUCKETS: Record<BucketId, BucketState> = {
  recent: {
    id: "recent",
    label: "0–7 days",
    range: [0, 7],
    count: 0,
    totals: new Map(),
  },
  mid: {
    id: "mid",
    label: "8–14 days",
    range: [8, 14],
    count: 0,
    totals: new Map(),
  },
  old: {
    id: "old",
    label: ">14 days",
    range: [15, Number.POSITIVE_INFINITY],
    count: 0,
    totals: new Map(),
  },
};

export async function PayoutAgingWidget() {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return (
      <CardGlass title="Payout aging" subtitle="Supabase session missing. Sign in again to view reconciliation buckets.">
        <p className="text-sm text-yellow-100/80">
          Unable to load payout aging data without an authenticated Supabase session.
        </p>
      </CardGlass>
    );
  }

  const { data, error } = await supabase
    .from<ReconRow>("ops.v_finance_payouts_ext")
    .select("id,amount_cents,currency,recorded_at,reconciled")
    .order("recorded_at", { ascending: true });

  if (error) {
    logAdminAction("finance.recon.aging", { status: "error", message: error.message });
    return (
      <CardGlass title="Payout aging" subtitle="Reconciliation fixtures unavailable.">
        <p className="text-sm text-red-200/80">
          Failed to load reconciliation data. Check ops console fixtures or run payouts-recon again.
        </p>
      </CardGlass>
    );
  }

  const rows = Array.isArray(data) ? data : [];
  const bucketStates = new Map<BucketId, BucketState>(
    Object.entries(BUCKETS).map(([id, state]) => [id as BucketId, { ...state, totals: new Map(state.totals) }]),
  );
  const now = Date.now();

  for (const row of rows) {
    if (row.reconciled) {
      continue;
    }

    const recordedAt = toDate(row.recorded_at);
    if (!recordedAt) {
      continue;
    }

    const ageMs = Math.max(0, now - recordedAt.getTime());
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const bucket = selectBucket(bucketStates, ageDays);
    if (!bucket) {
      continue;
    }

    bucket.count += 1;
    const currency = normalizeCurrency(row.currency);
    const entry = bucket.totals.get(currency) ?? { cents: 0, count: 0 };
    entry.cents += Math.max(0, Number(row.amount_cents ?? 0));
    entry.count += 1;
    bucket.totals.set(currency, entry);
  }

  const summaries = Array.from(bucketStates.values());
  const outstanding = summaries.reduce((sum, bucket) => sum + bucket.count, 0);

  if (outstanding === 0) {
    return (
      <CardGlass title="Payout aging" subtitle="All fixture payouts are reconciled.">
        <p className="text-sm text-white/80">
          No unreconciled external payouts remain. Run the payouts reconciliation again after new statements arrive.
        </p>
      </CardGlass>
    );
  }

  return (
    <CardGlass title="Payout aging" subtitle="Outstanding external statements grouped by age.">
      <div className="grid gap-4 sm:grid-cols-3">
        {summaries.map((bucket) => (
          <div key={bucket.id} className="rounded-2xl bg-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-white/60">{bucket.label}</p>
            <p className="mt-2 text-3xl font-semibold text-white">{bucket.count}</p>
            <p className="mt-1 text-xs text-white/60">{bucket.count === 1 ? "unreconciled payout" : "unreconciled payouts"}</p>
            <p className="mt-3 text-xs text-white/70">{describeTotals(bucket)}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-white/40">
        Totals derive from fin.payouts_ext rows updated by the payouts-recon edge function fixtures.
      </p>
    </CardGlass>
  );
}

function toDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function selectBucket(states: Map<BucketId, BucketState>, ageDays: number): BucketState | null {
  for (const bucket of states.values()) {
    if (ageDays >= bucket.range[0] && ageDays <= bucket.range[1]) {
      return bucket;
    }
  }
  return null;
}

function normalizeCurrency(currency: string | null): string {
  if (!currency || typeof currency !== "string") {
    return "USD";
  }
  const trimmed = currency.trim();
  return trimmed.length === 0 ? "USD" : trimmed.toUpperCase();
}

function describeTotals(bucket: BucketState): string {
  if (bucket.count === 0) {
    return "No balance outstanding";
  }
  const parts = Array.from(bucket.totals.entries()).map(([currency, value]) => {
    const formatted = formatCurrency(value.cents, currency);
    return `${formatted} · ${value.count}x`;
  });
  return parts.join(" • ");
}

function formatCurrency(amountCents: number, currency: string): string {
  const amount = Math.max(0, amountCents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
