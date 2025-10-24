import {
  emitMetric,
  getRequestId,
  healthResponse,
  withObs,
} from "../_obs/withObs.ts";
import { ERROR_CODES, OBS_EVENTS } from "../_obs/constants.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Supabase configuration missing for synthetics-probe");
}

const TARGETS = [
  { fn: "bff-quote", category: "bff" },
  { fn: "bff-checkout", category: "bff" },
  { fn: "inventory-search", category: "inventory" },
  { fn: "inventory-quote", category: "inventory" },
  { fn: "inventory-hold", category: "inventory" },
  { fn: "agent-orchestrator", category: "agents" },
  { fn: "groups-create-escrow", category: "groups", critical: true },
  { fn: "wa-send", category: "messaging" },
  { fn: "metrics-incr", category: "observability" },
  { fn: "privacy-request", category: "privacy" },
  { fn: "stripe-webhook", category: "payments", critical: true },
] as const;

interface ProbeResult {
  fn: string;
  category: string;
  status: number;
  ms: number;
  ok: boolean;
  critical: boolean;
  error?: string;
  fallback?: string;
  upstream_ok?: boolean;
  chaos?: {
    mode: string;
    fallback: string | null;
    fallback_used: boolean;
    source: string;
    expires_at: string | null;
  };
}

interface ChaosPolicy {
  key: string;
  target: string;
  mode: string;
  fallback: string | null;
  enabled: boolean;
  notes: string | null;
  expires_at: string | null;
  source: string;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("synthetics-probe");
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, 405);
  }

  const chaosPolicies = await fetchChaosPolicies(requestId);
  const chaosByTarget = new Map<string, ChaosPolicy>(
    chaosPolicies.map((policy) => [policy.target, policy] as const),
  );

  const results: ProbeResult[] = [];
  const categoryStats: Record<string, { ok: number; total: number }> = {};
  for (const target of TARGETS) {
    const start = performance.now();
    const targetUrl = `${SUPABASE_URL}/functions/v1/${target.fn}/health`;
    let status = 0;
    let ok = false;
    let error: string | undefined;
    let fallback: string | undefined;
    try {
      const response = await fetch(targetUrl, {
        method: "GET",
        headers: {
          apikey: SERVICE_ROLE_KEY,
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
      });
      status = response.status;
      ok = response.ok;
      if (!response.ok) {
        error = await safeText(response) ?? response.statusText;
      }
    } catch (err) {
      status = 0;
      ok = false;
      error = err instanceof Error ? err.message : String(err);
    }
    const upstreamOk = ok;
    const chaos = chaosByTarget.get(target.fn);
    let fallbackUsed = false;
    if (!ok && chaos && chaos.fallback) {
      fallbackUsed = true;
      fallback = chaos.fallback;
      ok = true;
      emitMetric({
        fn: "synthetics-probe",
        requestId,
        name: "synthetics_fallback_used",
        value: 1,
        unit: "count",
        tags: { target: target.fn, fallback: chaos.fallback },
      });
    }
    const ms = Math.round(performance.now() - start);
    results.push({
      fn: target.fn,
      category: target.category,
      status,
      ms,
      ok,
      critical: target.critical ?? false,
      error,
      fallback,
      upstream_ok: upstreamOk,
      chaos: chaos
        ? {
          mode: chaos.mode,
          fallback: chaos.fallback,
          fallback_used: fallbackUsed,
          source: chaos.source,
          expires_at: chaos.expires_at,
        }
        : undefined,
    });

    categoryStats[target.category] ??= { ok: 0, total: 0 };
    categoryStats[target.category].total += 1;
    if (ok) {
      categoryStats[target.category].ok += 1;
    }

    emitMetric({
      fn: "synthetics-probe",
      requestId,
      name: "synthetics_latency_ms",
      value: ms,
      unit: "milliseconds",
      tags: { target: target.fn, category: target.category },
    });

    emitMetric({
      fn: "synthetics-probe",
      requestId,
      name: "synthetics_availability",
      value: ok ? 1 : 0,
      unit: "ratio",
      tags: { target: target.fn, category: target.category },
    });
  }

  const okCount = results.filter((item) => item.ok).length;
  const failCount = results.length - okCount;
  const criticalFailCount = results.filter((item) => !item.ok && item.critical).length;
  const availability = results.length === 0 ? 0 : okCount / results.length;

  for (const [category, stats] of Object.entries(categoryStats)) {
    const categoryAvailability = stats.total === 0
      ? 0
      : stats.ok / stats.total;
    emitMetric({
      fn: "synthetics-probe",
      requestId,
      name: "synthetics_category_availability",
      value: categoryAvailability,
      unit: "ratio",
      tags: { category },
    });
  }

  emitMetric({
    fn: "synthetics-probe",
    requestId,
    name: "synthetics_overall_availability",
    value: availability,
    unit: "ratio",
    tags: { scope: "overall" },
  });

  const categoryBreakdown = Object.fromEntries(
    Object.entries(categoryStats).map(([category, stats]) => {
      const ratio = stats.total === 0 ? 0 : stats.ok / stats.total;
      return [
        category,
        {
          ok: stats.ok,
          total: stats.total,
          availability: Number(ratio.toFixed(3)),
        },
      ];
    }),
  );

  logSummary({
    requestId,
    okCount,
    failCount,
    criticalFailCount,
    availability,
    categories: categoryBreakdown,
  });

  const body = {
    ok: failCount === 0,
    ts: new Date().toISOString(),
    request_id: requestId,
    ok_count: okCount,
    fail_count: failCount,
    critical_fail_count: criticalFailCount,
    availability,
    category_breakdown: categoryBreakdown,
    results,
  };

  const status = failCount === 0 ? 200 : 503;
  return jsonResponse(body, status);
}, { fn: "synthetics-probe", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

async function safeText(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch (_err) {
    return undefined;
  }
}

async function fetchChaosPolicies(requestId: string): Promise<ChaosPolicy[]> {
  const url = `${SUPABASE_URL}/functions/v1/chaos-inject`;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    });
    if (!response.ok) {
      const errorText = await safeText(response);
      emitMetric({
        fn: "synthetics-probe",
        requestId,
        name: "synthetics_chaos_fetch_failed",
        value: 1,
        unit: "count",
        tags: { status: String(response.status) },
        level: "WARN",
      });
      console.warn("synthetics-probe: chaos-inject fetch failed", {
        status: response.status,
        body: errorText,
      });
      return [];
    }
    const payload = await response.json() as { policies?: ChaosPolicy[] };
    if (!Array.isArray(payload.policies)) {
      return [];
    }
    return payload.policies;
  } catch (error) {
    emitMetric({
      fn: "synthetics-probe",
      requestId,
      name: "synthetics_chaos_fetch_failed",
      value: 1,
      unit: "count",
      tags: { status: "error" },
      level: "WARN",
    });
    console.warn("synthetics-probe: chaos-inject request errored", error);
    return [];
  }
}

function logSummary(
  details: {
    requestId: string;
    okCount: number;
    failCount: number;
    criticalFailCount: number;
    availability: number;
    categories: Record<string, { ok: number; total: number; availability: number }>;
  },
) {
  console.log(
    JSON.stringify({
      level: "INFO",
      event: OBS_EVENTS.SYNTHETICS_SUMMARY,
      fn: "synthetics-probe",
      requestId: details.requestId,
      ok_count: details.okCount,
      fail_count: details.failCount,
      critical_fail_count: details.criticalFailCount,
      availability: Number(details.availability.toFixed(3)),
      categories: details.categories,
    }),
  );
}
