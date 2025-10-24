'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  LiquidGlassCard,
  Skeleton,
  cn,
} from '@icupa/ui';
import { fetchDashboardSnapshot } from '../lib/api';

const statusStyles: Record<string, string> = {
  healthy: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100',
  warning: 'border-amber-400/40 bg-amber-400/15 text-amber-100',
  critical: 'border-rose-500/40 bg-rose-500/15 text-rose-100',
};

const alertStyles: Record<string, string> = {
  critical: 'border-rose-500/40 bg-rose-500/15 text-rose-100',
  positive: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-50',
  info: 'border-sky-400/30 bg-sky-400/10 text-sky-50',
};

export default function VendorDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['vendor-dashboard'],
    queryFn: fetchDashboardSnapshot,
  });

  return (
    <main className="flex-1 bg-gradient-to-br from-slate-950 via-slate-900/80 to-blue-900/70 text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
              Live operations
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold md:text-5xl">Vendor Control Center</h1>
            <p className="mt-3 max-w-3xl text-lg text-white/80">
              Track kitchen SLAs, reconcile payments, and respond to ICUPA AI suggestions in real time.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="glass-surface border-white/20 text-white">
              <Link href="/orders">Review orders</Link>
            </Button>
            <Button asChild>
              <Link href="/menu">Manage menu</Link>
            </Button>
          </div>
        </div>

        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading && Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
          {!isLoading &&
            data?.metrics.map((metric) => (
              <LiquidGlassCard key={metric.id} className="space-y-4 p-6 text-white">
                <p className="text-sm uppercase tracking-[0.25em] text-white/60">{metric.label}</p>
                <p className="text-4xl font-semibold">{metric.value}</p>
                <p className="text-sm text-white/70">{metric.delta}</p>
              </LiquidGlassCard>
            ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-5">
          <Card className="glass-surface border-white/10 bg-white/5 text-white lg:col-span-3">
            <CardHeader>
              <CardTitle>Service health</CardTitle>
              <CardDescription className="text-white/70">
                SLA monitors across prep, runners, and guest sentiment. Indicators update in under 15 seconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}
              {!isLoading &&
                data?.slaSignals.map((signal) => (
                  <div
                    key={signal.id}
                    className={cn(
                      'space-y-2 rounded-2xl border p-4',
                      statusStyles[signal.status] ?? 'border-white/15 bg-white/5 text-white',
                    )}
                  >
                    <p className="text-sm font-semibold uppercase tracking-[0.25em] text-white/60">{signal.title}</p>
                    <p className="text-sm text-white/80">{signal.description}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="glass-surface border-white/10 bg-white/5 text-white lg:col-span-2">
            <CardHeader>
              <CardTitle>Operations feed</CardTitle>
              <CardDescription className="text-white/70">
                Inventory risks, guest feedback, and AI agent nudges surface here for quick triage.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading && Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)}
              {!isLoading &&
                data?.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      'space-y-1 rounded-2xl border p-4',
                      alertStyles[alert.severity] ?? 'border-white/15 bg-white/5 text-white',
                    )}
                  >
                    <p className="text-sm font-semibold text-white">{alert.title}</p>
                    <p className="text-sm text-white/80">{alert.body}</p>
                  </div>
                ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="glass-surface border-white/10 bg-white/5 text-white">
            <CardHeader>
              <CardTitle>Quick intents</CardTitle>
              <CardDescription className="text-white/70">
                Trigger ICUPA agents to coordinate staff, adapt upsells, or notify compliance teams.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {isLoading && Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12 rounded-xl" />)}
              {!isLoading &&
                data?.quickIntents.map((intent) => (
                  <Button key={intent} variant="outline" className="justify-start border-white/20 text-left text-white">
                    {intent}
                  </Button>
                ))}
            </CardContent>
          </Card>

          <LiquidGlassCard className="flex flex-col justify-between gap-6 p-8 text-white">
            <div className="space-y-3">
              <Badge variant="outline" className="glass-surface border-white/20 bg-white/10 text-white">
                Need onboarding?
              </Badge>
              <h2 className="text-3xl font-semibold">Finish your rollout checklist</h2>
              <p className="text-white/80">
                WhatsApp login unlocks the onboarding wizard. Confirm payout MoMo codes, pin your GPS, and launch OCR
                menu ingestion in minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/settings">Open onboarding</Link>
              </Button>
              <Button asChild variant="outline" className="glass-surface border-white/20">
                <Link href="/menu">Upload menu</Link>
              </Button>
            </div>
          </LiquidGlassCard>
        </section>
      </div>
    </main>
  );
}
