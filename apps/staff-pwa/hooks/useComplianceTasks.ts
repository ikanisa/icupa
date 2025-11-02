import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase-client";

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
}

async function fetchComplianceTasks(tenantId: string): Promise<ComplianceTask[]> {
  const { data, error } = await supabase
    .from("compliance_tasks")
    .select("id, tenant_id, region, category, title, status, severity, due_at, details")
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
