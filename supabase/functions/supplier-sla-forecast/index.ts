import { ERROR_CODES } from "../_obs/constants.ts";
import { emitMetric, getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import fixtures from "../../../ops/fixtures/supplier_slas.json" assert { type: "json" };

const FN_NAME = "supplier-sla-forecast";

type RiskLevel = "breach" | "warning" | "on_track";

type SupplierFixture = {
  supplier: unknown;
  tier: unknown;
  avg_confirmation_hours: unknown;
  open_confirms: unknown;
  breach_state: unknown;
  cancellations_pct: unknown;
  last_breach_at: unknown;
};

type SupplierRecord = {
  supplier: string;
  tier: string;
  avg_confirmation_hours: number;
  open_confirms: number;
  breach_state: string;
  cancellations_pct: number;
  last_breach_at: string | null;
  risk: RiskLevel;
};

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse(FN_NAME);
  }

  if (req.method !== "GET") {
    logEvent(requestId, "supplier.sla.method_not_allowed", { method: req.method });
    return jsonResponse({ ok: false, error: "method_not_allowed", request_id: requestId }, 405);
  }

  const tierFilter = normalizeString(url.searchParams.get("tier"));
  const riskFilterRaw = normalizeString(url.searchParams.get("risk"));
  const riskFilter = riskFilterRaw && isRiskLevel(riskFilterRaw) ? riskFilterRaw : null;

  const records = loadRecords();
  const filtered = records.filter((record) => {
    if (tierFilter && record.tier.toLowerCase() !== tierFilter) return false;
    if (riskFilter && record.risk !== riskFilter) return false;
    return true;
  });

  const totals = computeTotals(records);
  const visibleTotals = computeTotals(filtered);
  const buckets = computeBuckets(records);
  const healthChecks = buildHealthChecks(records);
  const heatmap = buildHeatmap(filtered);
  const samples = buildSamples(records);

  logEvent(requestId, "supplier.sla.forecast.generated", {
    suppliers: records.length,
    filtered_suppliers: filtered.length,
    filters: { tier: tierFilter ?? null, risk: riskFilter ?? null },
    risk_counts: totals.by_risk,
  });

  emitMetric({
    fn: FN_NAME,
    requestId,
    name: "supplier_sla.records",
    value: records.length,
    unit: "count",
    tags: {
      tier: tierFilter ?? "all",
      risk: riskFilter ?? "all",
    },
    event: "supplier.sla.metric.records",
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    generated_at: new Date().toISOString(),
    filters: {
      tier: tierFilter ?? null,
      risk: riskFilter ?? null,
    },
    totals,
    visible: visibleTotals,
    buckets,
    heatmap,
    health_checks: healthChecks,
    samples,
  });
}, { fn: FN_NAME, defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function loadRecords(): SupplierRecord[] {
  if (!Array.isArray(fixtures)) {
    return [];
  }

  const records: SupplierRecord[] = [];
  for (const entry of fixtures as SupplierFixture[]) {
    const normalized = normalizeFixture(entry);
    if (!normalized) {
      continue;
    }
    records.push(normalized);
  }
  return records;
}

function normalizeFixture(raw: SupplierFixture): SupplierRecord | null {
  const supplier = normalizeString(raw.supplier);
  const tier = normalizeString(raw.tier);
  if (!supplier || !tier) {
    return null;
  }

  const avgConfirmation = normalizeNumber(raw.avg_confirmation_hours);
  const openConfirms = Math.max(0, Math.round(normalizeNumber(raw.open_confirms)));
  const breachState = normalizeString(raw.breach_state) ?? "on_track";
  const cancellations = normalizeNumber(raw.cancellations_pct);
  const lastBreachAt = typeof raw.last_breach_at === "string" && raw.last_breach_at
    ? raw.last_breach_at
    : null;

  const risk = deriveRisk({
    breach_state: breachState,
    avg_confirmation_hours: avgConfirmation,
    cancellations_pct: cancellations,
    open_confirms: openConfirms,
  });

  return {
    supplier,
    tier,
    avg_confirmation_hours: avgConfirmation,
    open_confirms: openConfirms,
    breach_state: breachState,
    cancellations_pct: Number(cancellations.toFixed(2)),
    last_breach_at: lastBreachAt,
    risk,
  };
}

function deriveRisk(details: {
  breach_state: string;
  avg_confirmation_hours: number;
  cancellations_pct: number;
  open_confirms: number;
}): RiskLevel {
  if (details.breach_state === "breach") {
    return "breach";
  }
  if (details.breach_state === "warning") {
    return "warning";
  }

  const breachSignals = [
    details.avg_confirmation_hours >= 12,
    details.cancellations_pct >= 5,
    details.open_confirms >= 5,
  ];
  if (breachSignals.some(Boolean)) {
    return "breach";
  }

  const warningSignals = [
    details.avg_confirmation_hours >= 8,
    details.cancellations_pct >= 3,
    details.open_confirms >= 3,
  ];
  if (warningSignals.some(Boolean)) {
    return "warning";
  }

  return "on_track";
}

function computeTotals(records: SupplierRecord[]) {
  const byRisk: Record<RiskLevel, number> = {
    breach: 0,
    warning: 0,
    on_track: 0,
  };
  const byTier: Record<string, number> = {};

  for (const record of records) {
    byRisk[record.risk] += 1;
    const tierKey = record.tier;
    byTier[tierKey] = (byTier[tierKey] ?? 0) + 1;
  }

  return {
    suppliers: records.length,
    by_risk: byRisk,
    by_tier: byTier,
  };
}

function computeBuckets(records: SupplierRecord[]) {
  const buckets: Record<RiskLevel, {
    suppliers: string[];
    avg_confirmation_hours: number;
    avg_cancellations_pct: number;
    total_open_confirms: number;
  }> = {
    breach: { suppliers: [], avg_confirmation_hours: 0, avg_cancellations_pct: 0, total_open_confirms: 0 },
    warning: { suppliers: [], avg_confirmation_hours: 0, avg_cancellations_pct: 0, total_open_confirms: 0 },
    on_track: { suppliers: [], avg_confirmation_hours: 0, avg_cancellations_pct: 0, total_open_confirms: 0 },
  };

  for (const record of records) {
    const bucket = buckets[record.risk];
    bucket.suppliers.push(record.supplier);
    bucket.avg_confirmation_hours += record.avg_confirmation_hours;
    bucket.avg_cancellations_pct += record.cancellations_pct;
    bucket.total_open_confirms += record.open_confirms;
  }

  for (const level of Object.keys(buckets) as RiskLevel[]) {
    const bucket = buckets[level];
    const divisor = Math.max(bucket.suppliers.length, 1);
    bucket.avg_confirmation_hours = Number((bucket.avg_confirmation_hours / divisor).toFixed(2));
    bucket.avg_cancellations_pct = Number((bucket.avg_cancellations_pct / divisor).toFixed(2));
  }

  return buckets;
}

function buildHeatmap(records: SupplierRecord[]) {
  return records.map((record) => ({
    supplier: record.supplier,
    display_name: formatSupplierName(record.supplier),
    tier: record.tier,
    risk: record.risk,
    profile_url: buildProfileUrl(record.supplier),
    metrics: {
      avg_confirmation_hours: record.avg_confirmation_hours,
      open_confirms: record.open_confirms,
      cancellations_pct: record.cancellations_pct,
      breach_state: record.breach_state,
      last_breach_at: record.last_breach_at,
    },
  }));
}

function buildHealthChecks(records: SupplierRecord[]) {
  const mostRecentBreach = records
    .map((record) => record.last_breach_at)
    .filter((value): value is string => typeof value === "string")
    .map((value) => Date.parse(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a)[0];

  const now = Date.now();
  const twentyFourHoursMs = 24 * 60 * 60 * 1000;
  const recentBreach = typeof mostRecentBreach === "number"
    ? now - mostRecentBreach <= twentyFourHoursMs
    : false;

  return [
    {
      name: "fixtures_loaded",
      status: records.length > 0 ? "pass" : "fail",
      observed_at: new Date().toISOString(),
      detail: `loaded_records=${records.length}`,
    },
    {
      name: "recent_breach_signal",
      status: recentBreach ? "warn" : "pass",
      observed_at: new Date().toISOString(),
      detail: mostRecentBreach ? new Date(mostRecentBreach).toISOString() : null,
    },
  ];
}

function buildSamples(records: SupplierRecord[]) {
  const silverSuppliers = records.filter((record) => record.tier === "silver");
  const sample = silverSuppliers[0] ?? records[0] ?? null;

  return {
    request: {
      method: "GET",
      path: `/functions/v1/${FN_NAME}?tier=silver`,
      description: "Retrieve SLA forecast for silver tier suppliers",
    },
    response: sample
      ? {
        summary: {
          supplier: sample.supplier,
          risk: sample.risk,
          profile_url: buildProfileUrl(sample.supplier),
        },
      }
      : null,
  };
}

function formatSupplierName(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildProfileUrl(supplier: string) {
  return `/ops/suppliers/${supplier}`;
}

function normalizeString(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }
  return null;
}

function normalizeNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function isRiskLevel(value: string): value is RiskLevel {
  return value === "breach" || value === "warning" || value === "on_track";
}

function logEvent(requestId: string, event: string, details: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "INFO",
      event,
      fn: FN_NAME,
      request_id: requestId,
      ...details,
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}
