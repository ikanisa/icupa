import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@icupa/db';
import { requireAdmin } from '../../../../lib/auth/session';
import { mapAgentConfigRow } from './utils';

const SELECT_COLUMNS =
  'id, tenant_id, agent_type, enabled, session_budget_usd, daily_budget_usd, metadata, instructions, autonomy_level, experiment_flag, updated_at, sync_pending, tool_allowlist';

export async function GET() {
  await requireAdmin();
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('agent_runtime_configs')
    .select(SELECT_COLUMNS)
    .order('agent_type', { ascending: true })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agents: (data ?? []).map(mapAgentConfigRow) });
}
