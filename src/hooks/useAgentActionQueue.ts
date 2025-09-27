import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AgentActionQueueItem {
  id: string;
  tenantId: string | null;
  locationId: string | null;
  agentType: string;
  actionType: string;
  payload: Record<string, unknown>;
  rationale: string | null;
  status: string;
  createdAt: string;
}

const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_SERVICE_TOKEN ?? "";
const FUNCTION_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin/agent_actions`;

async function fetchAgentActions(tenantId: string): Promise<AgentActionQueueItem[]> {
  const { data, error } = await supabase
    .from("agent_action_queue")
    .select("id, tenant_id, location_id, agent_type, action_type, payload, rationale, status, created_at")
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  const rows = (data ?? []).filter((row) => !tenantId || row.tenant_id === tenantId);

  return rows.map((row) => ({
    id: row.id!,
    tenantId: row.tenant_id ?? null,
    locationId: row.location_id ?? null,
    agentType: row.agent_type ?? "",
    actionType: row.action_type ?? "",
    payload: (row.payload ?? {}) as Record<string, unknown>,
    rationale: (row.rationale as string | null) ?? null,
    status: row.status ?? "pending",
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}

export function useAgentActionQueue(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "agent-action-queue", tenantId],
    queryFn: () => fetchAgentActions(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 20_000,
  });
}

interface AgentActionMutationInput {
  actionId: string;
  decision: "approve" | "reject" | "apply";
  notes?: string;
}

async function postAgentAction({ actionId, decision, notes }: AgentActionMutationInput) {
  const session = await supabase.auth.getSession();
  const token = session.data.session?.access_token;

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (ADMIN_TOKEN) {
    headers["x-icupa-admin-token"] = ADMIN_TOKEN;
  }

  const response = await fetch(FUNCTION_BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ action_id: actionId, decision, notes }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? `Failed to ${decision} action`);
  }

  return response.json();
}

export function useAgentActionMutation(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: postAgentAction,
    onSuccess: () => {
      if (tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "agent-action-queue", tenantId] });
      }
    },
  });
}
