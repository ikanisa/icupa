#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TENANT_ID = process.env.CANARY_TENANT_ID || null;
const AGENT = process.env.CANARY_AGENT || 'waiter';
const ENABLED = (process.env.CANARY_ENABLED || 'true').toLowerCase() === 'true';
const FLAG = process.env.CANARY_FLAG || 'canary';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function main() {
  const payload = { enabled: ENABLED, experiment_flag: FLAG, updated_at: new Date().toISOString() };
  let query = sb.from('agent_runtime_configs').update(payload).eq('agent_type', AGENT);
  if (TENANT_ID) query = query.eq('tenant_id', TENANT_ID);
  const { data, error } = await query.select('id, tenant_id, agent_type, enabled, experiment_flag');
  if (error) {
    console.error('Toggle failed:', error.message);
    process.exit(1);
  }
  console.log('✅ Updated configs:', data);
}

main().catch((e) => { console.error(e); process.exit(1); });

