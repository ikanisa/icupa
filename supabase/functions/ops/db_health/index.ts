import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function handleDbHealth(_req: Request): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ ok: false, error: "supabase_env_missing" }, 503);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  async function rpcExists(name: string): Promise<boolean> {
    try {
      // Attempt call without required args; if it returns 400 (missing param), the RPC exists
      const { error } = await sb.rpc(name, {} as never);
      if (!error) return true;
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('not found')) return false;
      // Other errors imply the function is registered but invocation failed (e.g., missing args)
      return true;
    } catch (_e) {
      return false;
    }
  }

  async function tableExists(name: string): Promise<boolean> {
    const { error } = await sb.from(name as any).select('id', { head: true, count: 'exact' }).limit(1);
    if (!error) return true;
    const msg = (error.message || '').toLowerCase();
    return !(msg.includes('does not exist') || msg.includes('relation') && msg.includes('does not exist'));
  }

  async function fetchSchedulerUrl(key: string): Promise<string | null> {
    const { data, error } = await sb.from('scheduler_config').select('value').eq('key', key).maybeSingle<{ value: string }>();
    if (error) return null;
    return (data?.value ?? null) as unknown as string | null;
  }

  const [reconRpc, enqRpc, deqRpc, delRpc, mpTable, runsTable, schedulerUrl] = await Promise.all([
    rpcExists('run_payment_reconciliation'),
    rpcExists('enqueue_fiscalization_job'),
    rpcExists('dequeue_fiscalization_job'),
    rpcExists('delete_fiscalization_job'),
    tableExists('merchant_profiles'),
    tableExists('payment_reconciliation_runs'),
    fetchSchedulerUrl('menu_embed_items_url'),
  ]);

  return json({
    ok: true,
    rpc: {
      run_payment_reconciliation: reconRpc,
      enqueue_fiscalization_job: enqRpc,
      dequeue_fiscalization_job: deqRpc,
      delete_fiscalization_job: delRpc,
    },
    tables: {
      merchant_profiles: mpTable,
      payment_reconciliation_runs: runsTable,
    },
    scheduler: {
      menu_embed_items_url: schedulerUrl,
    },
  });
}

export default handleDbHealth;
