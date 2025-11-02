import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../../lib/auth/session';
import type { AgentSetting } from '../../../../../lib/types';
import { mapAgentConfigRow, buildAgentConfigUpdate } from '../utils';

interface RouteContext {
  params: { id: string };
}

const SELECT_COLUMNS =
  'id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, metadata, instructions, autonomy_level, experiment_flag, updated_at, sync_pending, tool_allowlist';

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await requireAdmin();
  const supabase = createServerSupabaseClient();
  const payload = (await request.json()) as Partial<AgentSetting> | undefined;

  if (!payload) {
    return NextResponse.json({ error: 'Missing agent update payload' }, { status: 400 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from('agent_runtime_configs')
    .select(SELECT_COLUMNS)
    .eq('id', context.params.id)
    .maybeSingle();

  if (fetchError || !existing) {
    return NextResponse.json({ error: fetchError?.message ?? 'Agent configuration not found' }, { status: 404 });
  }

  const update = buildAgentConfigUpdate(payload, admin.user.id);
  if (update.metadata) {
    update.metadata = {
      ...(existing.metadata ?? {}),
      ...(update.metadata as Record<string, unknown>),
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

  return NextResponse.json({ agent: mapAgentConfigRow(data) });
}
