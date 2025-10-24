import Link from "next/link";

import type {
  SupplierSlaForecastHealthCheck,
  SupplierSlaForecastResponse,
} from "@ecotrips/types";

import { getOpsFunctionClient } from "../../../lib/functionClient";
import supplierSlaFixtures from "../../../../../ops/fixtures/supplier_slas.json" assert { type: "json" };

type RiskLevel = "breach" | "warning" | "on_track";

type SupplierFixture = {
  supplier: string;
  tier: string;
  avg_confirmation_hours: number;
  open_confirms: number;
  breach_state: string;
  cancellations_pct: number;
  last_breach_at: string | null;
};

type SupplierHeatmapEntry = {
  supplier: string;
  displayName: string;
  tier: string;
  risk: RiskLevel;
  profileUrl: string;
  metrics: {
    avgConfirmationHours: number;
    openConfirms: number;
    cancellationsPct: number;
    breachState: string;
    lastBreachAt: string | null;
  };
};

type HeatmapSummary = {
  suppliers: number;
  byRisk: Record<RiskLevel, number>;
  byTier: Record<string, number>;
};

type HeatmapContext = {
  entries: SupplierHeatmapEntry[];
  summary: HeatmapSummary;
  offline: boolean;
  requestId: string | null;
  healthChecks: SupplierSlaForecastHealthCheck[];
  generatedAt: string | null;
  usedFixtures: boolean;
};

const palette: Record<RiskLevel, string> = {
  breach: "bg-rose-500/30 border-rose-300/50 text-rose-100",
  warning: "bg-amber-500/30 border-amber-300/50 text-amber-50",
  on_track: "bg-emerald-500/20 border-emerald-200/40 text-emerald-50",
};

const badgePalette: Record<RiskLevel, string> = {
  breach: "bg-rose-500/50 text-rose-50",
  warning: "bg-amber-500/60 text-amber-50",
  on_track: "bg-emerald-500/50 text-emerald-50",
};

const riskLabels: Record<RiskLevel, string> = {
  breach: "Breach",
  warning: "Warning",
  on_track: "On Track",
};

const healthStatusPalette: Record<"pass" | "warn" | "fail", string> = {
  pass: "bg-emerald-500/20 text-emerald-50 border-emerald-200/40",
  warn: "bg-amber-500/20 text-amber-50 border-amber-200/50",
  fail: "bg-rose-500/20 text-rose-50 border-rose-200/50",
};

const healthStatusLabel: Record<"pass" | "warn" | "fail", string> = {
  pass: "Pass",
  warn: "Warn",
  fail: "Fail",
};

const fixturesData = Array.isArray(supplierSlaFixtures)
  ? (supplierSlaFixtures as SupplierFixture[])
  : [];

const heatmapEntries: SupplierHeatmapEntry[] = fixturesData.map((fixture) => {
  const risk = deriveRisk(fixture);
  return {
    supplier: fixture.supplier,
    displayName: formatSupplierName(fixture.supplier),
    tier: fixture.tier,
    risk,
    profileUrl: `/ops/suppliers/${fixture.supplier}`,
    metrics: {
      avgConfirmationHours: fixture.avg_confirmation_hours,
      openConfirms: fixture.open_confirms,
      cancellationsPct: fixture.cancellations_pct,
      breachState: fixture.breach_state,
      lastBreachAt: fixture.last_breach_at,
    },
  };
});

const summary = heatmapEntries.reduce(
  (acc, entry) => {
    acc.byRisk[entry.risk] = (acc.byRisk[entry.risk] ?? 0) + 1;
    acc.byTier[entry.tier] = (acc.byTier[entry.tier] ?? 0) + 1;
    return acc;
  },
  {
    byRisk: { breach: 0, warning: 0, on_track: 0 } as Record<RiskLevel, number>,
    byTier: {} as Record<string, number>,
  },
);

const fallbackSummary: HeatmapSummary = {
  suppliers: heatmapEntries.length,
  byRisk: summary.byRisk,
  byTier: summary.byTier,
};

function deriveRisk(record: SupplierFixture): RiskLevel {
  if (record.breach_state === "breach") return "breach";
  if (record.breach_state === "warning") return "warning";

  if (
    record.avg_confirmation_hours >= 12 ||
    record.cancellations_pct >= 5 ||
    record.open_confirms >= 5
  ) {
    return "breach";
  }

  if (
    record.avg_confirmation_hours >= 8 ||
    record.cancellations_pct >= 3 ||
    record.open_confirms >= 3
  ) {
    return "warning";
  }

  return "on_track";
}

function formatSupplierName(slug: string) {
  return slug
    .split("-")
    .map((piece) => piece.charAt(0).toUpperCase() + piece.slice(1))
    .join(" ");
}

async function loadSupplierSlaForecast(): Promise<HeatmapContext> {
  try {
    const client = await getOpsFunctionClient();
    if (!client) {
      return {
        entries: heatmapEntries,
        summary: fallbackSummary,
        offline: true,
        requestId: null,
        healthChecks: [],
        generatedAt: null,
        usedFixtures: true,
      };
    }

    const response = await client.call("ops.supplierSlaForecast", {});
    if (!response.ok || !Array.isArray(response.heatmap)) {
      return {
        entries: heatmapEntries,
        summary: fallbackSummary,
        offline: true,
        requestId: response.request_id ?? null,
        healthChecks: response.health_checks ?? [],
        generatedAt: response.generated_at ?? null,
        usedFixtures: true,
      };
    }

    const entries = response.heatmap.map((entry) => mapForecastEntry(entry));
    const summaryFromApi = computeSummaryFromEntries(entries);

    return {
      entries,
      summary: summaryFromApi,
      offline: false,
      requestId: response.request_id ?? null,
      healthChecks: response.health_checks ?? [],
      generatedAt: response.generated_at ?? null,
      usedFixtures: false,
    };
  } catch (error) {
    console.error("supplier-sla-forecast failed", error);
    return {
      entries: heatmapEntries,
      summary: fallbackSummary,
      offline: true,
      requestId: null,
      healthChecks: [],
      generatedAt: null,
      usedFixtures: true,
    };
  }
}

function computeSummaryFromEntries(entries: SupplierHeatmapEntry[]): HeatmapSummary {
  const base: HeatmapSummary = {
    suppliers: entries.length,
    byRisk: { breach: 0, warning: 0, on_track: 0 },
    byTier: {},
  };

  for (const entry of entries) {
    base.byRisk[entry.risk] = (base.byRisk[entry.risk] ?? 0) + 1;
    base.byTier[entry.tier] = (base.byTier[entry.tier] ?? 0) + 1;
  }

  return base;
}

function mapForecastEntry(
  entry: NonNullable<SupplierSlaForecastResponse["heatmap"]>[number],
): SupplierHeatmapEntry {
  const metrics = entry.metrics ?? {};
  const risk = toRiskLevel(entry.risk);

  return {
    supplier: entry.supplier,
    displayName: typeof entry.display_name === "string" && entry.display_name
      ? entry.display_name
      : formatSupplierName(entry.supplier),
    tier: entry.tier,
    risk,
    profileUrl: entry.profile_url,
    metrics: {
      avgConfirmationHours: normalizeMetricNumber(metrics.avg_confirmation_hours),
      openConfirms: Math.max(0, Math.round(normalizeMetricNumber(metrics.open_confirms))),
      cancellationsPct: normalizeMetricNumber(metrics.cancellations_pct),
      breachState: typeof metrics.breach_state === "string" && metrics.breach_state
        ? metrics.breach_state
        : risk,
      lastBreachAt: typeof metrics.last_breach_at === "string" && metrics.last_breach_at
        ? metrics.last_breach_at
        : null,
    },
  };
}

function normalizeMetricNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function toRiskLevel(value: unknown): RiskLevel {
  if (value === "breach" || value === "warning" || value === "on_track") {
    return value;
  }
  return "on_track";
}

export function SupplierSlaHeatmap() {
  return loadSupplierSlaForecast().then((context) => renderHeatmap(context));
}

function renderHeatmap(context: HeatmapContext) {
  if (context.entries.length === 0) {
    return (
      <p className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        No SLA fixtures loaded. Confirm nightly sync job has populated
        <code className="ml-2 rounded bg-white/10 px-1 py-0.5 text-xs uppercase tracking-wide">
          supplier_slas.json
        </code>
        .
      </p>
    );
  }

  const summary = context.summary;
  const entries = context.entries;
  const healthChecks = context.healthChecks ?? [];

  return (
    <div className="space-y-5 text-sm text-white/80">
      <p className="text-xs text-white/60">
        Aggregated supplier confirmations grouped into SLA risk levels. Select a
        supplier to drill into the operational profile stub.
      </p>
      {context.usedFixtures && (
        <p className="rounded-lg border border-dashed border-amber-200/40 bg-amber-500/10 p-3 text-[11px] text-amber-100">
          Edge function unavailable — displaying the last synced fixture snapshot while
          <span className="ml-1 font-semibold">supplier-sla-forecast</span> recovers.
        </p>
      )}
      {context.generatedAt && (
        <p className="text-xs text-white/50">
          Forecast generated at {new Date(context.generatedAt).toLocaleString()}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <Link
            key={entry.supplier}
            href={entry.profileUrl}
            className={`group block rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${palette[entry.risk]}`}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold text-white">
                {entry.displayName}
              </span>
              <span
                className={`rounded-full px-2 py-1 text-[11px] uppercase tracking-wide ${badgePalette[entry.risk]}`}
              >
                {riskLabels[entry.risk]}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-white/70">
              <span className="font-medium uppercase tracking-wide text-white/80">
                Tier {entry.tier.toUpperCase()}
              </span>
              <span>{entry.metrics.openConfirms} open confirms</span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/70">
              <div>
                <dt className="text-white/50">Avg confirm hrs</dt>
                <dd className="text-white/90">
                  {entry.metrics.avgConfirmationHours.toFixed(1)}h
                </dd>
              </div>
              <div>
                <dt className="text-white/50">Cancellation %</dt>
                <dd className="text-white/90">
                  {entry.metrics.cancellationsPct.toFixed(1)}%
                </dd>
              </div>
              <div className="col-span-2 text-white/60">
                <dt className="text-white/50">Last breach</dt>
                <dd>{entry.metrics.lastBreachAt ? new Date(entry.metrics.lastBreachAt).toLocaleString() : "—"}</dd>
              </div>
            </dl>
            <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-white/70">
              View supplier profile
              <span aria-hidden className="transition group-hover:translate-x-1">→</span>
            </span>
          </Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[11px] text-white/60">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            SLA Snapshot
          </h3>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div>
              <dt className="text-white/40">Suppliers tracked</dt>
              <dd className="text-white/80">{summary.suppliers}</dd>
            </div>
            {(Object.keys(summary.byRisk) as RiskLevel[]).map((risk) => (
              <div key={risk}>
                <dt className="text-white/40">{riskLabels[risk]}</dt>
                <dd className="text-white/80">{summary.byRisk[risk]}</dd>
              </div>
            ))}
            {Object.entries(summary.byTier).map(([tier, count]) => (
              <div key={tier}>
                <dt className="text-white/40">Tier {tier.toUpperCase()}</dt>
                <dd className="text-white/80">{count}</dd>
              </div>
            ))}
          </dl>
          {context.requestId && (
            <p className="mt-3 text-[10px] uppercase tracking-wide text-white/40">
              Request ID {context.requestId}
            </p>
          )}
        </div>
        {healthChecks.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[11px] text-white/65">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/70">
              Function Health
            </h3>
            <ul className="mt-3 space-y-2">
              {healthChecks.map((check) => (
                <li
                  key={check.name}
                  className={`rounded-xl border p-3 text-white/70 ${healthStatusPalette[check.status]}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide">
                      {check.name.replace(/_/g, " ")}
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                      {healthStatusLabel[check.status]}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-white/60">
                    Observed {new Date(check.observed_at).toLocaleString()}
                  </p>
                  {check.detail && (
                    <p className="mt-1 text-[10px] text-white/55">{check.detail}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
