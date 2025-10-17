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

export async function handleEnqueueTestReceipt(req: Request): Promise<Response> {
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

  let body: { order_id?: string; payment_id?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch (error) {
    console.warn('Failed to parse enqueue_test_receipt payload', error);
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  let orderId = body.order_id ?? null;
  let paymentId = body.payment_id ?? null;

  if (!orderId || !paymentId) {
    // Find a recent captured payment to enqueue for test
    const { data, error } = await sb
      .from('payments')
      .select('id, order_id, status, created_at')
      .eq('status', 'captured')
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) {
      return json({ error: { code: 'lookup_failed', message: error.message } }, 500);
    }
    if (!data || data.length === 0) {
      return json({ status: 'no_captured_payments' }, 204);
    }
    paymentId = data[0]!.id as string;
    orderId = data[0]!.order_id as string;
  }

  const { data: rpcData, error: rpcError } = await sb.rpc('enqueue_fiscalization_job', {
    order_uuid: orderId,
    payment_uuid: paymentId,
  });
  if (rpcError) {
    return json({ error: { code: 'enqueue_failed', message: rpcError.message } }, 500);
  }

  return json({ ok: true, msg_id: rpcData ?? null, order_id: orderId, payment_id: paymentId }, 202);
}

export default handleEnqueueTestReceipt;

