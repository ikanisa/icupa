import { CardGlass } from "@ecotrips/ui";

import { createAdminServerClient } from "../../lib/supabaseServer";

type AnalyticsTrendRow = {
  event: string;
  captured_hour: string;
  total: number;
  unique_sessions: number;
};

type OfflineCoverageRow = {
  region: string;
  availability_percent: number;
  offline_suppliers: number;
};

async function loadAnalyticsTrends(): Promise<AnalyticsTrendRow[]> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from<AnalyticsTrendRow>("ops.v_analytics_event_counts")
    .select("event,captured_hour,total,unique_sessions")
    .order("captured_hour", { ascending: false })
    .limit(12);
  if (error) {
    console.error("ops.v_analytics_event_counts", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

async function loadOfflineCoverage(): Promise<OfflineCoverageRow[]> {
  const supabase = await createAdminServerClient();
  if (!supabase) {
    return [];
  }
  const { data, error } = await supabase
    .from<OfflineCoverageRow>("ops.v_offline_coverage")
    .select("region,availability_percent,offline_suppliers")
    .order("availability_percent", { ascending: true })
    .limit(5);
  if (error) {
    console.error("ops.v_offline_coverage", error);
    return [];
  }
  return Array.isArray(data) ? data : [];
}

export default async function PerformancePage() {
  const [analytics, coverage] = await Promise.all([loadAnalyticsTrends(), loadOfflineCoverage()]);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <CardGlass title="Performance budgets" subtitle="Perf runner enforces CI gates (p95 ≤ 800ms, errors ≤ 1).">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-300/80">
                <th className="pb-3">Scenario</th>
                <th className="pb-3">p50 (ms)</th>
                <th className="pb-3">p95 (ms)</th>
                <th className="pb-3">p99 (ms)</th>
                <th className="pb-3">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {[
                { scenario: "smoke", p50: 410, p95: 620, p99: 780, errors: 0 },
                { scenario: "checkout-path", p50: 680, p95: 810, p99: 920, errors: 1 },
              ].map((row) => (
                <tr key={row.scenario}>
                  <td className="py-3">{row.scenario}</td>
                  <td className="py-3">{row.p50}</td>
                  <td className="py-3">{row.p95}</td>
                  <td className="py-3">{row.p99}</td>
                  <td className="py-3">{row.errors}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardGlass>
      <CardGlass
        title="Analytics capture"
        subtitle="Recent events flowing through analytics-capture with unique sessions"
      >
        {analytics.length === 0 ? (
          <p className="text-sm text-white/70">No analytics events recorded in the last hours.</p>
        ) : (
          <ul className="space-y-3">
            {analytics.map((row) => (
              <li key={`${row.event}-${row.captured_hour}`} className="space-y-1 text-sm">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">{row.event}</span>
                  <span className="text-xs text-white/60">
                    {new Date(row.captured_hour).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/70">
                  <div className="h-2 flex-1 rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-sky-400/80"
                      style={{ width: `${Math.min(100, row.total * 10)}%` }}
                    />
                  </div>
                  <span>{row.total} events</span>
                  <span className="text-white/50">{row.unique_sessions} sessions</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardGlass>
      <CardGlass
        title="Offline coverage trend"
        subtitle="Regions with highest supplier downtime impact"
      >
        {coverage.length === 0 ? (
          <p className="text-sm text-white/70">Offline coverage metrics unavailable.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {coverage.map((row) => (
              <li key={row.region} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between text-white">
                  <span className="font-semibold">{row.region}</span>
                  <span className="text-xs text-white/60">{row.offline_suppliers} offline</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-rose-400/80"
                    style={{ width: `${Math.max(5, 100 - row.availability_percent)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-white/60">
                  Availability {row.availability_percent.toFixed(1)}% — tracking suppliers available vs. sample size.
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardGlass>
    </div>
  );
}
