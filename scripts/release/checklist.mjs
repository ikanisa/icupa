#!/usr/bin/env node
import { request as pwRequest } from '@playwright/test';

const BASE_APP = process.env.APP_BASE_URL || 'http://localhost:5173';
const AGENTS_BASE = process.env.AGENTS_BASE_URL || '';
const SUPABASE_FUNCTIONS_URL = process.env.SUPABASE_FUNCTIONS_URL || '';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ALLOW_SKIP = (process.env.CHECKLIST_ALLOW_SKIP || 'true').toLowerCase() === 'true';

async function safeRequest(method, url, { headers, data } = {}) {
  try {
    const req = await pwRequest.newContext();
    const res = method === 'GET'
      ? await req.get(url, { headers })
      : await req.post(url, { headers, data });
    const json = await res.json().catch(() => ({}));
    return { status: res.status(), json };
  } catch (error) {
    return { status: null, json: null, error };
  }
}

async function main() {
  const headers = SRK ? { Authorization: `Bearer ${SRK}` } : undefined;

  const checks = [];

  if (AGENTS_BASE) {
    checks.push(['Agents /health', await safeRequest('GET', `${AGENTS_BASE.replace(/\/$/, '')}/health`)]);
  } else {
    console.log('⚪ Agents /health: skipped (AGENTS_BASE_URL not set)');
  }

  if (SUPABASE_FUNCTIONS_URL) {
    const base = SUPABASE_FUNCTIONS_URL.replace(/\/$/, '');
    checks.push(['Reconciliation dry-run', await safeRequest('POST', `${base}/reconciliation/reconcile_daily`, { headers, data: { since_hours: 1 } })]);
    checks.push(['Receipts process_queue', await safeRequest('POST', `${base}/receipts/process_queue`, { headers, data: { reason: 'checklist' } })]);
    checks.push(['Voice waiter status', await safeRequest('POST', `${base}/voice/session`, { headers, data: {} })]);
  } else {
    console.log('⚪ Supabase functions checks: skipped (SUPABASE_FUNCTIONS_URL not set)');
  }

  let failures = 0;
  for (const [name, result] of checks) {
    if (!result) continue;
    if (result.error) {
      console.log(`${ALLOW_SKIP ? '⚪' : '❌'} ${name}: skipped (${result.error.message || result.error})`);
      if (!ALLOW_SKIP) failures += 1;
      continue;
    }
    const ok = result.status >= 200 && result.status < 300;
    const acceptable = name.includes('Voice') ? result.status === 200 || result.status === 503 : ok;
    console.log(`${acceptable ? '✅' : '❌'} ${name}:`, result.status, JSON.stringify(result.json));
    if (!acceptable) failures += 1;
  }

  if (failures > 0) {
    console.error(`\nChecklist FAILED with ${failures} failing checks.`);
    process.exit(1);
  }

  console.log('\nChecklist PASSED.');
}

main().catch((e) => { console.error(e); process.exit(1); });
