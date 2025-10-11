import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ADMIN_ONBOARDING_SECRET = Deno.env.get("ADMIN_ONBOARDING_SECRET") ?? "";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function unauthorized() {
  return json({ error: { code: 'unauthorized', message: 'Service credentials required' } }, 401);
}

export async function handleUpdateScheduler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: { code: 'method_not_allowed', message: 'Only POST supported' } }, 405);
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json({ error: { code: 'config_missing', message: 'Server config incomplete' } }, 503);
  }

  const auth = req.headers.get('authorization') ?? '';
  if (!auth.toLowerCase().startsWith('bearer ')) return unauthorized();
  const token = auth.slice(7).trim();
  if (!(token && (token === SUPABASE_SERVICE_ROLE_KEY || (ADMIN_ONBOARDING_SECRET && token === ADMIN_ONBOARDING_SECRET)))) {
    return unauthorized();
  }

  let body: { key?: string; value?: string; url?: string } = {};
  try {
    body = (await req.json()) as { key?: string; value?: string; url?: string };
  } catch (_) {
    // allow empty
  }

  const key = (body.key ?? 'menu_embed_items_url').trim();
  const value = (body.value ?? body.url ?? '').trim();
  if (!key || !value) {
    return json({ error: { code: 'invalid_payload', message: 'Provide url/value for the scheduler key' } }, 400);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { error } = await sb
    .from('scheduler_config')
    .upsert({ key, value, description: 'Managed via ops endpoint' }, { onConflict: 'key' });

  if (error) {
    return json({ error: { code: 'update_failed', message: error.message } }, 500);
  }
  return json({ ok: true, key, value });
}

export default handleUpdateScheduler;
