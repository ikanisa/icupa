import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentSpendSummary {
  agentType: string;
  runs24h: number;
  spend24hUsd: number;
  runs7d: number;
  spend7dUsd: number;
  runsWindow: number;
  spendWindowUsd: number;
}

async function fetchAgentSpend(tenantId: string, windowDays: number): Promise<AgentSpendSummary[]> {
  const { data, error } = await supabase.rpc("agent_cost_summary", {
    p_tenant_id: tenantId,
    p_window_days: windowDays,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    agentType: row.agent_type ?? "unknown",
    runs24h: Number(row.runs_24h ?? 0),
    spend24hUsd: Number(row.spend_24h_usd ?? 0),
    runs7d: Number(row.runs_7d ?? 0),
    spend7dUsd: Number(row.spend_7d_usd ?? 0),
    runsWindow: Number(row.runs_window ?? 0),
    spendWindowUsd: Number(row.spend_window_usd ?? 0),
  }));
}

export function useAgentSpend(tenantId: string | null, windowDays = 30) {
  return useQuery({
    queryKey: ["admin", "agent-spend", tenantId, windowDays],
    queryFn: () => fetchAgentSpend(tenantId ?? "", windowDays),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}
