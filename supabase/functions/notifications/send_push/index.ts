import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type Maybe<T> = T | null | undefined;

type SendPushRequest = {
  subscription_id?: string;
  endpoint?: string;
  payload?: {
    title?: string;
    body?: string;
    data?: Record<string, unknown>;
    icon?: string;
    badge?: string;
    tag?: string;
  };
  dry_run?: boolean;
};

interface SubscriptionRow {
  id: string;
  endpoint: string;
  subscription: Record<string, unknown>;
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

serve(async (req) => {
  if (req.method !== "POST") {
    return errorResponse(405, "method_not_allowed", "Only POST requests are supported");
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase configuration for notifications/send_push");
    return errorResponse(500, "config_missing", "Server configuration incomplete");
  }

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return errorResponse(415, "unsupported_media_type", "Expected JSON payload");
  }

  let body: SendPushRequest;
  try {
    body = (await req.json()) as SendPushRequest;
  } catch (_error) {
    return errorResponse(400, "invalid_json", "Request body could not be parsed");
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const subscriptionId = body.subscription_id ?? null;
  const endpointFromBody = body.endpoint ?? null;

  let target: SubscriptionRow | null = null;
  if (subscriptionId) {
    if (!isUuid(subscriptionId)) {
      return errorResponse(400, "invalid_subscription_id", "subscription_id must be a valid UUID");
    }
    const { data, error } = await supabase
      .from("notification_subscriptions")
      .select("id, endpoint, subscription")
      .eq("id", subscriptionId)
      .maybeSingle<SubscriptionRow>();
    if (error) {
      console.error("Failed to load subscription for send_push", error, { subscriptionId });
      return errorResponse(500, "lookup_failed", "Could not load subscription");
    }
    target = data ?? null;
  } else if (endpointFromBody) {
    const { data, error } = await supabase
      .from("notification_subscriptions")
      .select("id, endpoint, subscription")
      .eq("endpoint", endpointFromBody)
      .maybeSingle<SubscriptionRow>();
    if (error) {
      console.error("Failed to load subscription by endpoint for send_push", error, { endpoint: endpointFromBody });
      return errorResponse(500, "lookup_failed", "Could not load subscription");
    }
    target = data ?? null;
  }

  if (!target) {
    return errorResponse(404, "subscription_not_found", "No matching subscription");
  }

  const payload = body.payload ?? {};
  const delivery = {
    title: payload.title ?? "ICUPA update",
    body: payload.body ?? "Tap to view the latest activity for your table.",
    icon: payload.icon ?? "/placeholder.svg",
    badge: payload.badge ?? "/placeholder.svg",
    tag: payload.tag ?? "icupa-generic",
    data: payload.data ?? {},
  };

  const dryRun = body.dry_run ?? false;

  console.info("notifications/send_push stub invoked", {
    subscriptionId: target.id,
    endpoint: target.endpoint,
    dryRun,
    payload: delivery,
  });

  return jsonResponse(
    {
      status: dryRun ? "validated" : "queued",
      subscription_id: target.id,
      endpoint: target.endpoint,
      payload: delivery,
      note: "This is a stub implementation. Wire a push gateway to deliver notifications.",
    },
    202,
  );
});
