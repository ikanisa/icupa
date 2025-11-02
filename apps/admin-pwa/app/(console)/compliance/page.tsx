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
import { AlertTriangle, CheckCircle, FileWarning, Shield } from 'lucide-react';
import { fetchComplianceOverview } from '../../../lib/api';
import type { ComplianceIncident, ComplianceMetric } from '../../../data/sample';

const statusTone: Record<ComplianceIncident['status'], { label: string; className: string }> = {
  mitigated: { label: 'Mitigated', className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' },
  investigating: { label: 'Investigating', className: 'border-amber-500/40 bg-amber-500/10 text-amber-100' },
  pending_vendor: { label: 'Pending vendor', className: 'border-sky-500/40 bg-sky-500/10 text-sky-100' },
};

const metricIcons: Record<ComplianceMetric['id'], ComponentType<{ className?: string }>> = {
  fiscal_coverage: Shield,
  allergen_incidents: CheckCircle,
  privacy_requests: FileWarning,
};

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
          const Icon = metricIcons[metric.id];
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
                <TableHead className="w-[160px]">Incident</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {incidents.map((incident) => {
                const tone = statusTone[incident.status];
                return (
                  <TableRow key={incident.id} className="border-white/5">
                    <TableCell className="font-medium text-white">{incident.id}</TableCell>
                    <TableCell className="text-white/70">{incident.tenant}</TableCell>
                    <TableCell className="text-white/70">{incident.type}</TableCell>
                    <TableCell className="text-white/70">
                      {new Date(incident.openedAt).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-white/70">{incident.owner}</TableCell>
                    <TableCell>
                      <Badge className={tone.className}>{tone.label}</Badge>
                    </TableCell>
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
