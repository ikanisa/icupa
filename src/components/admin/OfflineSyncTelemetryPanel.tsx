import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOfflineSyncTelemetry } from "@/hooks/useOfflineSyncTelemetry";
import { useMerchantLocations } from "@/hooks/useMerchantLocations";
import { formatDistanceToNow } from "date-fns";

interface OfflineSyncTelemetryPanelProps {
  tenantId: string | null;
}

function formatDuration(milliseconds: number | null): string {
  if (!milliseconds || Number.isNaN(milliseconds)) {
    return "–";
  }
  const seconds = Math.round((milliseconds / 1000) * 10) / 10;
  return `${seconds.toFixed(1)}s`;
}

export function OfflineSyncTelemetryPanel({ tenantId }: OfflineSyncTelemetryPanelProps) {
  const { data, summary, isLoading, isError } = useOfflineSyncTelemetry(tenantId);
  const { data: locations } = useMerchantLocations();

  const resolveLocationName = (locationId: string | null): string => {
    if (!locationId) {
      return "Unknown location";
    }
    const location = locations?.find((entry) => entry.id === locationId);
    return location ? location.name : locationId;
  };

  if (!tenantId) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Offline telemetry</p>
        <div className="mt-4 space-y-4">
          <Skeleton className="h-5 w-40 bg-white/10" />
          <Skeleton className="h-24 w-full bg-white/10" />
        </div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="glass-card border border-destructive/40 bg-destructive/10 p-6 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Offline telemetry</p>
        <p className="mt-4 text-sm text-destructive-foreground">We could not load offline sync telemetry for this tenant.</p>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-white/60">Offline telemetry</p>
        <p className="mt-4 text-sm text-white/70">No offline replay events have been recorded for this tenant in the last 7 days.</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">Offline telemetry</p>
          <p className="mt-1 text-sm text-white/70">
            {summary.lastEventAt
              ? `Last replay ${formatDistanceToNow(new Date(summary.lastEventAt), { addSuffix: true })}`
              : "No recent events"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-white/60">Total replays</p>
            <p className="mt-1 text-lg font-semibold">{summary.totalReplayed}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-white/60">Max batch size</p>
            <p className="mt-1 text-lg font-semibold">{summary.maxReplayed}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-white/60">P95 queue drain</p>
            <p className="mt-1 text-lg font-semibold">{formatDuration(summary.p95QueuedMs)}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-white/60">Batches w/ errors</p>
            <p className="mt-1 text-lg font-semibold">{summary.batchesWithErrors}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {data.slice(0, 5).map((event) => (
          <div
            key={event.id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/80"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold">{resolveLocationName(event.locationId)}</span>
              <span className="text-xs text-white/60">
                {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true })}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-4 text-xs text-white/70">
              <span>Replayed {event.replayedCount} ops</span>
              <span>Queue drained in {formatDuration(event.queuedDurationMs)}</span>
              <span>Replay time {formatDuration(event.replayLatencyMs)}</span>
              {event.hadError && <span className="text-warning-foreground">Had retry error</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
