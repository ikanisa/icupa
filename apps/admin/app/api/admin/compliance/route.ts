import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../lib/auth/session';
import type { ComplianceOverview, ComplianceMetric, ComplianceIncident } from '../../../../lib/types';

function buildMetrics(tasks: any[]): ComplianceMetric[] {
  const openTasks = tasks.filter((task) => task.status !== 'resolved' && task.status !== 'closed');
  const critical = openTasks.filter((task) => task.severity === 'critical').length;
  const dueSoon = openTasks.filter((task) => {
    if (!task.due_at) return false;
    const due = new Date(task.due_at as string);
    const diff = due.getTime() - Date.now();
    return diff < 1000 * 60 * 60 * 24 * 3; // within 3 days
  }).length;

  const resolved = tasks.length - openTasks.length;
  const completionRate = tasks.length === 0 ? 1 : resolved / tasks.length;

  return [
    {
      id: 'open_tasks',
      title: 'Open tasks',
      value: `${openTasks.length}`,
      delta: `${critical} critical blockers`,
      trend: critical > 0 ? 'down' : 'stable',
      detail: 'Tasks tracked across fiscal, privacy, and AI governance programs.',
    },
    {
      id: 'due_soon',
      title: 'Due in 72h',
      value: `${dueSoon}`,
      delta: dueSoon > 0 ? 'Escalate owners' : 'All clear',
      trend: dueSoon > 0 ? 'down' : 'up',
      detail: 'Compliance tasks with deadlines inside the next 72 hours.',
    },
    {
      id: 'completion',
      title: 'Completion rate',
      value: `${Math.round(completionRate * 100)}%`,
      delta: `${resolved} resolved`,
      trend: completionRate > 0.75 ? 'up' : 'stable',
      detail: 'Resolved versus total tasks for the current quarter.',
    },
  ];
}

function buildIncidents(tasks: any[]): ComplianceIncident[] {
  return tasks
    .filter((task) => task.status !== 'resolved' && task.status !== 'closed')
    .map((task) => ({
      id: task.id as string,
      tenantId: task.tenant_id ?? null,
      title: task.title as string,
      status: task.status as string,
      severity: (task.severity as ComplianceIncident['severity']) ?? 'medium',
      summary: typeof task.details === 'object' ? JSON.stringify(task.details) : 'Pending operator notes',
      openedAt: task.created_at as string,
      dueAt: task.due_at ?? null,
    }));
}

export async function GET() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('compliance_tasks')
    .select('id, tenant_id, title, status, severity, due_at, created_at, details')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = data ?? [];
  const metrics = buildMetrics(tasks);
  const incidents = buildIncidents(tasks);

  const payload: ComplianceOverview = {
    metrics,
    incidents,
  };

  return NextResponse.json({ compliance: payload });
}
