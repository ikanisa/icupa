import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLATFORM_TENANT_ID } from "@/hooks/useAdminTenants";

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
  originTenantId: string | null;
  isInherited: boolean;
  source: "platform" | "tenant";
}

export interface UpdateAgentConfigInput {
  id: string | null;
  tenantId: string;
  agentType: string;
  originTenantId: string | null;
  patch: Partial<
    Pick<
      AgentConfig,
      | "enabled"
      | "sessionBudgetUsd"
      | "dailyBudgetUsd"
      | "instructions"
      | "toolAllowlist"
      | "autonomyLevel"
      | "retrievalTtlMinutes"
      | "experimentFlag"
    >
  >;
}

type AgentRuntimeRow = {
  id: string;
  tenant_id: string | null;
  agent_type: string | null;
  enabled: boolean | null;
  session_budget_usd: number | null;
  daily_budget_usd: number | null;
  instructions: string | null;
  tool_allowlist: string[] | null;
  autonomy_level: string | null;
  retrieval_ttl_minutes: number | null;
  experiment_flag: string | null;
  sync_pending: boolean | null;
  updated_at: string | null;
};

function mapRowToConfig(
  row: AgentRuntimeRow,
  targetTenantId: string,
  originTenantId: string | null,
): AgentConfig {
  const toolAllowlist = Array.isArray(row.tool_allowlist) ? [...row.tool_allowlist] : [];

  return {
    id: row.id,
    tenantId: row.tenant_id,
    agentType: row.agent_type ?? "",
    enabled: Boolean(row.enabled),
    sessionBudgetUsd: Number(row.session_budget_usd ?? 0),
    dailyBudgetUsd: Number(row.daily_budget_usd ?? 0),
    instructions: row.instructions ?? "",
    toolAllowlist,
    autonomyLevel: (row.autonomy_level as AgentConfig["autonomyLevel"]) ?? "L0",
    retrievalTtlMinutes: Number(row.retrieval_ttl_minutes ?? 5),
    experimentFlag: (row.experiment_flag as string | null) ?? null,
    syncPending: Boolean(row.sync_pending),
    updatedAt: row.updated_at ?? new Date().toISOString(),
    originTenantId,
    isInherited: targetTenantId !== PLATFORM_TENANT_ID && originTenantId === null,
    source: originTenantId ? "tenant" : "platform",
  } satisfies AgentConfig;
}

async function fetchAgentConfigs(tenantId: string): Promise<AgentConfig[]> {
  if (!tenantId) {
    return [];
  }

  const baseQuery = supabase
    .from("agent_runtime_configs")
    .select(
      "id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, instructions, tool_allowlist, autonomy_level, retrieval_ttl_minutes, experiment_flag, sync_pending, updated_at",
    )
    .order("agent_type", { ascending: true });

  const query =
    tenantId === PLATFORM_TENANT_ID
      ? baseQuery.is("tenant_id", null)
      : baseQuery.or(`tenant_id.eq.${tenantId},tenant_id.is.null`);

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as AgentRuntimeRow[];

  const defaults = new Map<string, AgentRuntimeRow>();
  const overrides = new Map<string, AgentRuntimeRow>();

  for (const row of rows) {
    if (!row?.agent_type) {
      continue;
    }

    if (row.tenant_id) {
      overrides.set(row.agent_type, row);
    } else {
      defaults.set(row.agent_type, row);
    }
  }

  const agentTypes = new Set<string>([...defaults.keys(), ...overrides.keys()]);
  const orderedTypes = Array.from(agentTypes).sort((a, b) => a.localeCompare(b));

  return orderedTypes.map((agentType) => {
    const override = overrides.get(agentType);
    const base = override ?? defaults.get(agentType);

    if (!base) {
      throw new Error(`Agent configuration missing for ${agentType}`);
    }

    const originTenantId = override?.tenant_id ?? base.tenant_id ?? null;
    return mapRowToConfig(base, tenantId, originTenantId);
  });
}

export function useAgentConfigs(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "agent-configs", tenantId],
    queryFn: () => fetchAgentConfigs(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}

function mapPatchToColumns(patch: UpdateAgentConfigInput["patch"]): Record<string, unknown> {
  const updatePayload: Record<string, unknown> = {};

  if (patch.enabled !== undefined) updatePayload.enabled = patch.enabled;
  if (patch.sessionBudgetUsd !== undefined) updatePayload.session_budget_usd = patch.sessionBudgetUsd;
  if (patch.dailyBudgetUsd !== undefined) updatePayload.daily_budget_usd = patch.dailyBudgetUsd;
  if (patch.instructions !== undefined) updatePayload.instructions = patch.instructions;
  if (patch.toolAllowlist !== undefined) updatePayload.tool_allowlist = patch.toolAllowlist;
  if (patch.autonomyLevel !== undefined) updatePayload.autonomy_level = patch.autonomyLevel;
  if (patch.retrievalTtlMinutes !== undefined) updatePayload.retrieval_ttl_minutes = patch.retrievalTtlMinutes;
  if (patch.experimentFlag !== undefined) updatePayload.experiment_flag = patch.experimentFlag;

  return updatePayload;
}

async function updateAgentConfig({ id, tenantId, agentType, originTenantId, patch }: UpdateAgentConfigInput): Promise<void> {
  const updatePayload = mapPatchToColumns(patch);

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  if (tenantId === PLATFORM_TENANT_ID) {
    if (!id) {
      throw new Error("Missing configuration id for platform defaults");
    }

    const { error } = await supabase
      .from("agent_runtime_configs")
      .update(updatePayload)
      .eq("id", id)
      .is("tenant_id", null);

    if (error) {
      throw error;
    }

    return;
  }

  if (originTenantId && originTenantId === tenantId) {
    const { error } = await supabase
      .from("agent_runtime_configs")
      .update(updatePayload)
      .eq("id", id ?? "")
      .eq("tenant_id", tenantId);

    if (error) {
      throw error;
    }

    return;
  }

  const insertPayload = {
    tenant_id: tenantId,
    agent_type: agentType,
    ...updatePayload,
  };

  const { error } = await supabase.from("agent_runtime_configs").insert(insertPayload);

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
