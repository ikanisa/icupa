import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FiscalizationSlaSummary {
  pendingCount: number;
  processingCount: number;
  failedCount: number;
  slaBreachCount: number;
  oldestPendingSeconds: number;
  lastError: string | null;
  lastErrorAt: string | null;
  lastReceiptAt: string | null;
}

async function fetchFiscalizationSla(tenantId: string): Promise<FiscalizationSlaSummary | null> {
  const { data, error } = await supabase.rpc("fiscalization_sla_summary", { tenant_uuid: tenantId });

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) {
    return null;
  }

  return {
    pendingCount: Number(row.pending_count ?? 0),
    processingCount: Number(row.processing_count ?? 0),
    failedCount: Number(row.failed_count ?? 0),
    slaBreachCount: Number(row.sla_breach_count ?? 0),
    oldestPendingSeconds: Number(row.oldest_pending_seconds ?? 0),
    lastError: row.last_error ?? null,
    lastErrorAt: row.last_error_at ?? null,
    lastReceiptAt: row.last_receipt_at ?? null,
  };
}

export function useFiscalizationSlaSummary(tenantId: string | null) {
  return useQuery({
    queryKey: ["admin", "fiscalization-sla", tenantId],
    queryFn: () => fetchFiscalizationSla(tenantId ?? ""),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}
