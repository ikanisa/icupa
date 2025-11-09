import { Card } from "@icupa/ui/card";
import { Badge } from "@icupa/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@icupa/ui/tabs";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@icupa/ui/chart";
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { useAgentPerformance } from "@/hooks/useAgentPerformance";
import type { AdminTenant } from "@/hooks/useAdminTenants";

interface AgentPerformanceWidgetProps {
  tenant: AdminTenant | null;
}

export function AgentPerformanceWidget({ tenant }: AgentPerformanceWidgetProps) {
  const { summaries, isLoading, isError } = useAgentPerformance(tenant?.id ?? null);

  if (!tenant) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">Select a tenant to load agent performance widgets.</p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">Loading agent performance…</p>
      </Card>
    );
  }

  if (isError || summaries.length === 0) {
    return (
      <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
        <p className="text-sm text-white/70">No agent performance telemetry recorded yet.</p>
      </Card>
    );
  }

  return (
    <Tabs defaultValue={summaries[0]?.agentType ?? "waiter"} className="space-y-4">
      <TabsList className="glass-card border border-white/10 bg-white/10">
        {summaries.map((summary) => (
          <TabsTrigger key={summary.agentType} value={summary.agentType} className="data-[state=active]:bg-white data-[state=active]:text-primary">
            {summary.agentType.replaceAll("_", " ")}
          </TabsTrigger>
        ))}
      </TabsList>

      {summaries.map((summary) => (
        <TabsContent key={summary.agentType} value={summary.agentType} className="space-y-4">
          <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">Agent health score</p>
                <p className="mt-1 text-3xl font-semibold">{summary.performanceScore}/100</p>
                {summary.latest ? (
                  <p className="text-xs text-white/60">
                    {summary.latest.runCount} runs • {summary.latest.timeWindow} window • {summary.latest.avgTokens} avg tokens
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <TrendBadge label="Success" trend={summary.successTrend.trend} value={summary.successTrend.latest} />
                <TrendBadge label="Tool" trend={summary.toolTrend.trend} value={summary.toolTrend.latest} />
              </div>
            </div>
          </Card>

          <Card className="glass-card border border-white/10 bg-white/10 p-6 text-white">
            <p className="text-xs uppercase tracking-[0.3em] text-white/60">Run history</p>
            <div className="mt-4 h-64">
              <ChartContainer
                config={{
                  success: { label: "Success", color: "hsl(144, 70%, 62%)" },
                  tool: { label: "Tool", color: "hsl(199, 89%, 71%)" },
                }}
                className="h-full"
              >
                <ResponsiveContainer>
                  <LineChart data={summary.history.map((entry) => ({
                    label: new Date(entry.capturedAt).toLocaleString(),
                    success: entry.successRate,
                    tool: entry.toolSuccessRate,
                  }))}>
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.7)" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "rgba(255,255,255,0.7)" }} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value) => `${Number(value).toFixed(1)}%`} />} />
                    <Line type="monotone" dataKey="success" stroke="hsl(144, 70%, 62%)" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="tool" stroke="hsl(199, 89%, 71%)" strokeWidth={2} dot={false} strokeDasharray="5 4" />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </Card>
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface TrendBadgeProps {
  label: string;
  trend: "up" | "down" | "flat";
  value: number;
}

function TrendBadge({ label, trend, value }: TrendBadgeProps) {
  const tone = cn(
    "rounded-full px-3 py-1 text-xs font-semibold",
    trend === "up" && "bg-emerald-500/20 text-emerald-100",
    trend === "down" && "bg-red-500/20 text-red-100",
    trend === "flat" && "bg-white/10 text-white",
  );

  return <Badge className={tone}>{label}: {value.toFixed(1)}%</Badge>;
}
