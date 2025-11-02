'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from '@icupa/ui';
import { Line, LineChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, LineChartIcon } from 'lucide-react';
import { fetchAnalyticsTimeseries } from '../../../lib/api';

const chartConfig = {
  gmv: {
    label: 'GMV (USD)',
    color: 'hsl(162 82% 60%)',
  },
  aiAcceptance: {
    label: 'AI acceptance',
    color: 'hsl(210 100% 68%)',
  },
} as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export default function AnalyticsPage() {
  const { data } = useQuery({ queryKey: ['admin-analytics'], queryFn: fetchAnalyticsTimeseries });

  const { latest, previous } = useMemo(() => {
    if (!data?.length) {
      return { latest: undefined, previous: undefined };
    }
    const last = data[data.length - 1];
    const prev = data[data.length - 2];
    return { latest: last, previous: prev };
  }, [data]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Network analytics</h1>
          <p className="max-w-2xl text-sm text-white/70">
            Monitor GMV, adoption, and SLA performance across every deployment to keep the rollouts healthy.
          </p>
        </div>
        <Badge variant="outline" className="glass-surface border-white/20 text-white">
          Updated weekly
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="GMV"
          value={latest ? formatCurrency(latest.gmv) : '—'}
          delta={computeDelta(latest?.gmv, previous?.gmv)}
          sublabel="Week over week"
        />
        <MetricCard
          title="Average order value"
          value={latest ? formatCurrency(latest.aov) : '—'}
          delta={computeDelta(latest?.aov, previous?.aov)}
          sublabel="Basket size"
        />
        <MetricCard
          title="AI acceptance"
          value={latest ? formatPercent(latest.aiAcceptance) : '—'}
          delta={computeDelta(latest?.aiAcceptance, previous?.aiAcceptance)}
          sublabel="Orders touched by AI"
        />
        <MetricCard
          title="Prep SLA"
          value={latest ? formatPercent(latest.prepSla) : '—'}
          delta={computeDelta(latest?.prepSla, previous?.prepSla)}
          sublabel="Meals ready on time"
        />
      </div>

      <Card className="glass-surface border-white/10 bg-white/5">
        <CardHeader className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-white">
            <LineChartIcon className="h-4 w-4" aria-hidden />
            <CardTitle className="text-white">GMV vs AI adoption</CardTitle>
          </div>
          <CardDescription className="text-white/70">
            Autonomy lift correlates with higher GMV and attachment as vendors complete onboarding.
          </CardDescription>
        </CardHeader>
        <CardContent className="w-full">
          <ChartContainer config={chartConfig} className="h-[320px]">
            <LineChart data={data ?? []} margin={{ left: 12, right: 12 }}>
              <CartesianGrid strokeDasharray="4 8" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="windowLabel" stroke="rgba(255,255,255,0.6)" tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="gmv"
                stroke="rgba(255,255,255,0.6)"
                tickFormatter={(value: number) => `$${Math.round(value / 1000)}k`}
                width={64}
              />
              <YAxis
                yAxisId="acceptance"
                orientation="right"
                stroke="rgba(255,255,255,0.6)"
                tickFormatter={(value: number) => `${Math.round(value * 100)}%`}
                width={48}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Line
                dataKey="gmv"
                name="GMV (USD)"
                type="monotone"
                stroke="var(--color-gmv)"
                strokeWidth={2.5}
                yAxisId="gmv"
                dot={false}
                activeDot={{ r: 4 }}
              />
              <Line
                dataKey="aiAcceptance"
                name="AI acceptance"
                type="monotone"
                stroke="var(--color-aiAcceptance)"
                strokeWidth={2.5}
                yAxisId="acceptance"
                dot={false}
                strokeDasharray="6 6"
              />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card className="glass-surface border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Signals to investigate</CardTitle>
          <CardDescription className="text-white/70">
            Hallucination rates and attach lift indicate which deployments need prompts or retraining.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <InsightPill
            label="Hallucination rate"
            value={latest ? `${(latest.hallucinationRate * 100).toFixed(1)}%` : '—'}
            tone="success"
            description="Maintains below 2% thanks to allergen guardrails and escalation hooks."
          />
          <InsightPill
            label="Attach rate"
            value={latest ? `${Math.round(latest.attachRate * 100)}%` : '—'}
            tone="info"
            description="Promo orchestrator nudges upsells without breaching configured budgets."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function computeDelta(current?: number, previous?: number) {
  if (current == null || previous == null || previous === 0) {
    return undefined;
  }
  const delta = ((current - previous) / previous) * 100;
  return Math.round(delta * 10) / 10;
}

function MetricCard({
  title,
  value,
  delta,
  sublabel,
}: {
  title: string;
  value: string;
  delta?: number;
  sublabel: string;
}) {
  const isPositive = typeof delta === 'number' ? delta >= 0 : undefined;
  return (
    <Card className="glass-surface border-white/10 bg-white/5">
      <CardHeader className="space-y-2">
        <CardTitle className="text-sm font-medium text-white/70">{title}</CardTitle>
        <CardDescription className="text-3xl font-semibold text-white">{value}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-white/70">
        <span>{sublabel}</span>
        {typeof delta === 'number' ? (
          <span className={isPositive ? 'flex items-center gap-1 text-emerald-300' : 'flex items-center gap-1 text-rose-300'}>
            {isPositive ? <ArrowUpRight className="h-4 w-4" aria-hidden /> : <ArrowDownRight className="h-4 w-4" aria-hidden />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        ) : (
          <span>—</span>
        )}
      </CardContent>
    </Card>
  );
}

function InsightPill({
  label,
  value,
  tone,
  description,
}: {
  label: string;
  value: string;
  tone: 'success' | 'info';
  description: string;
}) {
  const toneStyles =
    tone === 'success'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
      : 'border-sky-500/40 bg-sky-500/10 text-sky-100';
  return (
    <div className={`flex flex-col gap-2 rounded-2xl border px-5 py-4 ${toneStyles}`}>
      <div className="text-xs uppercase tracking-wide text-white/80">{label}</div>
      <div className="text-2xl font-semibold text-white">{value}</div>
      <p className="text-sm text-white/70">{description}</p>
    </div>
  );
}
