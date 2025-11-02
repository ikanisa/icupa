'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Progress,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@icupa/ui';
import { CheckCircle2, CircleDashed, CircleSlash2, Users } from 'lucide-react';
import { fetchTenants } from '../../../lib/api';
import type { TenantRecord } from '../../../lib/types';

const statusConfig: Record<
  TenantRecord['status'],
  { label: string; icon: typeof CheckCircle2; tone: 'success' | 'warning' | 'danger' | 'info' }
> = {
  active: { label: 'Live', icon: CheckCircle2, tone: 'success' },
  onboarding: { label: 'Onboarding', icon: CircleDashed, tone: 'info' },
  blocked: { label: 'Blocked', icon: CircleSlash2, tone: 'danger' },
  pilot: { label: 'Pilot', icon: Users, tone: 'warning' },
};

const toneClasses: Record<'success' | 'warning' | 'danger' | 'info', string> = {
  success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  danger: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  info: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export default function TenantsPage() {
  const { data: tenants, isLoading } = useQuery({ queryKey: ['admin-tenants'], queryFn: fetchTenants });

  const stats = useMemo(() => {
    if (!tenants?.length) {
      return { total: 0, active: 0, pilot: 0, blocked: 0 };
    }
    return tenants.reduce(
      (acc, tenant) => {
        acc.total += 1;
        if (tenant.status === 'active') acc.active += 1;
        if (tenant.status === 'pilot') acc.pilot += 1;
        if (tenant.status === 'blocked') acc.blocked += 1;
        return acc;
      },
      { total: 0, active: 0, pilot: 0, blocked: 0 },
    );
  }, [tenants]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Tenant lifecycle</h1>
          <p className="max-w-2xl text-sm text-white/70">
            Track onboarding progress, assign rollout contacts, and review which experiences are approved for every deployment.
          </p>
        </div>
        <Button size="sm" variant="outline" className="glass-surface border-white/20 text-white">
          Export onboarding report
        </Button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <LifecycleMetric label="Active" value={stats.active} total={stats.total} tone="success" />
        <LifecycleMetric label="Pilot" value={stats.pilot} total={stats.total} tone="warning" />
        <LifecycleMetric label="Blocked" value={stats.blocked} total={stats.total} tone="danger" />
        <LifecycleMetric label="Total tenants" value={stats.total} total={stats.total} tone="info" />
      </div>

      <Card className="glass-surface border-white/10 bg-white/5">
        <CardHeader>
          <CardTitle className="text-white">Rollout tracker</CardTitle>
          <CardDescription className="text-white/70">
            Upcoming go-live targets, autonomy settings, and the next onboarding step for each tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption className="text-white/60">Data synced hourly from Supabase.</TableCaption>
            <TableHeader>
              <TableRow className="border-white/10 text-white/80">
                <TableHead className="w-[220px]">Tenant</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Locations</TableHead>
                <TableHead>Go-live target</TableHead>
                <TableHead>Autonomy</TableHead>
                <TableHead>Next step</TableHead>
                <TableHead>Owner</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <SkeletonRows />}
              {!isLoading &&
                tenants?.map((tenant) => {
                  const status = statusConfig[tenant.status];
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={tenant.id} className="border-white/5">
                      <TableCell className="font-medium text-white">{tenant.name}</TableCell>
                      <TableCell className="text-white/70">{tenant.region}</TableCell>
                      <TableCell>
                        <Badge className={toneClasses[status.tone]}>
                          <StatusIcon className="mr-2 h-3.5 w-3.5" aria-hidden />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/70">{tenant.locations}</TableCell>
                      <TableCell className="text-white/70">{formatDate(tenant.goLiveTarget)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-white/20 text-white">
                          L{tenant.aiAutonomy}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-white/70">{tenant.onboardingStep}</TableCell>
                      <TableCell className="text-white/70">{tenant.accountManager}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function LifecycleMetric({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: keyof typeof toneClasses;
}) {
  const percentage = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <Card className="glass-surface border-white/10 bg-white/5">
      <CardHeader className="space-y-2">
        <CardTitle className="text-sm font-medium text-white/80">{label}</CardTitle>
        <div className="flex items-end justify-between">
          <span className="text-3xl font-semibold text-white">{value}</span>
          <Badge className={toneClasses[tone]}>{percentage}%</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Progress
          value={percentage}
          className="h-2 bg-white/10"
          indicatorClassName={
            tone === 'danger'
              ? 'bg-rose-500'
              : tone === 'warning'
              ? 'bg-amber-400'
              : tone === 'success'
              ? 'bg-emerald-400'
              : 'bg-sky-400'
          }
        />
      </CardContent>
    </Card>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, index) => (
        <TableRow key={index} className="border-white/5">
          <TableCell colSpan={8}>
            <div className="h-10 animate-pulse rounded-lg bg-white/5" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
