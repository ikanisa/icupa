import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { getSupabaseServiceConfig } from "../_shared/env.ts";
import { sendWhatsAppMessage } from "../_shared/wa.ts";

const { url: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE_KEY } =
  getSupabaseServiceConfig({ feature: "notify.whatsapp" });

interface RouteSummary {
  origin: string;
  destination: string;
  departure_time?: string;
}

interface RouteAdvisory {
  code: string;
  audience: "traveler" | "ops" | "safety";
  headline: string;
  detail: string;
  actions: string[];
  effective_from?: string;
  effective_to?: string;
  tags: string[];
}

interface RouteWarning {
  code: string;
  severity: "info" | "watch" | "alert";
  summary: string;
  detail: string;
  tags: string[];
  advisories: RouteAdvisory[];
}

interface NotifyPayload {
  to?: unknown;
  session_id?: unknown;
  user_wa?: unknown;
  route?: unknown;
  warnings?: unknown;
  advisories?: unknown;
  request_id?: unknown;
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("notify.whatsapp");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  if (!authorize(req)) {
    return jsonResponse({ ok: false, error: "forbidden" }, 403);
  }

  let payload: NotifyPayload;
  try {
    payload = (await req.json()) as NotifyPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const to = typeof payload.to === "string" ? payload.to.trim() : "";
  const sessionId = typeof payload.session_id === "string"
    ? payload.session_id.trim()
    : undefined;
  const userWa = typeof payload.user_wa === "string"
    ? payload.user_wa.trim()
    : undefined;

  if (!to) {
    return jsonResponse({ ok: false, error: "to is required" }, 400);
  }

  const route = parseRoute(payload.route);
  let warnings = parseWarnings(payload.warnings);
  let advisories = parseAdvisories(payload.advisories);

  try {
    if (!warnings.length && route) {
      const fetched = await fetchRouteWarnings(route, requestId);
      warnings = fetched.warnings;
      advisories = fetched.advisories;
    }
  } catch (error) {
    console.warn(
      `notify.whatsapp warning fetch failed: ${String(error)}`,
    );
  }

  if (!warnings.length) {
    return jsonResponse(
      {
        ok: false,
        error: "warnings payload required",
      },
      400,
    );
  }

  const message = renderWarningMessage({
    route,
    warnings,
    advisories,
  });

  if (!message) {
    return jsonResponse({ ok: false, error: "failed to render message" }, 400);
  }

  const result = await sendWhatsAppMessage({
    to,
    text: message,
    sessionId,
    userWa,
    requestId,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    warnings: warnings.map((warning) => warning.code),
    message_id: result.message_id,
  });
}, { fn: "notify.whatsapp", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function authorize(req: Request): boolean {
  const apiKeyHeader = req.headers.get("apikey") ?? "";
  return apiKeyHeader === SERVICE_ROLE_KEY;
}

async function fetchRouteWarnings(
  route: RouteSummary,
  requestId: string,
): Promise<{ warnings: RouteWarning[]; advisories: RouteAdvisory[] }> {
  const url = `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/map-route`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "x-request-id": requestId,
    },
    body: JSON.stringify(route),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`map-route status ${response.status}: ${text}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  const routePayload = body.route as Record<string, unknown> | undefined;
  const warningDetails = Array.isArray(routePayload?.warning_details)
    ? (routePayload?.warning_details as RouteWarning[])
    : [];

  const advisories = Array.isArray(routePayload?.advisories)
    ? (routePayload?.advisories as RouteAdvisory[])
    : warningDetails.flatMap((warning) => warning.advisories ?? []);

  return { warnings: warningDetails, advisories };
}

function parseRoute(input: unknown): RouteSummary | null {
  if (!input || typeof input !== "object") return null;
  const payload = input as Record<string, unknown>;
  const origin = typeof payload.origin === "string" ? payload.origin.trim() : "";
  const destination = typeof payload.destination === "string"
    ? payload.destination.trim()
    : "";
  const departure = typeof payload.departure_time === "string"
    ? payload.departure_time.trim()
    : undefined;
  if (!origin || !destination) return null;
  return { origin, destination, departure_time: departure };
}

function parseWarnings(input: unknown): RouteWarning[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const code = typeof record.code === "string" ? record.code.trim() : "";
      const severity =
        record.severity === "info" ||
          record.severity === "watch" ||
          record.severity === "alert"
          ? (record.severity as RouteWarning["severity"])
          : "info";
      const summary = typeof record.summary === "string"
        ? record.summary.trim()
        : "";
      const detail = typeof record.detail === "string"
        ? record.detail.trim()
        : "";
      const tags = Array.isArray(record.tags)
        ? (record.tags as unknown[])
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(Boolean)
        : [];
      const advisories = parseAdvisories(record.advisories);
      if (!code || !summary || !detail) return null;
      return { code, severity, summary, detail, tags, advisories } satisfies RouteWarning;
    })
    .filter((entry): entry is RouteWarning => Boolean(entry));
}

function parseAdvisories(input: unknown): RouteAdvisory[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const code = typeof record.code === "string" ? record.code.trim() : "";
      const audience =
        record.audience === "traveler" ||
          record.audience === "ops" ||
          record.audience === "safety"
          ? (record.audience as RouteAdvisory["audience"])
          : "traveler";
      const headline = typeof record.headline === "string"
        ? record.headline.trim()
        : "";
      const detail = typeof record.detail === "string" ? record.detail.trim() : "";
      const actions = Array.isArray(record.actions)
        ? (record.actions as unknown[])
          .map((value) => (typeof value === "string" ? value.trim() : ""))
          .filter(Boolean)
        : [];
      const effectiveFrom = typeof record.effective_from === "string"
        ? record.effective_from.trim()
        : undefined;
      const effectiveTo = typeof record.effective_to === "string"
        ? record.effective_to.trim()
        : undefined;
      const tags = Array.isArray(record.tags)
        ? (record.tags as unknown[])
          .map((tag) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(Boolean)
        : [];
      if (!code || !headline || !detail) return null;
      return {
        code,
        audience,
        headline,
        detail,
        actions,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        tags,
      } satisfies RouteAdvisory;
    })
    .filter((entry): entry is RouteAdvisory => Boolean(entry));
}

function renderWarningMessage(input: {
  route: RouteSummary | null;
  warnings: RouteWarning[];
  advisories: RouteAdvisory[];
}): string {
  const header = input.route
    ? `⚠️ Safety update: ${input.route.origin} → ${input.route.destination}`
    : "⚠️ Safety update";

  const warningLines = input.warnings.map((warning) => {
    const severityLabel = warning.severity === "alert"
      ? "High"
      : warning.severity === "watch"
        ? "Medium"
        : "Info";
    const advisoryLines = warning.advisories
      .filter((advisory) => advisory.audience === "traveler")
      .flatMap((advisory) => {
        const actions = advisory.actions.length
          ? `\n    - ${advisory.actions.join("\n    - ")}`
          : "";
        return `  ${advisory.headline}: ${advisory.detail}${actions}`;
      });
    const joinedAdvisories = advisoryLines.length
      ? `\n${advisoryLines.join("\n")}`
      : "";
    return `• ${warning.summary} (${severityLabel})\n  ${warning.detail}${joinedAdvisories}`;
  });

  const opsAdvisories = input.advisories
    .filter((advisory) => advisory.audience !== "traveler")
    .map((advisory) => {
      const actions = advisory.actions.length
        ? `\n  - ${advisory.actions.join("\n  - ")}`
        : "";
      return `${advisory.headline}: ${advisory.detail}${actions}`;
    });

  const opsBlock = opsAdvisories.length
    ? `\n\nOps notes:\n${opsAdvisories.join("\n")}`
    : "";

  return `${header}\n${warningLines.join("\n\n")}${opsBlock}`.trim();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
