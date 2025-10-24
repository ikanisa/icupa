import { CardGlass } from "@ecotrips/ui";
import { AiSpansCard } from "./AiSpansCard";
import { aiSpanFixtures } from "./fixtures";

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
    <div className="space-y-6">
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
              {metrics.map((row) => (
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
      <AiSpansCard spans={aiSpanFixtures} />
    </div>
  );
}
