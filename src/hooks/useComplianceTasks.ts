import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ComplianceTask {
  id: string;
  tenantId: string | null;
  region: "RW" | "EU";
  category: string;
  title: string;
  status: "pending" | "in_progress" | "blocked" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  dueAt: string | null;
  details: Record<string, unknown>;
  resolvedAt: string | null;
}

async function fetchComplianceTasks(tenantId: string): Promise<ComplianceTask[]> {
  const { data, error } = await supabase
    .from("compliance_tasks")
    .select("id, tenant_id, region, category, title, status, severity, due_at, details, resolved_at")
    .eq("tenant_id", tenantId)
    .order("severity", { ascending: false })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    tenantId: row.tenant_id ?? null,
    region: (row.region as "RW" | "EU") ?? "RW",
    category: row.category ?? "",
    title: row.title ?? "",
    status: (row.status as ComplianceTask["status"]) ?? "pending",
    severity: (row.severity as ComplianceTask["severity"]) ?? "medium",
    dueAt: row.due_at ?? null,
    details: (row.details ?? {}) as Record<string, unknown>,
    resolvedAt: row.resolved_at ?? null,
  }));
}

export function useComplianceTasks(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "compliance-tasks", tenantId],
    queryFn: () => fetchComplianceTasks(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}

export interface CreateComplianceTaskInput {
  tenantId: string;
  region: "RW" | "EU";
  category: string;
  title: string;
  severity: ComplianceTask["severity"];
  status?: ComplianceTask["status"];
  dueDate?: string | null;
  details?: Record<string, unknown>;
}

export interface UpdateComplianceTaskInput {
  id: string;
  tenantId: string;
  patch: Partial<Pick<ComplianceTask, "status" | "severity">> & {
    dueDate?: string | null;
    details?: Record<string, unknown>;
  };
}

function normaliseDateInput(dateValue?: string | null) {
  if (!dateValue) return null;
  const parsed = new Date(`${dateValue}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

async function createComplianceTask(input: CreateComplianceTaskInput) {
  const payload: Record<string, unknown> = {
    tenant_id: input.tenantId,
    region: input.region,
    category: input.category,
    title: input.title,
    severity: input.severity,
    status: input.status ?? "pending",
    details: input.details ?? {},
  };

  const dueAt = normaliseDateInput(input.dueDate);
  if (dueAt) {
    payload.due_at = dueAt;
  }

  const { error } = await supabase.from("compliance_tasks").insert([payload]);

  if (error) {
    throw error;
  }
}

export function useCreateComplianceTask(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateComplianceTaskInput) => createComplianceTask(input),
    onSuccess: (_, variables) => {
      const invalidateKey = ["admin", "compliance-tasks", variables.tenantId];
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      if (tenantId && tenantId !== variables.tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "compliance-tasks", tenantId] });
      }
    },
  });
}

async function resolveUpdatedBy(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function updateComplianceTask(input: UpdateComplianceTaskInput) {
  const updatePayload: Record<string, unknown> = {};

  if (input.patch.status) {
    updatePayload.status = input.patch.status;
    if (input.patch.status === "resolved") {
      updatePayload.resolved_at = new Date().toISOString();
      const resolvedBy = await resolveUpdatedBy();
      if (resolvedBy) {
        updatePayload.resolved_by = resolvedBy;
      }
    } else {
      updatePayload.resolved_at = null;
      updatePayload.resolved_by = null;
    }
  }

  if (input.patch.severity) {
    updatePayload.severity = input.patch.severity;
  }

  if (input.patch.dueDate !== undefined) {
    updatePayload.due_at = normaliseDateInput(input.patch.dueDate);
  }

  if (input.patch.details) {
    updatePayload.details = input.patch.details;
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("compliance_tasks")
    .update(updatePayload)
    .eq("id", input.id)
    .eq("tenant_id", input.tenantId);

  if (error) {
    throw error;
  }
}

export function useUpdateComplianceTask(tenantId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateComplianceTaskInput) => updateComplianceTask(input),
    onSuccess: (_, variables) => {
      const invalidateKey = ["admin", "compliance-tasks", variables.tenantId];
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      if (tenantId && tenantId !== variables.tenantId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "compliance-tasks", tenantId] });
      }
    },
  });
}
