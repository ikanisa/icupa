import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseCaching } from "@/lib/query-client";

export interface OfflineSyncEvent {
  id: string;
  locationId: string | null;
  replayedCount: number;
  queuedDurationMs: number | null;
  replayLatencyMs: number | null;
  hadError: boolean;
  createdAt: string;
}

export interface OfflineSyncSummary {
  totalReplayed: number;
  batchesWithErrors: number;
  maxReplayed: number;
  p95QueuedMs: number | null;
  p95ReplayMs: number | null;
  lastEventAt: string | null;
}

async function fetchOfflineSyncEvents(tenantId: string): Promise<OfflineSyncEvent[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("offline_sync_events")
    .select("id, location_id, replayed_count, queued_duration_ms, replay_latency_ms, had_error, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", sevenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id!,
    locationId: row.location_id ?? null,
    replayedCount: Number(row.replayed_count ?? 0),
    queuedDurationMs: typeof row.queued_duration_ms === "number" ? row.queued_duration_ms : null,
    replayLatencyMs: typeof row.replay_latency_ms === "number" ? row.replay_latency_ms : null,
    hadError: Boolean(row.had_error),
    createdAt: row.created_at ?? new Date().toISOString(),
  }));
}

function calculatePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (percentile / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(rank);
  const upperIndex = Math.ceil(rank);

  if (lowerIndex === upperIndex) {
    return sorted[lowerIndex] ?? null;
  }

  const weight = rank - lowerIndex;
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[upperIndex] ?? lower;
  return Math.round((lower + (upper - lower) * weight) * 100) / 100;
}

export function summariseOfflineSyncEvents(events: OfflineSyncEvent[]): OfflineSyncSummary {
  const totalReplayed = events.reduce((sum, event) => sum + event.replayedCount, 0);
  const batchesWithErrors = events.filter((event) => event.hadError).length;
  const maxReplayed = events.reduce((max, event) => Math.max(max, event.replayedCount), 0);

  const queuedDurations = events
    .map((event) => event.queuedDurationMs)
    .filter((value): value is number => typeof value === "number");

  const replayLatencies = events
    .map((event) => event.replayLatencyMs)
    .filter((value): value is number => typeof value === "number");

  const p95QueuedMs = calculatePercentile(queuedDurations, 95);
  const p95ReplayMs = calculatePercentile(replayLatencies, 95);

  const lastEventAt = events.length > 0 ? events[0]!.createdAt : null;

  return {
    totalReplayed,
    batchesWithErrors,
    maxReplayed,
    p95QueuedMs,
    p95ReplayMs,
    lastEventAt,
  };
}

export function useOfflineSyncTelemetry(tenantId: string | null) {
  const query = useQuery({
    queryKey: ["supabase", "admin", "offline-sync-telemetry", tenantId],
    queryFn: () => fetchOfflineSyncEvents(tenantId ?? ""),
    enabled: Boolean(tenantId),
    ...withSupabaseCaching({ entity: "offline-sync", staleTime: 60_000 }),
  });

  const summary = useMemo(() => {
    if (!query.data) {
      return summariseOfflineSyncEvents([]);
    }
    return summariseOfflineSyncEvents(query.data);
  }, [query.data]);

  return {
    ...query,
    summary,
  };
}
