import { useMemo } from "react";
import { useTenantKpis, TenantKpiSnapshot } from "@/hooks/useTenantKpis";
import { ReconciliationPanel } from "@/components/admin/ReconciliationPanel";
import { OfflineSyncTelemetryPanel } from "@/components/admin/OfflineSyncTelemetryPanel";
import { Card } from "@icupa/ui/card";
import { Skeleton } from "@icupa/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@icupa/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatCurrency } from "@/lib/currency";

interface AnalyticsOverviewProps {
  tenantId: string | null;
  currency: "RWF" | "EUR";
}

interface MetricCardProps {
  label: string;
  value: string;
  helper?: string;
}

function MetricCard({ label, value, helper }: MetricCardProps) {
  return (
    <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
      <p className="text-xs uppercase tracking-widest text-white/60">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {helper ? <p className="mt-1 text-xs text-white/60">{helper}</p> : null}
    </Card>
  );
}

function selectLatest(data: TenantKpiSnapshot[] | undefined, targetWindow: string) {
  return data?.find((snapshot) => snapshot.timeWindow === targetWindow) ?? null;
}

export function AnalyticsOverview({ tenantId, currency }: AnalyticsOverviewProps) {
  const { data, isLoading } = useTenantKpis(tenantId);

  const latest7d = useMemo(() => selectLatest(data, "7d"), [data]);
  const latest30d = useMemo(() => selectLatest(data, "30d"), [data]);

  const chartData = useMemo(() => {
    return (data ?? [])
      .slice()
      .sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime())
      .map((snapshot) => ({
        label: `${snapshot.timeWindow} • ${new Date(snapshot.capturedAt).toLocaleDateString()}`,
        gmv: snapshot.gmvCents / 100,
        attachRate: snapshot.attachRate * 100,
      }));
  }, [data]);

  if (!tenantId) {
    return <p className="text-sm text-white/70">Select a tenant to review analytics.</p>;
  }

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full bg-white/10" />
          ))}
        </div>
        <Skeleton className="h-64 w-full bg-white/10" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-white/70">No analytics data recorded for this tenant yet.</p>;
  }

  const locale = currency === "EUR" ? "en-MT" : "en-RW";

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="GMV (7d)"
          value={formatCurrency(latest7d?.gmvCents ?? 0, currency, locale)}
          helper={latest30d ? `30d: ${formatCurrency(latest30d.gmvCents ?? 0, currency, locale)}` : undefined}
        />
        <MetricCard
          label="Average order value"
          value={formatCurrency(latest7d?.aovCents ?? 0, currency, locale)}
          helper={latest30d ? `30d: ${formatCurrency(latest30d.aovCents ?? 0, currency, locale)}` : undefined}
        />
        <MetricCard
          label="Attach rate"
          value={`${Math.round((latest7d?.attachRate ?? 0) * 100)}%`}
          helper={latest30d ? `30d: ${Math.round((latest30d.attachRate ?? 0) * 100)}%` : undefined}
        />
        <MetricCard
          label="AI acceptance"
          value={`${Math.round((latest7d?.aiAcceptanceRate ?? 0) * 100)}%`}
          helper={`Safety blocks: ${latest7d?.safetyBlocks ?? 0}`}
        />
      </div>

      <Card className="glass-card border border-white/10 bg-white/10 p-4 text-white">
        <p className="text-xs uppercase tracking-widest text-white/60">GMV trend</p>
        <div className="mt-4 h-64">
          <ChartContainer
            config={{
              gmv: { label: "GMV", color: "hsl(199, 89%, 71%)" },
            }}
            className="h-full"
          >
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="label" stroke="rgba(255,255,255,0.6)" tick={{ fontSize: 12 }} interval={chartData.length > 6 ? 1 : 0} angle={-15} textAnchor="end" height={60} />
              <YAxis stroke="rgba(255,255,255,0.6)" tickFormatter={(value) => formatCurrency(Math.round(value * 100), currency, locale)} width={100} />
              <Line type="monotone" dataKey="gmv" stroke="hsl(199, 89%, 71%)" strokeWidth={2} dot={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Math.round(Number(value) * 100), currency, locale)} />} />
            </LineChart>
          </ChartContainer>
        </div>
      </Card>

      <OfflineSyncTelemetryPanel tenantId={tenantId} />

      <ReconciliationPanel />
    </div>
  );
}
