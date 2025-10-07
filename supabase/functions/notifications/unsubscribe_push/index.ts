import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Maybe<T> = T | null | undefined;

type UnsubscribeRequest = {
  subscription_id?: string;
  endpoint?: string;
};

interface SubscriptionRow {
  id: string;
  table_session_id: string | null;
  endpoint: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
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

function isUuid(value: Maybe<string>): value is string {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function extractSessionId(req: Request): string | null {
  const direct = req.headers.get("x-icupa-session");
  if (direct && direct.length > 0) {
    return direct;
  }
  const fallback = req.headers.get("x-ICUPA-session");
  if (fallback && fallback.length > 0) {
    return fallback;
  }
  return null;
}

export async function handleUnsubscribePush(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase configuration for notifications/unsubscribe_push");
    return errorResponse(500, "config_missing", "Server configuration incomplete");
  }

  const sessionId = extractSessionId(req);
  if (!sessionId) {
    return errorResponse(401, "missing_session", "x-icupa-session header is required");
  }

  if (!isUuid(sessionId)) {
    return errorResponse(400, "invalid_session", "x-icupa-session header must be a valid UUID");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  let body: UnsubscribeRequest;
  try {
    body = (await req.json()) as UnsubscribeRequest;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body could not be parsed");
  }

  const subscriptionId = body.subscription_id ?? null;
  const endpoint = body.endpoint ?? null;

  if (!subscriptionId && !endpoint) {
    return errorResponse(
      400,
      "missing_identifier",
      "Provide either subscription_id or endpoint to remove the subscription",
    );
  }

  if (subscriptionId && !isUuid(subscriptionId)) {
    return errorResponse(400, "invalid_subscription_id", "subscription_id must be a valid UUID");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let target: SubscriptionRow | null = null;

  if (subscriptionId) {
    const { data, error } = await supabase
      .from("notification_subscriptions")
      .select("id, table_session_id, endpoint")
      .eq("id", subscriptionId)
      .maybeSingle<SubscriptionRow>();

    if (error) {
      console.error("Failed to look up subscription by id", error, { subscriptionId });
      return errorResponse(500, "lookup_failed", "Could not load subscription");
    }

    target = data ?? null;
  } else if (endpoint) {
    const { data, error } = await supabase
      .from("notification_subscriptions")
      .select("id, table_session_id, endpoint")
      .eq("endpoint", endpoint)
      .maybeSingle<SubscriptionRow>();

    if (error) {
      console.error("Failed to look up subscription by endpoint", error, { endpoint });
      return errorResponse(500, "lookup_failed", "Could not load subscription");
    }

    target = data ?? null;
  }

  if (!target) {
    return errorResponse(404, "subscription_not_found", "No matching subscription");
  }

  if (target.table_session_id && target.table_session_id !== sessionId) {
    return errorResponse(403, "session_mismatch", "Subscription does not belong to this table session");
  }

  const { error: deleteError } = await supabase
    .from("notification_subscriptions")
    .delete()
    .eq("id", target.id);

  if (deleteError) {
    console.error("Failed to delete push subscription", deleteError, { subscriptionId: target.id });
    return errorResponse(500, "unsubscribe_failed", "Could not remove subscription");
  }

  return jsonResponse({ status: "deleted", subscription_id: target.id, endpoint: target.endpoint });
}

export default handleUnsubscribePush;
