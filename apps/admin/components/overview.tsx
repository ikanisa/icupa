'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@icupa/ui';
import { fetchAnalyticsTimeseries, fetchComplianceOverview, fetchFeatureFlags, fetchTenants } from '../lib/api';
import { ArrowUpRight, Bot, Layers, ShieldCheck, ToggleLeft } from 'lucide-react';

export function Overview() {
  const { data: tenants } = useQuery({ queryKey: ['admin-tenants'], queryFn: fetchTenants });
  const { data: analytics } = useQuery({ queryKey: ['admin-analytics'], queryFn: fetchAnalyticsTimeseries });
  const { data: compliance } = useQuery({ queryKey: ['admin-compliance'], queryFn: fetchComplianceOverview });
  const { data: flags } = useQuery({ queryKey: ['admin-feature-flags'], queryFn: fetchFeatureFlags });

  const latestAnalytics = analytics?.at(-1);

  const tenantSummary = useMemo(() => {
    if (!tenants?.length) {
      return { total: 0, active: 0, blocked: 0 };
    }
    return tenants.reduce(
      (acc, tenant) => {
        acc.total += 1;
        if (tenant.status === 'active') acc.active += 1;
        if (tenant.status === 'blocked') acc.blocked += 1;
        return acc;
      },
      { total: 0, active: 0, blocked: 0 },
    );
  }, [tenants]);

  const enabledFlags = flags?.filter((flag) => flag.enabled).length ?? 0;
  const openIncidents = compliance?.incidents.filter((incident) => incident.status !== 'mitigated').length ?? 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Live tenants"
          value={tenantSummary.active}
          badge={`${tenantSummary.total} total`}
          description="Tenants past go-live with AI autonomy enabled."
          href={'/tenants' as Route}
          icon={<Layers className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          title="GMV (weekly)"
          value={latestAnalytics ? `$${Math.round(latestAnalytics.gmv / 1000)}k` : '—'}
          badge={latestAnalytics ? `${Math.round(latestAnalytics.aiAcceptance * 100)}% AI adoption` : 'Syncing'}
          description="Aggregate dine-in GMV across all deployments."
          href={'/analytics' as Route}
          icon={<ArrowUpRight className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          title="Open incidents"
          value={openIncidents}
          badge={compliance ? `${compliance.metrics[0]?.value ?? '—'} coverage` : 'Syncing'}
          description="Compliance items requiring review or escalation."
          href={'/compliance' as Route}
          icon={<ShieldCheck className="h-5 w-5" aria-hidden />}
        />
        <SummaryCard
          title="Feature flags"
          value={enabledFlags}
          badge={`${flags?.length ?? 0} total`}
          description="Toggles active across client, vendor, and admin apps."
          href={'/flags' as Route}
          icon={<ToggleLeft className="h-5 w-5" aria-hidden />}
        />
      </section>

      <Card className="glass-surface border-white/10 bg-white/5">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-white">
            <Bot className="h-4 w-4" aria-hidden />
            <CardTitle className="text-white">AI agents overview</CardTitle>
          </div>
          <Button size="sm" variant="outline" className="glass-surface border-white/20 text-white" asChild>
            <Link href={'/ai' as Route}>Manage autonomy</Link>
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 text-sm text-white/70">
            <p>
              Agents sync structured instructions and tool allow-lists via Supabase Edge Functions. Use the autonomy panel to
              adjust guardrails before promoting canaries to 100%.
            </p>
            <p>
              The agents-service logs summaries to `agent_events` for human review. Compliance watchers keep hallucination rates
              below 2% across the network.
            </p>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-white/15 bg-white/5 p-4 text-sm text-white/70">
            <Badge variant="outline" className="self-start border-emerald-400/50 text-emerald-200">
              Latest signals
            </Badge>
            <ul className="space-y-1">
              <li>• Promo orchestrator running ε-bandit with daily budget guardrail of $50.</li>
              <li>• Compliance watcher flagged 3 privacy requests awaiting vendor confirmation.</li>
              <li>• AI waiter autonomy level L2 in production markets.</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  href,
  badge,
  icon,
}: {
  title: string;
  value: number | string;
  description: string;
  href: Route;
  badge: string;
  icon: ReactNode;
}) {
  return (
    <Card className="glass-surface border-white/10 bg-white/5">
      <CardHeader className="flex items-start justify-between gap-2">
        <div>
          <CardTitle className="text-sm font-medium text-white/70">{title}</CardTitle>
          <CardDescription className="text-3xl font-semibold text-white">{value}</CardDescription>
        </div>
        <div className="rounded-full border border-white/15 bg-white/10 p-2 text-white/80">{icon}</div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-white/70">
        <p>{description}</p>
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="border-white/20 text-xs text-white">
            {badge}
          </Badge>
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white" asChild>
            <Link href={href}>Open</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
