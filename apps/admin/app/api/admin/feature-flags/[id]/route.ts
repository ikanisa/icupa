import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../../lib/auth/session';
import type { FeatureFlagPayload } from '../../../../../lib/types';
import { mapFeatureFlagRow, buildFeatureFlagUpdate } from '../utils';

interface RouteContext {
  params: { id: string };
}

const SELECT_COLUMNS =
  'id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, metadata, instructions, autonomy_level, experiment_flag, updated_at, sync_pending';

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  const supabase = createServerSupabaseClient();
  const payload = (await request.json()) as Partial<FeatureFlagPayload> | undefined;

  if (!payload) {
    return NextResponse.json({ error: 'Missing update payload' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('agent_runtime_configs')
    .select(SELECT_COLUMNS)
    .eq('id', context.params.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message ?? 'Flag not found' }, { status: 404 });
  }

  const update = buildFeatureFlagUpdate(payload, admin.user.id);
  if (update.metadata) {
    const existingMetadata = (existing.metadata ?? {}) as Record<string, unknown>;
    const newMetadata = update.metadata as Record<string, unknown>;
    update.metadata = {
      ...existingMetadata,
      ...newMetadata,
    };
  }

  const { data, error } = await supabase
    .from('agent_runtime_configs')
    .update(update)
    .eq('id', context.params.id)
    .select(SELECT_COLUMNS)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ flag: mapFeatureFlagRow(data) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  await requireAdmin();
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from('agent_runtime_configs').delete().eq('id', context.params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: context.params.id });
}
