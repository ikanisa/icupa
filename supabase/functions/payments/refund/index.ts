import {
  createServiceRoleClient,
  errorResponse,
  jsonResponse,
  markPaymentFailed,
  markPaymentRefunded,
} from "../../_shared/payments.ts";

interface RefundRequestBody {
  action?: 'request' | 'approve' | 'reject' | 'void';
  payment_id?: string;
  refund_id?: string;
  amount_cents?: number;
  reason?: string;
  actor_id?: string;
}

const ADMIN_TOKEN = Deno.env.get('ADMIN_SERVICE_TOKEN') ?? '';

function requireAdmin(req: Request): boolean {
  if (!ADMIN_TOKEN) return true;
  return req.headers.get('x-icupa-admin-token') === ADMIN_TOKEN;
}

export async function handleRefund(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Only POST is supported');
  }

  let body: RefundRequestBody;
  try {
    body = (await req.json()) as RefundRequestBody;
  } catch (_error) {
    return errorResponse(400, 'invalid_json', 'Request body must be JSON');
  }

  const action = body.action ?? 'request';
  const client = createServiceRoleClient();

  if (action === 'request') {
    if (!body.payment_id) {
      return errorResponse(400, 'invalid_request', 'payment_id is required');
    }

    const paymentLookup = await client
      .from('payments')
      .select('id, currency, tenant_id, location_id')
      .eq('id', body.payment_id)
      .maybeSingle();

    if (paymentLookup.error) {
      console.error('Payment lookup failed', paymentLookup.error);
      return errorResponse(500, 'payment_lookup_failed', 'Unable to load payment for refund');
    }
    if (!paymentLookup.data) {
      return errorResponse(404, 'not_found', 'Payment not found');
    }

    const amount = typeof body.amount_cents === 'number' ? Math.max(0, Math.floor(body.amount_cents)) : Number(paymentLookup.data.amount_cents ?? 0);
    const { data, error } = await client
      .from('payment_refunds')
      .insert({
        payment_id: body.payment_id,
        tenant_id: paymentLookup.data.tenant_id ?? null,
        location_id: paymentLookup.data.location_id ?? null,
        amount_cents: amount,
        currency: paymentLookup.data.currency ?? 'RWF',
        reason: body.reason ?? null,
        requested_by: body.actor_id ?? null,
      })
      .select('id, status')
      .single();

    if (error) {
      console.error('Failed to create refund request', error);
      return errorResponse(500, 'refund_create_failed', 'Unable to create refund request');
    }

    return jsonResponse({ status: 'pending', refund_id: data.id }, 202);
  }

  if (!requireAdmin(req)) {
    return errorResponse(401, 'unauthorized', 'Admin token required');
  }

  if (!body.refund_id) {
    return errorResponse(400, 'invalid_request', 'refund_id is required for this action');
  }

  const { data: refundRow, error: fetchError } = await client
    .from('payment_refunds')
    .select('id, payment_id, status')
    .eq('id', body.refund_id)
    .maybeSingle();

  if (fetchError) {
    console.error('Refund fetch failed', fetchError);
    return errorResponse(500, 'refund_lookup_failed', 'Unable to load refund record');
  }
  if (!refundRow) {
    return errorResponse(404, 'not_found', 'Refund record not found');
  }

  if (action === 'reject') {
    const { error } = await client
      .from('payment_refunds')
      .update({ status: 'rejected', approved_by: body.actor_id ?? null, approved_at: new Date().toISOString(), metadata: { reason: body.reason ?? null } })
      .eq('id', refundRow.id);

    if (error) {
      console.error('Refund rejection failed', error);
      return errorResponse(500, 'refund_reject_failed', 'Failed to reject refund');
    }

    return jsonResponse({ status: 'rejected' });
  }

  if (action === 'void') {
    if (!refundRow.payment_id) {
      return errorResponse(400, 'invalid_request', 'payment_id missing from refund record');
    }

    await markPaymentFailed(client, refundRow.payment_id, body.reason ?? 'Payment voided by staff');

    const { error } = await client
      .from('payment_refunds')
      .update({ status: 'processed', processed_at: new Date().toISOString(), processed_by: body.actor_id ?? null })
      .eq('id', refundRow.id);

    if (error) {
      console.error('Refund void update failed', error);
      return errorResponse(500, 'refund_void_failed', 'Failed to record void');
    }

    return jsonResponse({ status: 'voided' });
  }

  if (action === 'approve') {
    if (!refundRow.payment_id) {
      return errorResponse(400, 'invalid_request', 'payment_id missing from refund record');
    }

    await markPaymentRefunded(client, {
      paymentId: refundRow.payment_id,
      refundAmountCents: body.amount_cents ?? undefined,
      reason: body.reason ?? 'Refund approved by staff',
    });

    const { error } = await client
      .from('payment_refunds')
      .update({
        status: 'processed',
        approved_by: body.actor_id ?? null,
        approved_at: new Date().toISOString(),
        processed_at: new Date().toISOString(),
      })
      .eq('id', refundRow.id);

    if (error) {
      console.error('Refund approve update failed', error);
      return errorResponse(500, 'refund_process_failed', 'Failed to mark refund as processed');
    }

    return jsonResponse({ status: 'processed' });
  }

  return errorResponse(400, 'invalid_action', 'Unsupported refund action');
}

export default handleRefund;
