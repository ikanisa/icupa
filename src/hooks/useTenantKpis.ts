import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TenantKpiSnapshot {
  id: string;
  window: string;
  capturedAt: string;
  gmvCents: number;
  aovCents: number;
  attachRate: number;
  prepSlaP95Minutes: number;
  aiAcceptanceRate: number;
  safetyBlocks: number;
}

async function fetchTenantKpis(tenantId: string): Promise<TenantKpiSnapshot[]> {
  const { data, error } = await supabase
    .from("tenant_kpi_snapshots")
    .select("id, window, captured_at, gmv_cents, aov_cents, attach_rate, prep_sla_p95_minutes, ai_acceptance_rate, safety_blocks")
    .eq("tenant_id", tenantId)
    .order("captured_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    window: row.window ?? "7d",
    capturedAt: row.captured_at ?? new Date().toISOString(),
    gmvCents: Number(row.gmv_cents ?? 0),
    aovCents: Number(row.aov_cents ?? 0),
    attachRate: Number(row.attach_rate ?? 0),
    prepSlaP95Minutes: Number(row.prep_sla_p95_minutes ?? 0),
    aiAcceptanceRate: Number(row.ai_acceptance_rate ?? 0),
    safetyBlocks: Number(row.safety_blocks ?? 0),
  }));
}

export function useTenantKpis(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "tenant-kpis", tenantId],
    queryFn: () => fetchTenantKpis(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}
