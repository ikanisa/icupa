import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOfflineSyncSummary } from "@/hooks/useOfflineSyncSummary";

interface OfflineSyncSummaryCardProps {
  tenantId: string | null;
  lookbackHours?: number;
}

function formatLatency(latencyMs: number | null): string {
  if (!latencyMs || latencyMs <= 0) {
    return "—";
  }

  if (latencyMs >= 1000) {
    return `${(latencyMs / 1000).toFixed(1)}s`;
  }

  return `${Math.round(latencyMs)}ms`;
}

export function OfflineSyncSummaryCard({ tenantId, lookbackHours = 24 }: OfflineSyncSummaryCardProps) {
  const { data, isLoading, isError, error } = useOfflineSyncSummary(tenantId, lookbackHours);

  const totals = useMemo(() => {
    if (!data || data.length === 0) {
      return null;
    }

    return data.reduce(
      (acc, item) => {
        acc.totalBatches += item.totalBatches;
        acc.failedBatches += item.failedBatches;
        acc.totalReplayed += item.totalReplayed;
        acc.totalFailed += item.totalFailed;
        return acc;
      },
      { totalBatches: 0, failedBatches: 0, totalReplayed: 0, totalFailed: 0 },
    );
  }, [data]);

  if (!tenantId) {
    return null;
  }

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Offline sync telemetry</p>
          <p className="text-sm text-white/60">
            Review background sync batches over the past {lookbackHours} hour{lookbackHours === 1 ? "" : "s"} to confirm queued
            diner actions are replaying successfully after reconnection.
          </p>
        </div>
        {totals ? (
          <div className="flex flex-wrap gap-2">
            <Badge className="bg-emerald-500/20 text-emerald-100">
              {totals.totalBatches - totals.failedBatches} successful
            </Badge>
            <Badge variant={totals.failedBatches > 0 ? "destructive" : "outline"} className="border-white/20 text-white">
              {totals.failedBatches} failed
            </Badge>
          </div>
        ) : (
          <Badge className="bg-white/10 text-white/70">No data</Badge>
        )}
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-full bg-white/10" />
          <Skeleton className="h-10 w-full bg-white/10" />
        </div>
      ) : isError ? (
        <p className="mt-4 text-sm text-red-200">
          {error instanceof Error ? error.message : "We could not load offline sync telemetry."}
        </p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 text-sm text-white/70">No background sync activity recorded for the selected window.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 text-xs uppercase tracking-widest text-white/60">
                <TableHead className="min-w-[160px]">Location</TableHead>
                <TableHead className="text-right">Batches</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Replayed ops</TableHead>
                <TableHead className="text-right">Failed ops</TableHead>
                <TableHead className="text-right">Avg latency</TableHead>
                <TableHead className="text-right">Max latency</TableHead>
                <TableHead className="text-right">Last replay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item) => {
                const successRate = item.totalBatches > 0 ? 1 - item.failedBatches / item.totalBatches : 1;
                const tone = successRate < 0.9 ? "text-amber-200" : "text-emerald-200";
                return (
                  <TableRow key={item.locationId ?? "unknown"} className="border-white/10 text-sm text-white/80">
                    <TableCell>{item.locationName ?? "Unknown location"}</TableCell>
                    <TableCell className="text-right font-mono">{item.totalBatches}</TableCell>
                    <TableCell className={`text-right font-mono ${item.failedBatches > 0 ? "text-amber-200" : "text-white/70"}`}>
                      {item.failedBatches}
                    </TableCell>
                    <TableCell className="text-right font-mono">{item.totalReplayed}</TableCell>
                    <TableCell className={`text-right font-mono ${item.totalFailed > 0 ? "text-amber-200" : "text-white/70"}`}>
                      {item.totalFailed}
                    </TableCell>
                    <TableCell className={`text-right font-mono ${tone}`}>{formatLatency(item.avgLatencyMs)}</TableCell>
                    <TableCell className="text-right font-mono text-white/70">{formatLatency(item.maxLatencyMs)}</TableCell>
                    <TableCell className="text-right font-mono text-white/70">
                      {item.lastReplay ? new Date(item.lastReplay).toLocaleString() : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
