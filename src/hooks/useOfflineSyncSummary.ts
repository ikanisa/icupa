import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OfflineSyncLocationSummary {
  locationId: string | null;
  locationName: string | null;
  totalBatches: number;
  failedBatches: number;
  totalReplayed: number;
  totalFailed: number;
  avgLatencyMs: number | null;
  maxLatencyMs: number | null;
  lastReplay: string | null;
  lastFailure: string | null;
}

async function fetchOfflineSyncSummary(
  tenantId: string,
  lookbackHours: number,
): Promise<OfflineSyncLocationSummary[]> {
  const { data, error } = await supabase.rpc("offline_sync_summary", {
    tenant_uuid: tenantId,
    lookback_hours: lookbackHours,
  });

  if (error) {
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];

  return rows.map((row) => ({
    locationId: typeof row.location_id === "string" ? row.location_id : null,
    locationName: typeof row.location_name === "string" ? row.location_name : null,
    totalBatches: Number(row.total_batches ?? 0),
    failedBatches: Number(row.failed_batches ?? 0),
    totalReplayed: Number(row.total_replayed ?? 0),
    totalFailed: Number(row.total_failed ?? 0),
    avgLatencyMs:
      row.avg_latency_ms === null || row.avg_latency_ms === undefined
        ? null
        : Number(row.avg_latency_ms),
    maxLatencyMs:
      row.max_latency_ms === null || row.max_latency_ms === undefined
        ? null
        : Number(row.max_latency_ms),
    lastReplay: typeof row.last_replay === "string" ? row.last_replay : row.last_replay ?? null,
    lastFailure: typeof row.last_failure === "string" ? row.last_failure : row.last_failure ?? null,
  }));
}

export function useOfflineSyncSummary(tenantId: string | null, lookbackHours = 24) {
  return useQuery({
    queryKey: ["admin", "offline-sync-summary", tenantId, lookbackHours],
    queryFn: () => fetchOfflineSyncSummary(tenantId ?? "", lookbackHours),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
}
