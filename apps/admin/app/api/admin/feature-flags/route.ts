import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../lib/auth/session';
import type { FeatureFlagPayload } from '../../../../lib/types';
import { mapFeatureFlagRow, buildFeatureFlagInsert } from './utils';

export async function GET() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('agent_runtime_configs')
    .select('id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, metadata, instructions, autonomy_level, experiment_flag, updated_at, sync_pending')
    .order('updated_at', { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flags: (data ?? []).map(mapFeatureFlagRow) });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  const payload = (await request.json()) as FeatureFlagPayload | undefined;

  if (!payload || typeof payload.key !== 'string' || payload.key.length === 0) {
    return NextResponse.json({ error: 'Invalid feature flag payload' }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const insert = buildFeatureFlagInsert(payload, admin.user.id);
  const { data, error } = await supabase
    .from('agent_runtime_configs')
    .insert(insert)
    .select('id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, metadata, instructions, autonomy_level, experiment_flag, updated_at, sync_pending')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flag: mapFeatureFlagRow(data) }, { status: 201 });
}
