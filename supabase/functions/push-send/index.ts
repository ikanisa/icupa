import deliveryLogFixture from "../../../ops/fixtures/notification_delivery_logs.json" assert { type: "json" };
import subscriptionsFixture from "../../../ops/fixtures/push_subscriptions.json" assert { type: "json" };
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";

interface PushRequestBody {
  title?: unknown;
  body?: unknown;
  audience?: unknown;
  data?: unknown;
  dry_run?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("push-send");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405);
  }

  let payload: PushRequestBody;
  try {
    payload = (await req.json()) as PushRequestBody;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "invalid_json" }, 400);
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const dryRun = payload.dry_run === true;
  const audienceTags = normalizeAudience(payload.audience);
  const data = typeof payload.data === "object" && payload.data !== null ? payload.data : undefined;

  if (!title || !body) {
    return jsonResponse({ ok: false, error: "title_body_required" }, 422);
  }

  const deliveries = buildMockDeliveries({ audienceTags, dryRun, requestId, title, body });

  console.log(
    JSON.stringify({
      level: "INFO",
      event: "notify.push.send",
      fn: "push-send",
      requestId,
      title,
      audienceTags,
      dryRun,
      deliveries: deliveries.map((delivery) => ({ subscriptionId: delivery.subscription_id, status: delivery.status })),
    }),
  );

  return jsonResponse({
    ok: true,
    request_id: requestId,
    deliveries,
    dry_run: dryRun,
    meta: { title, body, audienceTags, data },
  });
}, { fn: "push-send" });

Deno.serve(handler);

type Delivery = {
  subscription_id: string;
  endpoint: string;
  status: "delivered" | "failed" | "skipped";
  latency_ms: number;
  error?: string;
};

type BuildArgs = {
  audienceTags: string[];
  dryRun: boolean;
  requestId: string;
  title: string;
  body: string;
};

function buildMockDeliveries({ audienceTags, dryRun }: BuildArgs): Delivery[] {
  const source = Array.isArray(deliveryLogFixture) ? (deliveryLogFixture as Array<Record<string, unknown>>) : [];
  const available = Array.isArray(subscriptionsFixture) ? (subscriptionsFixture as Array<Record<string, unknown>>) : [];

  const filteredSubscriptions = audienceTags.length === 0
    ? available
    : available.filter((entry) => {
      const tags = Array.isArray(entry.tags) ? entry.tags : [];
      return audienceTags.some((tag) => tags.includes(tag));
    });

  if (dryRun) {
    return filteredSubscriptions.map((subscription) => ({
      subscription_id: typeof subscription.id === "string" ? subscription.id : crypto.randomUUID(),
      endpoint: typeof subscription.endpoint === "string" ? subscription.endpoint : "mock-endpoint",
      status: "skipped" as const,
      latency_ms: 0,
    }));
  }

  const fallback = source.length > 0 ? source : available.map((subscription) => ({
    id: crypto.randomUUID(),
    subscription_id: subscription.id,
    endpoint: subscription.endpoint,
    status: "delivered",
    latency_ms: 800,
  }));

  return filteredSubscriptions.map((subscription) => {
    const match = fallback.find((entry) => entry.subscription_id === subscription.id);
    if (match) {
      return {
        subscription_id: String(match.subscription_id ?? subscription.id ?? crypto.randomUUID()),
        endpoint: String(match.endpoint ?? subscription.endpoint ?? "mock-endpoint"),
        status: (match.status === "failed" ? "failed" : "delivered") as Delivery["status"],
        latency_ms: Number(match.latency_ms ?? 1200),
        error: match.error ? String(match.error) : undefined,
      };
    }

    return {
      subscription_id: typeof subscription.id === "string" ? subscription.id : crypto.randomUUID(),
      endpoint: typeof subscription.endpoint === "string" ? subscription.endpoint : "mock-endpoint",
      status: "delivered" as const,
      latency_ms: 1200,
    };
  });
}

function normalizeAudience(value: unknown): string[] {
  if (typeof value === "string") {
    return value.split(",").map((entry) => entry.trim().toLowerCase()).filter((entry) => entry.length > 0);
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
      .filter((entry) => entry.length > 0)
      .slice(0, 10);
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (Array.isArray(record.tags)) {
      return record.tags
        .map((entry) => (typeof entry === "string" ? entry.trim().toLowerCase() : ""))
        .filter((entry) => entry.length > 0)
        .slice(0, 10);
    }
  }
  return [];
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
