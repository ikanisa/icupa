import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentConfig {
  id: string;
  tenantId: string | null;
  agentType: string;
  enabled: boolean;
  sessionBudgetUsd: number;
  dailyBudgetUsd: number;
  instructions: string;
  toolAllowlist: string[];
  autonomyLevel: "L0" | "L1" | "L2" | "L3";
  retrievalTtlMinutes: number;
  experimentFlag: string | null;
  syncPending: boolean;
  updatedAt: string;
}

export interface UpdateAgentConfigInput {
  id: string;
  tenantId: string;
  patch: Partial<Pick<AgentConfig, "enabled" | "sessionBudgetUsd" | "dailyBudgetUsd" | "instructions" | "toolAllowlist" | "autonomyLevel" | "retrievalTtlMinutes" | "experimentFlag">>;
}

async function fetchAgentConfigs(tenantId: string): Promise<AgentConfig[]> {
  const { data, error } = await supabase
    .from("agent_runtime_configs")
    .select(
      "id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, instructions, tool_allowlist, autonomy_level, retrieval_ttl_minutes, experiment_flag, sync_pending, updated_at",
    )
    .eq("tenant_id", tenantId)
    .order("agent_type", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    tenantId: row.tenant_id ?? null,
    agentType: row.agent_type ?? "",
    enabled: row.enabled ?? false,
    sessionBudgetUsd: Number(row.session_budget_usd ?? 0),
    dailyBudgetUsd: Number(row.daily_budget_usd ?? 0),
    instructions: row.instructions ?? "",
    toolAllowlist: Array.isArray(row.tool_allowlist) ? (row.tool_allowlist as string[]) : [],
    autonomyLevel: (row.autonomy_level as AgentConfig["autonomyLevel"]) ?? "L0",
    retrievalTtlMinutes: Number(row.retrieval_ttl_minutes ?? 5),
    experimentFlag: (row.experiment_flag as string | null) ?? null,
    syncPending: Boolean(row.sync_pending),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }));
}

export function useAgentConfigs(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "agent-configs", tenantId],
    queryFn: () => fetchAgentConfigs(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}

async function updateAgentConfig({ id, tenantId, patch }: UpdateAgentConfigInput): Promise<void> {
  const updatePayload: Record<string, unknown> = {};

  if (patch.enabled !== undefined) updatePayload.enabled = patch.enabled;
  if (patch.sessionBudgetUsd !== undefined) updatePayload.session_budget_usd = patch.sessionBudgetUsd;
  if (patch.dailyBudgetUsd !== undefined) updatePayload.daily_budget_usd = patch.dailyBudgetUsd;
  if (patch.instructions !== undefined) updatePayload.instructions = patch.instructions;
  if (patch.toolAllowlist !== undefined) updatePayload.tool_allowlist = patch.toolAllowlist;
  if (patch.autonomyLevel !== undefined) updatePayload.autonomy_level = patch.autonomyLevel;
  if (patch.retrievalTtlMinutes !== undefined) updatePayload.retrieval_ttl_minutes = patch.retrievalTtlMinutes;
  if (patch.experimentFlag !== undefined) updatePayload.experiment_flag = patch.experimentFlag;

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("agent_runtime_configs")
    .update(updatePayload)
    .eq("id", id)
    .eq("tenant_id", tenantId);

  if (error) {
    throw error;
  }
}

export function useUpdateAgentConfig(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAgentConfigInput) => updateAgentConfig(input),
    onSuccess: (_, variables) => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "agent-configs", tenantId] });
      }
      queryClient.invalidateQueries({ queryKey: ["admin", "agent-configs", variables.tenantId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "agent-configs"] });
    },
  });
}
