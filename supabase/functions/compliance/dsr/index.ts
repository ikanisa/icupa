import { createServiceRoleClient, errorResponse, jsonResponse } from '../../_shared/payments.ts';

interface DsrRequestBody {
  type?: 'export' | 'delete';
  subject_user_id?: string;
  tenant_id?: string | null;
  rationale?: string | null;
  requested_by?: string | null;
}

const DSR_FUNCTION_TOKEN = Deno.env.get('DSR_FUNCTION_TOKEN') ?? '';

function isUuid(value: string | undefined | null): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function handleDsr(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(405, 'method_not_allowed', 'Only POST requests are supported');
  }

  if (!DSR_FUNCTION_TOKEN) {
    console.error('DSR_FUNCTION_TOKEN not configured');
    return errorResponse(500, 'config_error', 'DSR function misconfigured');
  }

  const token = req.headers.get('x-icupa-dsr-token');
  if (token !== DSR_FUNCTION_TOKEN) {
    return errorResponse(401, 'unauthorized', 'Invalid DSR token');
  }

  let body: DsrRequestBody;
  try {
    body = (await req.json()) as DsrRequestBody;
  } catch (_error) {
    return errorResponse(400, 'invalid_json', 'Request body must be JSON');
  }

  if (body.type !== 'export' && body.type !== 'delete') {
    return errorResponse(400, 'invalid_type', 'type must be "export" or "delete"');
  }

  if (!isUuid(body.subject_user_id)) {
    return errorResponse(400, 'invalid_subject', 'subject_user_id must be a valid UUID');
  }

  const client = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const insertResult = await client
    .from('dsr_requests')
    .insert({
      tenant_id: body.tenant_id ?? null,
      subject_user_id: body.subject_user_id,
      request_type: body.type,
      status: body.type === 'export' ? 'processing' : 'pending',
      requested_by: body.requested_by ?? null,
      rationale: body.rationale ?? null,
      payload: { source: 'edge_function', received_at: nowIso },
    })
    .select('id')
    .single();

  if (insertResult.error) {
    console.error('Failed to persist DSR request', insertResult.error);
    return errorResponse(500, 'dsr_persist_failed', 'Unable to record DSR request');
  }

  const requestId = insertResult.data.id as string;

  if (body.type === 'delete') {
    return jsonResponse({
      status: 'accepted',
      request_id: requestId,
      message: 'Deletion request recorded for back-office processing.',
    }, 202);
  }

  try {
    const [profile, orders, agentSessions, events, notifications] = await Promise.all([
      client
        .from('profiles')
        .select('*')
        .eq('user_id', body.subject_user_id!)
        .maybeSingle(),
      client
        .from('orders')
        .select('*')
        .eq('customer_id', body.subject_user_id!),
      client
        .from('agent_sessions')
        .select('*')
        .eq('user_id', body.subject_user_id!),
      client
        .from('events')
        .select('*')
        .eq('table_session_id', null)
        .order('created_at', { ascending: false })
        .limit(200),
      client
        .from('notification_subscriptions')
        .select('*')
        .eq('profile_id', body.subject_user_id!),
    ]);

    const exportPayload = {
      request_id: requestId,
      generated_at: nowIso,
      profile: profile.data ?? null,
      orders: orders.data ?? [],
      agent_sessions: agentSessions.data ?? [],
      events: events.data?.filter((event) => {
        const payload = event.payload as Record<string, unknown> | null;
        return payload?.user_id === body.subject_user_id;
      }) ?? [],
      notification_subscriptions: notifications.data ?? [],
    };

    await client
      .from('dsr_requests')
      .update({ status: 'completed', processed_at: nowIso, payload: exportPayload })
      .eq('id', requestId);

    return jsonResponse({ status: 'completed', data: exportPayload });
  } catch (error) {
    console.error('DSR export failed', error);
    await client
      .from('dsr_requests')
      .update({ status: 'failed', processed_at: nowIso, payload: { error: String(error) } })
      .eq('id', requestId);

    return errorResponse(500, 'export_failed', 'Failed to assemble DSR export payload');
  }
}

export default handleDsr;
