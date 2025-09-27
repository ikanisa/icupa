import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFiscalizationSlaSummary } from "@/hooks/useFiscalizationSlaSummary";

interface FiscalizationSlaCardProps {
  tenantId: string | null;
}

function formatSeconds(seconds: number) {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return remaining > 0 ? `${minutes}m ${remaining}s` : `${minutes}m`;
}

export function FiscalizationSlaCard({ tenantId }: FiscalizationSlaCardProps) {
  const { data, isLoading } = useFiscalizationSlaSummary(tenantId);

  if (!tenantId) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full bg-white/10" />;
  }

  if (!data) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
        <p className="text-xs uppercase tracking-widest text-white/60">Fiscalisation SLA</p>
        <p className="mt-3 text-sm text-white/70">No fiscalisation activity recorded for this tenant yet.</p>
      </Card>
    );
  }

  const breachVariant = data.slaBreachCount > 0 ? "bg-red-500/20 text-red-100" : "bg-emerald-500/20 text-emerald-100";

  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Fiscalisation SLA</p>
          <p className="text-sm text-white/60">Monitor queue health, failures, and last receipt issuance.</p>
        </div>
        <div className="flex gap-2">
          <Badge className={breachVariant}>{data.slaBreachCount} breaching</Badge>
          <Badge variant="outline" className="border-white/30 text-xs text-white/70">
            Pending: {data.pendingCount}
          </Badge>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Oldest pending</p>
          <p className="mt-1 text-lg font-semibold">{formatSeconds(data.oldestPendingSeconds)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Processing</p>
          <p className="mt-1 text-lg font-semibold">{data.processingCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Failed</p>
          <p className="mt-1 text-lg font-semibold">{data.failedCount}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Last receipt</p>
          <p className="mt-1 text-lg font-semibold">
            {data.lastReceiptAt ? new Date(data.lastReceiptAt).toLocaleString() : "No receipts"}
          </p>
        </div>
      </div>

      {data.lastError ? (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-semibold">Last error</p>
          <p className="mt-1 break-words text-red-100/80">{data.lastError}</p>
          {data.lastErrorAt ? (
            <p className="mt-1 text-xs text-red-100/70">{new Date(data.lastErrorAt).toLocaleString()}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
