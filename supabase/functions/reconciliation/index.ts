import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function extractSubPath(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  let basePath = url.pathname.replace(/^\/?functions\/v1\//, "");
  basePath = basePath.replace(/^\/+/, "");
  if (!basePath.startsWith(prefix)) {
    return null;
  }
  const remainder = basePath.slice(prefix.length);
  return remainder.replace(/^\/+/, "");
}

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials missing");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ error: { code, message } }, status);
}

serve(async (req) => {
  try {
    const subPath = extractSubPath(req, "reconciliation");
    const client = createServiceClient();

    if (subPath === "run") {
      if (req.method !== 'POST') {
        return errorResponse(405, 'method_not_allowed', 'Only POST supported');
      }
      let body: { start?: string; end?: string; dry_run?: boolean } = {};
      try {
        body = (await req.json()) as { start?: string; end?: string; dry_run?: boolean };
      } catch { /* allow empty body */ }
      const startIso = body.start ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const endIso = body.end ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const url = new URL(req.url);
      const dryParam = url.searchParams.get('dry_run') ?? url.searchParams.get('dry');
      const dryRun = body.dry_run === true || (dryParam !== null && dryParam !== '0' && dryParam.toLowerCase() !== 'false');
      if (dryRun) {
        const { data: capturedAgg, error: capErr } = await client
          .from('payments')
          .select('amount_cents')
          .eq('status', 'captured')
          .gte('created_at', startIso)
          .lt('created_at', new Date(new Date(endIso + 'T00:00:00Z').getTime() + 24*3600*1000).toISOString())
          .limit(1);
        if (capErr) throw capErr;
        const { data: failedAgg, error: failErr } = await client
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', startIso)
          .lt('created_at', new Date(new Date(endIso + 'T00:00:00Z').getTime() + 24*3600*1000).toISOString());
        if (failErr) throw failErr;
        const { data: pendingAgg, error: pendErr } = await client
          .from('payments')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .lt('created_at', new Date(new Date(endIso + 'T00:00:00Z').getTime() + 24*3600*1000).toISOString());
        if (pendErr) throw pendErr;
        const totalCaptured = Array.isArray(capturedAgg) ? capturedAgg.reduce((s, r: any) => s + (r.amount_cents ?? 0), 0) : 0;
        const failedCount = (failedAgg as any)?.length ?? (typeof (failedAgg as any)?.count === 'number' ? (failedAgg as any).count : 0);
        const pendingCount = (pendingAgg as any)?.length ?? (typeof (pendingAgg as any)?.count === 'number' ? (pendingAgg as any).count : 0);
        return jsonResponse({ status: 'dry_run', window: { start: startIso, end: endIso }, computed: { total_captured_cents: totalCaptured, total_failed: failedCount, pending_payments: pendingCount } });
      } else {
        const { error } = await client.rpc('run_payment_reconciliation', {
          p_window_start: startIso,
          p_window_end: endIso,
        });
        if (error) {
          throw error;
        }
        return jsonResponse({ status: 'completed', window: { start: startIso, end: endIso } });
      }
    }

    if (subPath === "latest") {
      const { data, error } = await client
        .from('payment_reconciliation_runs')
        .select('*')
        .order('coverage_start', { ascending: false })
        .limit(7);

      if (error) {
        throw error;
      }

      return jsonResponse({ runs: data ?? [] });
    }

    return errorResponse(404, 'not_found', 'Unsupported reconciliation endpoint');
  } catch (error) {
    console.error('reconciliation handler error', error);
    return errorResponse(500, 'internal_error', 'Unexpected reconciliation error');
  }
});
