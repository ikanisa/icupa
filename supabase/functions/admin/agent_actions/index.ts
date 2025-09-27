import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const ADMIN_TOKEN = Deno.env.get("ADMIN_SERVICE_TOKEN") ?? "";

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

function createServiceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase service credentials are not configured");
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

async function listPendingActions() {
  const client = createServiceClient();
  const { data, error } = await client
    .from("agent_action_queue")
    .select("id, tenant_id, location_id, agent_type, action_type, payload, rationale, status, created_at, approved_by, approved_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function applyAction(input: {
  actionId: string;
  decision: "approve" | "reject" | "apply";
  actorId?: string | null;
  notes?: string | null;
}) {
  const client = createServiceClient();
  const { data: action, error } = await client
    .from("agent_action_queue")
    .select("id, tenant_id, location_id, agent_type, action_type, payload, status")
    .eq("id", input.actionId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!action) {
    return { status: 404, body: { error: { code: "not_found", message: "Action not found" } } };
  }

  const now = new Date().toISOString();

  if (input.decision === "reject") {
    const { error: updateError } = await client
      .from("agent_action_queue")
      .update({ status: "rejected", approved_by: input.actorId ?? null, approved_at: now, notes: { message: input.notes ?? null } })
      .eq("id", action.id);

    if (updateError) {
      throw updateError;
    }

    return { status: 200, body: { status: "rejected" } };
  }

  if (input.decision === "approve") {
    const { error: updateError } = await client
      .from("agent_action_queue")
      .update({ status: "approved", approved_by: input.actorId ?? null, approved_at: now, notes: { message: input.notes ?? null } })
      .eq("id", action.id);

    if (updateError) {
      throw updateError;
    }

    return { status: 200, body: { status: "approved" } };
  }

  // apply decision -> execute underlying mutation atomically
  const payload = action.payload as Record<string, unknown>;
  if (action.action_type === "promo.update_campaign") {
    const campaignId = payload["campaign_id"] as string | undefined;
    if (!campaignId) {
      return { status: 400, body: { error: { code: "invalid_payload", message: "campaign_id missing" } } };
    }

    const updates: Record<string, unknown> = {};
    if (typeof payload["status"] === "string") {
      updates.status = payload["status"];
    }
    if (typeof payload["budget_delta_cents"] === "number") {
      const current = await client
        .from("promo_campaigns")
        .select("budget_cap_cents")
        .eq("id", campaignId)
        .maybeSingle();

      if (current.error) {
        throw current.error;
      }

      const existing = Number(current.data?.budget_cap_cents ?? 0);
      updates.budget_cap_cents = Math.max(0, existing + (payload["budget_delta_cents"] as number));
    }

    if (Object.keys(updates).length === 0) {
      return { status: 400, body: { error: { code: "no_updates", message: "No changes supplied" } } };
    }

    const { error: campaignError } = await client
      .from("promo_campaigns")
      .update(updates)
      .eq("id", campaignId);

    if (campaignError) {
      throw campaignError;
    }
  } else if (action.action_type === "inventory.adjust_level") {
    const inventoryId = payload["inventory_id"] as string | undefined;
    if (!inventoryId) {
      return { status: 400, body: { error: { code: "invalid_payload", message: "inventory_id missing" } } };
    }

    const updates: Record<string, unknown> = {};
    if (typeof payload["quantity"] === "number") {
      updates.quantity = payload["quantity"];
    }
    if (typeof payload["auto_86"] === "boolean") {
      updates.auto_86 = payload["auto_86"];
    }
    if (typeof payload["auto_86_level"] === "string") {
      updates.auto_86_level = payload["auto_86_level"];
    }

    if (Object.keys(updates).length === 0) {
      return { status: 400, body: { error: { code: "no_updates", message: "No inventory changes provided" } } };
    }

    const { error: inventoryError } = await client
      .from("inventory_items")
      .update(updates)
      .eq("id", inventoryId);

    if (inventoryError) {
      throw inventoryError;
    }
  } else {
    return { status: 400, body: { error: { code: 'unsupported_action', message: `Unsupported action type ${action.action_type}` } } };
  }

  const { error: queueUpdateError } = await client
    .from("agent_action_queue")
    .update({
      status: 'applied',
      approved_by: input.actorId ?? null,
      approved_at: now,
      applied_at: now,
      notes: { message: input.notes ?? null },
    })
    .eq("id", action.id);

  if (queueUpdateError) {
    throw queueUpdateError;
  }

  return { status: 200, body: { status: 'applied' } };
}

export async function handleAgentActions(req: Request): Promise<Response> {
  try {
    if (req.method === 'GET') {
      const actions = await listPendingActions();
      return jsonResponse({ actions });
    }

    if (req.method === 'POST') {
      if (!SUPABASE_SERVICE_ROLE_KEY) {
        return errorResponse(500, 'config_error', 'Service role key missing');
      }

      const token = req.headers.get('x-icupa-admin-token');
      if (ADMIN_TOKEN && token !== ADMIN_TOKEN) {
        return errorResponse(401, 'unauthorized', 'Invalid admin token');
      }

      const body = await req.json();
      const actionId = body?.action_id as string | undefined;
      const decision = body?.decision as 'approve' | 'reject' | 'apply' | undefined;
      const actorId = (body?.actor_id as string | undefined) ?? null;
      const notes = (body?.notes as string | undefined) ?? null;

      if (!actionId || !decision) {
        return errorResponse(400, 'invalid_request', 'action_id and decision are required');
      }

      const result = await applyAction({ actionId, decision, actorId, notes });
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    }

    return errorResponse(405, 'method_not_allowed', 'Only GET and POST are supported');
  } catch (error) {
    console.error('agent actions handler error', error);
    return errorResponse(500, 'internal_error', 'Unexpected error handling agent action');
  }
}

export default handleAgentActions;
