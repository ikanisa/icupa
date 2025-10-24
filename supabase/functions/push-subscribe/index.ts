import subscriptionsFixture from "../../../ops/fixtures/push_subscriptions.json" assert { type: "json" };
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const MODE = (Deno.env.get("PUSH_SUBSCRIBE_MODE") ?? "mock").toLowerCase();

interface IncomingSubscription {
  endpoint?: unknown;
  keys?: unknown;
  tags?: unknown;
  metadata?: unknown;
  profile_id?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("push-subscribe");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: IncomingSubscription;
  try {
    payload = (await req.json()) as IncomingSubscription;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const endpoint = typeof payload.endpoint === "string" ? payload.endpoint.trim() : "";
  const keys = normalizeKeys(payload.keys);
  const tags = normalizeTags(payload.tags);
  const profileId = typeof payload.profile_id === "string" && payload.profile_id ? payload.profile_id : null;

  if (!endpoint || !endpoint.startsWith("http")) {
    return jsonResponse({ ok: false, error: "endpoint_required" }, 422);
  }
  if (!keys) {
    return jsonResponse({ ok: false, error: "keys_required" }, 422);
  }

  const subscriptionId = await storeSubscription({ endpoint, keys, tags, profileId, requestId });

  const response = {
    ok: true,
    subscription_id: subscriptionId,
    tags,
    request_id: requestId,
    mode: MODE,
  } as const;

  console.log(
    JSON.stringify({
      level: "INFO",
      event: "notify.push.subscribe",
      fn: "push-subscribe",
      requestId,
      endpoint,
      subscriptionId,
      tags,
      mode: MODE,
    }),
  );

  return jsonResponse(response);
}, { fn: "push-subscribe" });

Deno.serve(handler);

type NormalizedKeys = { p256dh: string; auth: string };

type StoreArgs = {
  endpoint: string;
  keys: NormalizedKeys;
  tags: string[];
  profileId: string | null;
  requestId: string;
};

async function storeSubscription({ endpoint, keys, tags, profileId, requestId }: StoreArgs) {
  if (MODE === "live" && SUPABASE_URL && SERVICE_ROLE_KEY) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/notify.subscriptions`, {
      method: "POST",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates", // allow upsert by endpoint
      },
      body: JSON.stringify({
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        tags,
        profile_id: profileId,
        last_seen_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("notify.push.subscribe.supabase_error", { requestId, status: response.status, text });
      return deriveMockSubscriptionId(endpoint);
    }

    try {
      const payload = (await response.json()) as Array<{ id?: string }>;
      const row = Array.isArray(payload) ? payload[0] : undefined;
      return (row?.id && typeof row.id === "string" ? row.id : deriveMockSubscriptionId(endpoint));
    } catch (_error) {
      return deriveMockSubscriptionId(endpoint);
    }
  }

  return deriveMockSubscriptionId(endpoint);
}

function normalizeKeys(value: unknown): NormalizedKeys | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const p256dh = typeof record.p256dh === "string" ? record.p256dh.trim() : "";
  const auth = typeof record.auth === "string" ? record.auth.trim() : "";
  if (!p256dh || !auth) return null;
  return { p256dh, auth };
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
    .filter((entry) => entry.length > 0)
    .slice(0, 10);
}

function deriveMockSubscriptionId(endpoint: string): string {
  const fixtureMatch = (subscriptionsFixture as Array<Record<string, unknown>>).find(
    (entry) => typeof entry.endpoint === "string" && entry.endpoint === endpoint,
  );
  if (fixtureMatch && typeof fixtureMatch.id === "string") {
    return fixtureMatch.id;
  }
  return crypto.randomUUID();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
