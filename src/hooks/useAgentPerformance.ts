import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseCaching } from "@/lib/query-client";
import { computePerformanceScore, summariseTrend } from "@/lib/chartkit";

export interface AgentPerformanceSnapshot {
  id: string;
  agentType: string;
  timeWindow: string;
  successRate: number;
  toolSuccessRate: number;
  avgLatencyMs: number;
  avgTokens: number;
  runCount: number;
  capturedAt: string;
}

export interface AgentPerformanceSummary {
  agentType: string;
  successTrend: ReturnType<typeof summariseTrend>;
  toolTrend: ReturnType<typeof summariseTrend>;
  performanceScore: number;
  latest: AgentPerformanceSnapshot | null;
  history: AgentPerformanceSnapshot[];
}

async function fetchAgentPerformance(tenantId: string): Promise<AgentPerformanceSnapshot[]> {
  const { data, error } = await supabase
    .from("agent_performance_snapshots")
    .select(
      "id, agent_type, time_window, success_rate, tool_success_rate, avg_latency_ms, avg_tokens, run_count, created_at",
    )
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    agentType: (row.agent_type as string) ?? "unknown",
    timeWindow: (row.time_window as string) ?? "24h",
    successRate: Number(row.success_rate ?? 0) * 100,
    toolSuccessRate: Number(row.tool_success_rate ?? 0) * 100,
    avgLatencyMs: Number(row.avg_latency_ms ?? 0),
    avgTokens: Number(row.avg_tokens ?? 0),
    runCount: Number(row.run_count ?? 0),
    capturedAt: row.created_at as string,
  }));
}

function buildSummary(snapshots: AgentPerformanceSnapshot[]): AgentPerformanceSummary[] {
  const grouped = new Map<string, AgentPerformanceSnapshot[]>();
  snapshots.forEach((snapshot) => {
    const list = grouped.get(snapshot.agentType) ?? [];
    list.push(snapshot);
    grouped.set(snapshot.agentType, list);
  });

  return Array.from(grouped.entries()).map(([agentType, history]) => {
    const successTrend = summariseTrend(history.map((entry) => entry.successRate));
    const toolTrend = summariseTrend(history.map((entry) => entry.toolSuccessRate));
    const latest = history.at(-1) ?? null;
    const performanceScore = latest
      ? computePerformanceScore({
          successRate: latest.successRate,
          toolRate: latest.toolSuccessRate,
          avgLatencyMs: latest.avgLatencyMs,
        })
      : 0;

    return {
      agentType,
      successTrend,
      toolTrend,
      performanceScore,
      latest,
      history,
    } satisfies AgentPerformanceSummary;
  });
}

export function useAgentPerformance(tenantId: string | null) {
  const query = useQuery({
    queryKey: ["supabase", "admin", "agent-performance", tenantId],
    queryFn: () => fetchAgentPerformance(tenantId ?? ""),
    enabled: Boolean(tenantId),
    ...withSupabaseCaching({ entity: "agent-performance", staleTime: 60_000 }),
  });

  const summaries = useMemo(() => buildSummary(query.data ?? []), [query.data]);

  return { ...query, summaries };
}
