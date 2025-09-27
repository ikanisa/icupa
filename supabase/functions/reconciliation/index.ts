import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function extractSubPath(req: Request, prefix: string): string | null {
  const url = new URL(req.url);
  const basePath = url.pathname.replace(/^\/?functions\/v1\//, "");
  if (!basePath.startsWith(prefix)) {
    return null;
  }
  const remainder = basePath.slice(prefix.length);
  return remainder.replace(/^\//, "");
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
      const body = (await req.json()) as { start?: string; end?: string };
      const startIso = body.start ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const endIso = body.end ?? new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

      const { error } = await client.rpc('run_payment_reconciliation', {
        p_window_start: startIso,
        p_window_end: endIso,
      });

      if (error) {
        throw error;
      }

      return jsonResponse({ status: 'completed', window: { start: startIso, end: endIso } });
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
