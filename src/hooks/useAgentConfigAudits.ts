import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseCaching } from "@/lib/query-client";

export interface AgentConfigAuditEvent {
  id: string;
  configId: string;
  tenantId: string | null;
  agentType: string;
  action: string;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown>;
  changedBy: string | null;
  createdAt: string;
}

async function fetchAgentConfigAudits(configId: string): Promise<AgentConfigAuditEvent[]> {
  const { data, error } = await supabase
    .from("agent_config_audit_events")
    .select("id, config_id, tenant_id, agent_type, action, before_state, after_state, changed_by, created_at")
    .eq("config_id", configId)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    configId: row.config_id!,
    tenantId: row.tenant_id ?? null,
    agentType: row.agent_type ?? "",
    action: row.action ?? "update",
    beforeState: (row.before_state ?? null) as Record<string, unknown> | null,
    afterState: (row.after_state ?? {}) as Record<string, unknown>,
    changedBy: (row.changed_by as string | null) ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}

export function useAgentConfigAudits(configId: string | null) {
  return useQuery({
    queryKey: ["supabase", "admin", "agent-config-audits", configId],
    queryFn: () => fetchAgentConfigAudits(configId ?? ""),
    enabled: Boolean(configId),
    ...withSupabaseCaching({ entity: "agent-config-audits", staleTime: 15_000 }),
  });
}
