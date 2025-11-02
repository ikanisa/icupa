'use client';

import type { ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@icupa/ui';
import { AlertTriangle, CheckCircle, Shield } from 'lucide-react';
import { fetchComplianceOverview } from '../../../lib/api';
import type { ComplianceIncident, ComplianceMetric } from '../../../lib/types';

const metricIcons: Record<string, ComponentType<{ className?: string }>> = {
  open_tasks: Shield,
  due_soon: AlertTriangle,
  completion: CheckCircle,
};

const severityTone: Record<ComplianceIncident['severity'], string> = {
  low: 'border-sky-500/40 bg-sky-500/10 text-sky-100',
  medium: 'border-amber-500/40 bg-amber-500/10 text-amber-100',
  high: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
  critical: 'border-rose-500/40 bg-rose-500/10 text-rose-100',
};

const statusTone: Record<string, { label: string; className: string }> = {
  mitigated: { label: 'Mitigated', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' },
  investigating: { label: 'Investigating', className: 'border-amber-500/40 bg-amber-500/10 text-amber-100' },
  pending_vendor: { label: 'Pending vendor', className: 'border-sky-500/40 bg-sky-500/10 text-sky-100' },
};

function getStatusBadge(status: string) {
  return (
    statusTone[status] ?? {
      label: status.replace(/_/g, ' '),
      className: 'border-white/15 bg-white/5 text-white/70',
    }
  );
}

function formatDate(value: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function CompliancePage() {
  const { data } = useQuery({ queryKey: ['admin-compliance'], queryFn: fetchComplianceOverview });
  const metrics = data?.metrics ?? [];
  const incidents = data?.incidents ?? [];

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Compliance & safety</h1>
          <p className="max-w-2xl text-sm text-white/70">
            Review fiscal coverage, allergen incidents, and privacy requests to keep deployments audit-ready.
          </p>
        </div>
        <Badge variant="outline" className="glass-surface border-white/20 text-white">
          RLS enforced • Supabase audit trail
        </Badge>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metricIcons[metric.id] ?? Shield;
          return (
            <Card key={metric.id} className="glass-surface border-white/10 bg-white/5">
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-white/80">{metric.title}</CardTitle>
                <Icon className="h-4 w-4 text-white/70" aria-hidden />
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-3xl font-semibold text-white">{metric.value}</div>
                <div className="text-sm text-white/70">{metric.detail}</div>
                <Badge
                  className={
                    metric.trend === 'up'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100'
                      : metric.trend === 'down'
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-100'
                      : 'border-white/15 bg-white/5 text-white/70'
                  }
                >
                  {metric.delta}
                </Badge>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="glass-surface border-white/10 bg-white/5">
        <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-white">Active incidents</CardTitle>
            <CardDescription className="text-white/70">
              Follow through on incidents sourced from agents-service summaries and Supabase webhook alerts.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-rose-400/50 text-rose-200">
            <AlertTriangle className="mr-1 h-3.5 w-3.5" aria-hidden />
            {incidents.length} open
          </Badge>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 text-white/80">
                <TableHead className="w-[200px]">Incident</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Due</TableHead>
                <TableHead>Summary</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => {
                const status = getStatusBadge(incident.status);
                return (
                  <TableRow key={incident.id} className="border-white/5">
                    <TableCell className="font-medium text-white">{incident.title}</TableCell>
                    <TableCell className="text-white/70">{incident.tenantId ?? 'Global'}</TableCell>
                    <TableCell>
                      <Badge className={severityTone[incident.severity] ?? 'border-white/15 bg-white/5 text-white/70'}>
                        {incident.severity.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-white/70">{formatDate(incident.openedAt)}</TableCell>
                    <TableCell className="text-white/70">{formatDate(incident.dueAt)}</TableCell>
                    <TableCell className="text-xs text-white/60">{incident.summary}</TableCell>
                  </TableRow>
                );
              })}
              {incidents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-white/60">
                    All compliance tasks are clear. Supabase will surface new incidents here as they arrive.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
