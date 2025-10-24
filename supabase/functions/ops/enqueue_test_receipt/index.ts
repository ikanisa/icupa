import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { ReceiptContextInput, RegionCode } from "../../_shared/receipts.ts";
import { simulateMaltaReceipt, simulateRwandaReceipt } from "../../_shared/receipts.ts";

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
  } catch {
    body = {};
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
  if (!rpcError) {
    return json({ ok: true, msg_id: rpcData ?? null, order_id: orderId, payment_id: paymentId }, 202);
  }

  // Fallback: directly simulate receipt issuance when queue backend is unavailable
  const msg = (rpcError.message || '').toLowerCase();
  if (!(msg.includes('pgmq') || msg.includes('does not exist') || msg.includes('function'))) {
    return json({ error: { code: 'enqueue_failed', message: rpcError.message } }, 500);
  }

  // Load order/location/payment context
  const { data: order, error: orderErr } = await sb
    .from('orders')
    .select('id, tenant_id, location_id, table_session_id, subtotal_cents, tax_cents, service_cents, total_cents, currency')
    .eq('id', orderId!)
    .maybeSingle();
  if (orderErr || !order) return json({ error: { code: 'order_not_found', message: orderErr?.message || 'order missing' } }, 404);

  const { data: location, error: locErr } = await sb
    .from('locations')
    .select('id, tenant_id, region')
    .eq('id', order.location_id)
    .maybeSingle();
  if (locErr || !location) return json({ error: { code: 'location_not_found', message: locErr?.message || 'location missing' } }, 404);

  const { data: payment, error: payErr } = await sb
    .from('payments')
    .select('id, provider_ref')
    .eq('id', paymentId!)
    .maybeSingle();
  if (payErr || !payment) return json({ error: { code: 'payment_not_found', message: payErr?.message || 'payment missing' } }, 404);

  const { data: orderItems, error: itemsErr } = await sb
    .from('order_items')
    .select('quantity, unit_price_cents, items(name)')
    .eq('order_id', orderId!)
    .returns<any[]>();
  if (itemsErr) return json({ error: { code: 'items_lookup_failed', message: itemsErr.message } }, 500);

  const normalizeRegion = (value: string | null | undefined): RegionCode => (value?.toUpperCase() === 'RW' ? 'RW' : 'EU');
  const mapLineItems = (rows: any[]) => rows.map((row) => ({
    name: row.items?.name ?? 'Menu item',
    quantity: Math.max(1, Math.floor(row.quantity ?? 1)),
    unitPriceCents: Math.max(0, Math.floor(row.unit_price_cents ?? 0)),
  }));

  const region = normalizeRegion(location.region ?? null);
  const context: ReceiptContextInput = {
    orderId: order.id,
    paymentId: payment.id,
    tenantId: location.tenant_id ?? order.tenant_id,
    locationId: order.location_id,
    currency: order.currency ?? 'RWF',
    subtotalCents: Math.max(0, Math.floor(order.subtotal_cents ?? 0)),
    taxCents: Math.max(0, Math.floor(order.tax_cents ?? 0)),
    serviceCents: Math.max(0, Math.floor(order.service_cents ?? 0)),
    totalCents: Math.max(0, Math.floor(order.total_cents ?? 0)),
    providerRef: payment.provider_ref,
    region,
    lineItems: mapLineItems(orderItems ?? []),
  };

  const receiptResult = region === 'RW' ? simulateRwandaReceipt(context) : simulateMaltaReceipt(context);
  const { data: receiptInsert, error: receiptErr } = await sb
    .from('receipts')
    .insert({
      order_id: order.id,
      region,
      fiscal_id: receiptResult.summary.fiscalId,
      url: receiptResult.summary.url,
      payload: { summary: receiptResult.summary, integration_notes: receiptResult.integrationNotes, raw: receiptResult.payload },
    })
    .select('id')
    .single();
  if (receiptErr) return json({ error: { code: 'receipt_persist_failed', message: receiptErr.message } }, 500);

  await sb.from('events').insert({
    tenant_id: order.tenant_id,
    location_id: order.location_id,
    table_session_id: order.table_session_id,
    type: 'receipt_issued',
    payload: {
      receipt_id: receiptInsert.id,
      order_id: order.id,
      payment_id: payment.id,
      fiscal_id: receiptResult.summary.fiscalId,
      region,
      url: receiptResult.summary.url,
    },
  });

  return json({ ok: true, status: 'simulated', receipt_id: receiptInsert.id, order_id: order.id, payment_id: payment.id }, 201);
}

export default handleEnqueueTestReceipt;
