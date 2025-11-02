import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../lib/auth/session';
import type { AnalyticsSnapshot } from '../../../../lib/types';

export async function GET() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('tenant_kpi_snapshots')
    .select('tenant_id, time_window, captured_at, gmv_cents, aov_cents, attach_rate, ai_acceptance_rate, prep_sla_p95_minutes, safety_blocks')
    .order('captured_at', { ascending: true })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const grouped = new Map<string, { snapshot: AnalyticsSnapshot; timestamp: number; count: number }>();

  (data ?? []).forEach((row: any) => {
    const captured = row.captured_at ? new Date(row.captured_at as string) : new Date();
    const label = `${row.time_window as string} · ${captured.toISOString().slice(0, 10)}`;
    const existing = grouped.get(label);
    const hallucinationEstimate = Math.min(0.015 + Number(row.safety_blocks ?? 0) * 0.002, 0.08);

    if (!existing) {
      grouped.set(label, {
        snapshot: {
          windowLabel: label,
          gmv: Number(row.gmv_cents ?? 0) / 100,
          aov: Number(row.aov_cents ?? 0) / 100,
          attachRate: Number(row.attach_rate ?? 0),
          aiAcceptance: Number(row.ai_acceptance_rate ?? 0),
          hallucinationRate: hallucinationEstimate,
          prepSla: Number(row.prep_sla_p95_minutes ?? 0),
        },
        timestamp: captured.getTime(),
        count: 1,
      });
      return;
    }

    existing.snapshot.gmv += Number(row.gmv_cents ?? 0) / 100;
    existing.snapshot.aov += Number(row.aov_cents ?? 0) / 100;
    existing.snapshot.attachRate += Number(row.attach_rate ?? 0);
    existing.snapshot.aiAcceptance += Number(row.ai_acceptance_rate ?? 0);
    existing.snapshot.hallucinationRate += hallucinationEstimate;
    existing.snapshot.prepSla += Number(row.prep_sla_p95_minutes ?? 0);
    existing.count += 1;
  });

  const snapshots = Array.from(grouped.values())
    .map(({ snapshot, count, timestamp }) => ({
      ...snapshot,
      aov: count > 0 ? snapshot.aov / count : snapshot.aov,
      attachRate: count > 0 ? snapshot.attachRate / count : snapshot.attachRate,
      aiAcceptance: count > 0 ? snapshot.aiAcceptance / count : snapshot.aiAcceptance,
      hallucinationRate: count > 0 ? snapshot.hallucinationRate / count : snapshot.hallucinationRate,
      prepSla: count > 0 ? snapshot.prepSla / count : snapshot.prepSla,
      timestamp,
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ timestamp, ...rest }) => rest);

  return NextResponse.json({ analytics: snapshots });
}
