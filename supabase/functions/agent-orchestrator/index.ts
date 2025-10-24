import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import {
  AgentToolSpanTelemetryOptions,
  buildAgentToolSpanPayload,
} from "../_shared/agentObservability.ts";

interface ToolDefinition {
  key: string;
  description?: string;
  endpoint: string;
  method: string;
  auth?: string;
  requiredFields?: string[];
}

interface ConversationMessage {
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
}

interface ToolCallInput {
  key: string;
  input?: Record<string, unknown>;
}

interface RequestPayload {
  agent?: string;
  session_id?: string;
  user_id?: string;
  goal?: string;
  plan?: Record<string, unknown>;
  tool_call?: ToolCallInput;
  dry_run?: boolean;
  messages?: ConversationMessage[];
}

type ModerationAction = "allow" | "refuse" | "escalate";

interface ModerationCandidate {
  index: number;
  role: string;
  content: string;
  metadata?: Record<string, unknown>;
  hints: string[];
  flaggedReason?: string;
}

interface ModerationDecisionRecord {
  message_index: number;
  action: ModerationAction;
  category: string;
  reason?: string;
  matched?: Record<string, unknown>;
}

interface ModerationSummary {
  action: ModerationAction;
  category: string;
  decisions: ModerationDecisionRecord[];
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE") ??
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const EMBEDDED_REGISTRY: ToolDefinition[] = [
  {
    key: "quote.search",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/bff-quote",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["destination", "start_date", "end_date", "party"],
  },
  {
    key: "checkout.intent",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/bff-checkout",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["quote_id", "amount_cents", "currency", "idempotency_key"],
  },
  {
    key: "webhook.stripe",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/stripe-webhook",
    method: "POST",
    auth: "service_role",
  },
  {
    key: "ops.bookings",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/ops-bookings",
    method: "GET",
    auth: "service_role",
  },
  {
    key: "ops.exceptions",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/ops-exceptions",
    method: "GET",
    auth: "service_role",
  },
  {
    key: "ops.refund",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/ops-refund",
    method: "POST",
    auth: "service_role",
    requiredFields: ["itinerary_id", "amount_cents", "reason"],
  },
  {
    key: "groups.create_escrow",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-create-escrow",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["group_id", "target_cents", "min_members", "deadline"],
  },
  {
    key: "groups.join",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/groups-join",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["group_id"],
  },
  {
    key: "groups.contribute",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-contribute",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["escrow_id", "amount_cents", "currency"],
  },
  {
    key: "groups.payout_now",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-ops-payout-now",
    method: "POST",
    auth: "service_role",
    requiredFields: ["escrow_id"],
  },
  {
    key: "groups.payouts_report",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-payouts-report",
    method: "GET",
    auth: "service_role",
  },
  {
    key: "permits.request",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/permits-request",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["park", "visit_date", "pax_count"],
  },
  {
    key: "permits.ops_approve",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/permits-ops-approve",
    method: "POST",
    auth: "service_role",
    requiredFields: ["request_id"],
  },
  {
    key: "permits.ops_reject",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/permits-ops-reject",
    method: "POST",
    auth: "service_role",
    requiredFields: ["request_id", "note"],
  },
  {
    key: "map.route",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/map-route",
    method: "POST",
    auth: "service_role",
    requiredFields: ["origin", "destination"],
  },
  {
    key: "map.nearby",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/map-nearby",
    method: "POST",
    auth: "service_role",
    requiredFields: ["location", "category"],
  },
  {
    key: "notify.whatsapp_send",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/wa-send",
    method: "POST",
    auth: "service_role",
    requiredFields: ["to", "template"],
  },
  {
    key: "notify.whatsapp",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/notify-whatsapp",
    method: "POST",
    auth: "service_role",
    requiredFields: ["to"],
  },
  {
    key: "agent.log_goal",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/agent-log-goal",
    method: "POST",
    auth: "service_role",
  },
];

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase configuration for orchestrator");
}

const PROJECT_REF = extractProjectRef(SUPABASE_URL);
let TOOL_REGISTRY: Map<string, ToolDefinition> | null = null;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CANONICAL_TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  "quote.search": {
    key: "quote.search",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/bff-quote",
    method: "POST",
    auth: "user_jwt",
    requiredFields: [
      "destination",
      "start_date",
      "end_date",
      "party",
    ],
  },
  "checkout.intent": {
    key: "checkout.intent",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/bff-checkout",
    method: "POST",
    auth: "user_jwt",
    requiredFields: [
      "quote_id",
      "amount_cents",
      "currency",
      "idempotency_key",
    ],
  },
  "webhook.stripe": {
    key: "webhook.stripe",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/stripe-webhook",
    method: "POST",
    auth: "service_role",
  },
  "ops.bookings": {
    key: "ops.bookings",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/ops-bookings",
    method: "GET",
    auth: "service_role",
  },
  "ops.exceptions": {
    key: "ops.exceptions",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/ops-exceptions",
    method: "GET",
    auth: "service_role",
  },
  "ops.refund": {
    key: "ops.refund",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/ops-refund",
    method: "POST",
    auth: "service_role",
    requiredFields: ["itinerary_id", "amount_cents", "reason"],
  },
  "groups.create_escrow": {
    key: "groups.create_escrow",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-create-escrow",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["group_id", "target_cents", "min_members", "deadline"],
  },
  "groups.join": {
    key: "groups.join",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/groups-join",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["group_id"],
  },
  "groups.contribute": {
    key: "groups.contribute",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-contribute",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["escrow_id", "amount_cents", "currency"],
  },
  "groups.payout_now": {
    key: "groups.payout_now",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-ops-payout-now",
    method: "POST",
    auth: "service_role",
    requiredFields: ["escrow_id"],
  },
  "groups.payouts_report": {
    key: "groups.payouts_report",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-payouts-report",
    method: "GET",
    auth: "service_role",
  },
  "permits.request": {
    key: "permits.request",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/permits-request",
    method: "POST",
    auth: "user_jwt",
    requiredFields: ["park", "visit_date", "pax_count"],
  },
  "permits.ops_approve": {
    key: "permits.ops_approve",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/permits-ops-approve",
    method: "POST",
    auth: "service_role",
    requiredFields: ["request_id"],
  },
  "permits.ops_reject": {
    key: "permits.ops_reject",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/permits-ops-reject",
    method: "POST",
    auth: "service_role",
    requiredFields: ["request_id", "note"],
  },
  "agent.log_goal": {
    key: "agent.log_goal",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/agent-log-goal",
    method: "POST",
    auth: "service_role",
  },
  "inventory.search": {
    key: "inventory.search",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/inventory-search",
    method: "POST",
    auth: "anon",
    requiredFields: ["city", "check_in", "check_out", "pax"],
  },
  "inventory.quote": {
    key: "inventory.quote",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/inventory-quote",
    method: "POST",
    auth: "anon",
    requiredFields: [
      "supplier_hotel_id",
      "check_in",
      "check_out",
      "pax",
    ],
  },
  "inventory.hold": {
    key: "inventory.hold",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/inventory-hold",
    method: "POST",
    auth: "user_jwt",
    requiredFields: [
      "supplier_hotel_id",
      "plan_id",
      "check_in",
      "check_out",
      "pax",
      "idempotency_key",
    ],
  },
  "air.price.watch": {
    key: "air.price.watch",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/air-price-watch",
    method: "POST",
    auth: "user_jwt",
    requiredFields: [
      "origin",
      "destination",
      "departure_date",
      "seats",
      "cabin",
      "traveler_name",
      "contact_email",
    ],
  },
  "map.route": {
    key: "map.route",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/map-route",
    method: "POST",
    auth: "service_role",
    requiredFields: ["origin", "destination"],
  },
  "map.nearby": {
    key: "map.nearby",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/map-nearby",
    method: "POST",
    auth: "service_role",
    requiredFields: ["location", "category"],
  },
  "notify.whatsapp_send": {
    key: "notify.whatsapp_send",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/wa-send",
    method: "POST",
    auth: "service_role",
    requiredFields: ["to", "template"],
  },
  "notify.whatsapp": {
    key: "notify.whatsapp",
    endpoint: "https://{project_ref}.supabase.co/functions/v1/notify-whatsapp",
    method: "POST",
    auth: "service_role",
    requiredFields: ["to"],
  },
  "payout.now": {
    key: "payout.now",
    endpoint:
      "https://{project_ref}.supabase.co/functions/v1/groups-ops-payout-now",
    method: "POST",
    auth: "service_role",
    requiredFields: ["escrow_id"],
  },
};

const TOOL_ALLOWLIST = new Set(Object.keys(CANONICAL_TOOL_DEFINITIONS));

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("agent-orchestrator");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let payload: RequestPayload;
  try {
    payload = (await req.json()) as RequestPayload;
  } catch (_error) {
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const validationErrors: string[] = [];

  if (TOOL_REGISTRY === null) {
    try {
      TOOL_REGISTRY = await loadToolRegistry();
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `registry error: ${(error as Error).message}`,
      }, 500);
    }
  }

  const registry = TOOL_REGISTRY;

  const agentKey =
    typeof payload.agent === "string" && payload.agent.trim().length > 0
      ? payload.agent.trim()
      : "";
  if (!agentKey) {
    validationErrors.push("agent is required");
  }

  if (!payload.tool_call) {
    validationErrors.push("tool_call is required");
  }

  let toolDef: ToolDefinition | undefined;
  let toolInput: Record<string, unknown> | undefined;
  if (payload.tool_call) {
    if (
      typeof payload.tool_call.key !== "string" ||
      payload.tool_call.key.trim().length === 0
    ) {
      validationErrors.push("tool_call.key must be a non-empty string");
    } else {
      toolDef = registry.get(payload.tool_call.key.trim());
      if (!toolDef) {
        validationErrors.push(
          `tool ${payload.tool_call.key} is not registered`,
        );
      }
    }

    if (payload.tool_call.input !== undefined) {
      if (
        typeof payload.tool_call.input !== "object" ||
        payload.tool_call.input === null ||
        Array.isArray(payload.tool_call.input)
      ) {
        validationErrors.push(
          "tool_call.input must be an object when provided",
        );
      } else {
        toolInput = payload.tool_call.input as Record<string, unknown>;
      }
    } else {
      toolInput = {};
    }

    if (
      toolDef && toolDef.requiredFields && toolDef.requiredFields.length > 0
    ) {
      const missing = findMissingRequiredFields(
        toolDef.requiredFields,
        toolInput ?? {},
      );
      if (missing.length > 0) {
        validationErrors.push(
          `tool_call.input missing required fields: ${missing.join(", ")}`,
        );
      }
    }
  }

  const shortTermMessages: ConversationMessage[] = [];
  if (payload.messages !== undefined) {
    if (!Array.isArray(payload.messages)) {
      validationErrors.push("messages must be an array when provided");
    } else {
      for (const [index, message] of payload.messages.entries()) {
        if (!message || typeof message !== "object" || Array.isArray(message)) {
          validationErrors.push(`messages[${index}] must be an object`);
          continue;
        }

        const role = typeof message.role === "string"
          ? message.role.trim()
          : "";
        const content = typeof message.content === "string"
          ? message.content.trim()
          : "";

        if (!role) {
          validationErrors.push(`messages[${index}].role is required`);
        }
        if (!content) {
          validationErrors.push(`messages[${index}].content is required`);
        }

        if (
          message.metadata !== undefined &&
          (typeof message.metadata !== "object" || message.metadata === null ||
            Array.isArray(message.metadata))
        ) {
          validationErrors.push(
            `messages[${index}].metadata must be an object when provided`,
          );
        }

        if (role && content) {
          const normalized: ConversationMessage = {
            role,
            content,
          };
          if (
            message.metadata && typeof message.metadata === "object" &&
            !Array.isArray(message.metadata)
          ) {
            normalized.metadata = message.metadata as Record<string, unknown>;
          }
          shortTermMessages.push(normalized);
        }
      }
    }
  }

  if (payload.session_id && !UUID_REGEX.test(payload.session_id)) {
    validationErrors.push("session_id must be a UUID");
  }

  if (payload.user_id && !UUID_REGEX.test(payload.user_id)) {
    validationErrors.push("user_id must be a UUID");
  }

  if (
    payload.plan &&
    (typeof payload.plan !== "object" || Array.isArray(payload.plan))
  ) {
    validationErrors.push("plan must be an object when provided");
  }

  if (validationErrors.length > 0) {
    return jsonResponse({ ok: false, errors: validationErrors }, 400);
  }

  const dryRun = Boolean(payload.dry_run);
  let sessionId = payload.session_id ?? null;
  let moderationSummary: ModerationSummary | null = null;

  try {
    if (sessionId) {
      const session = await getSession(sessionId);
      if (!session) {
        return jsonResponse({ ok: false, error: "session not found" }, 404);
      }
    } else {
      const created = await createSession(payload.user_id ?? null, agentKey);
      sessionId = created.id;
    }
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: `session error: ${(error as Error).message}`,
    }, 500);
  }

  // Persist working plan if provided
  if (payload.plan) {
    try {
      const existingPlan = await fetchWorkingPlan(sessionId!);
      const mergedPlan = existingPlan
        ? deepMerge(existingPlan, payload.plan)
        : payload.plan;

      const optimizerInput = extractOptimizerInput(mergedPlan);
      if (optimizerInput) {
        const optimizerArtifacts = await runPlannerOptimizers(
          optimizerInput,
          requestId,
        );
        if (optimizerArtifacts) {
          const existingWhyRaw =
            (mergedPlan as Record<string, unknown>)["why_these_changes"];
          const existingWhy = Array.isArray(existingWhyRaw)
            ? (existingWhyRaw as unknown[])
              .filter((item) => typeof item === "string")
              .map((item) => item as string)
            : [];
          const mergedWhy = dedupeStrings([
            ...existingWhy,
            ...optimizerArtifacts.why,
          ]);
          if (mergedWhy.length > 0) {
            (mergedPlan as Record<string, unknown>)["why_these_changes"] =
              mergedWhy;
          }

          const existingOptimizerRaw =
            (mergedPlan as Record<string, unknown>)["optimizer"];
          const existingOptimizer =
            existingOptimizerRaw && typeof existingOptimizerRaw === "object" &&
              !Array.isArray(existingOptimizerRaw)
              ? (existingOptimizerRaw as Record<string, unknown>)
              : {};

          const optimizerPayload: Record<string, unknown> = {
            ...existingOptimizer,
            last_run_at: optimizerArtifacts.lastRunAt,
            source: optimizerArtifacts.source,
            conflicts: optimizerArtifacts.conflicts,
            day_balance: optimizerArtifacts.dayBalance,
            diff_summary: optimizerArtifacts.diffSummary,
            rationales: optimizerArtifacts.rationales,
          };

          if (optimizerArtifacts.before) {
            optimizerPayload.before = optimizerArtifacts.before;
          }
          if (optimizerArtifacts.after) {
            optimizerPayload.after = optimizerArtifacts.after;
          }

          (mergedPlan as Record<string, unknown>)["optimizer"] = optimizerPayload;
        }
      }

      await upsertWorkingPlan(sessionId!, mergedPlan);
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `plan error: ${(error as Error).message}`,
      }, 500);
    }
  }

  if (sessionId && shortTermMessages.length > 0) {
    try {
      await appendShortTermMessages(sessionId, agentKey, shortTermMessages);
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `memory error: ${(error as Error).message}`,
      }, 500);
    }
  }

  const riskyCandidates = extractRiskyModerationCandidates(shortTermMessages);
  if (riskyCandidates.length > 0) {
    try {
      moderationSummary = await requestModerationDecision(
        riskyCandidates,
        agentKey,
        requestId,
      );

      if (sessionId) {
        await insertEvent(
          sessionId,
          "AUDIT",
          "agent.moderation",
          createModerationAuditPayload(agentKey, riskyCandidates, moderationSummary),
        );
      }
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `moderation error: ${(error as Error).message}`,
      }, 502);
    }
  }

  if (moderationSummary && moderationSummary.action !== "allow") {
    const responsePayload: Record<string, unknown> = {
      ok: false,
      session_id: sessionId,
      next: "moderation_review",
      request_id: requestId,
      moderation: {
        action: moderationSummary.action,
        category: moderationSummary.category,
        decisions: moderationSummary.decisions.map((decision) => ({
          message_index: decision.message_index,
          action: decision.action,
          category: decision.category,
          reason: decision.reason,
        })),
      },
    };

    return jsonResponse(responsePayload, 200);
  }

  const toolRequestId = crypto.randomUUID();
  let plannedTool: Record<string, unknown> | undefined;
  let toolResult: Record<string, unknown> | undefined;

  if (toolDef && sessionId) {
    const resolvedEndpoint = toolDef.endpoint.replace(
      "{project_ref}",
      PROJECT_REF,
    );
    plannedTool = {
      key: toolDef.key,
      endpoint: resolvedEndpoint,
      method: toolDef.method.toUpperCase(),
    };

    if (!dryRun) {
      const spanStartMs = Date.now();
      try {
        toolResult = await executeTool(
          toolDef,
          resolvedEndpoint,
          toolInput ?? {},
          toolRequestId,
        );
        if (sessionId) {
          const spanDurationMs = Math.max(0, Date.now() - spanStartMs);
          const toolStatus = (toolResult as { status?: unknown }).status;
          const toolBody = (toolResult as { body?: unknown }).body;
          const spanStatus =
            typeof toolStatus === "number"
              ? toolStatus
              : Number(toolStatus ?? NaN);
          const spanOk = Number.isFinite(spanStatus)
            ? spanStatus >= 200 && spanStatus < 400
            : true;
          await emitToolSpanEvent(
            sessionId,
            {
              agentKey,
              toolKey: toolDef.key,
              requestId: toolRequestId,
              startMs: spanStartMs,
              durationMs: spanDurationMs,
              ok: spanOk,
              status: toolStatus,
              requestPayload: toolInput ?? {},
              responsePayload: toolBody,
              ...(spanOk
                ? {}
                : {
                    error: toolBody,
                  }),
            },
          );
        }
      } catch (error) {
        const spanDurationMs = Math.max(0, Date.now() - spanStartMs);
        if (sessionId) {
          await emitToolSpanEvent(
            sessionId,
            {
              agentKey,
              toolKey: toolDef.key,
              requestId: toolRequestId,
              startMs: spanStartMs,
              durationMs: spanDurationMs,
              ok: false,
              requestPayload: toolInput ?? {},
              error,
            },
          );
        }
        return jsonResponse({
          ok: false,
          error: `tool execution failed: ${(error as Error).message}`,
        }, 502);
      }
    }
  }

  let eventId: number | undefined;
  if (sessionId && toolDef) {
    try {
      const event = await insertEvent(sessionId, "AUDIT", "agent.tool_call", {
        agent: agentKey,
        tool: toolDef.key,
        requestId: toolRequestId,
        dryRun,
      });
      eventId = event.id;
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `event error: ${(error as Error).message}`,
      }, 500);
    }
  }

  const responsePayload: Record<string, unknown> = {
    ok: true,
    session_id: sessionId,
    next: "done",
  };

  responsePayload.request_id = requestId;

  if (eventId !== undefined) {
    responsePayload.event_id = eventId;
  }

  if (dryRun && plannedTool) {
    responsePayload.planned_tool = plannedTool;
  }

  if (!dryRun && toolResult) {
    responsePayload.tool_result = toolResult;
  }

  if (moderationSummary) {
    responsePayload.moderation = {
      action: moderationSummary.action,
      category: moderationSummary.category,
      decisions: moderationSummary.decisions.map((decision) => ({
        message_index: decision.message_index,
        action: decision.action,
        category: decision.category,
        reason: decision.reason,
      })),
    };
  }

  return jsonResponse(responsePayload, 200);
}, { fn: "agent-orchestrator", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

async function emitToolSpanEvent(
  sessionId: string,
  options: AgentToolSpanTelemetryOptions,
): Promise<void> {
  try {
    const payload = await buildAgentToolSpanPayload(options);
    await insertEvent(sessionId, "INFO", "agent.tool_span", payload);
  } catch (error) {
    console.error("agent.tool_span", {
      error,
      sessionId,
      tool: options.toolKey,
    });
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function extractProjectRef(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const [ref] = host.split(".");
    return ref;
  } catch (_error) {
    return url;
  }
}

async function loadToolRegistry(): Promise<Map<string, ToolDefinition>> {
  const candidates = [
    "../../../tools/registry.yaml",
    "./registry.yaml",
  ];

  let text = "";
  let found = false;
  for (const candidate of candidates) {
    try {
      const path = new URL(candidate, import.meta.url);
      text = await Deno.readTextFile(path);
      found = true;
      break;
    } catch (_error) {
      continue;
    }
  }

  if (!found) {
    const fallback = new Map<string, ToolDefinition>();
    for (const entry of EMBEDDED_REGISTRY) {
      fallback.set(entry.key, { ...entry });
    }
    fallback.clear();
    for (const [key, canonical] of Object.entries(
      CANONICAL_TOOL_DEFINITIONS,
    )) {
      fallback.set(key, { ...canonical });
    }
    sanitizeRegistryMapInPlace(fallback);
    return fallback;
  }

  const map = new Map<string, ToolDefinition>();
  const entryRegex = /- key:\s*([^\n]+)\n([\s\S]*?)(?=\n- key:|\n*$)/g;
  let match: RegExpExecArray | null;

  while ((match = entryRegex.exec(text)) !== null) {
    const key = match[1].trim();
    const block = match[2];
    if (!key) continue;

    const endpoint = extractScalar(block, "endpoint") ?? "";
    const method = (extractScalar(block, "method") ?? "POST").toUpperCase();
    const auth = extractScalar(block, "auth") ?? undefined;
    const requiredFields = extractRequired(block);

    if (!endpoint) continue;
    map.set(key, {
      key,
      endpoint,
      method,
      auth,
      requiredFields,
    });
  }

  if (map.size === 0) {
    throw new Error("tools/registry.yaml could not be parsed");
  }

  sanitizeRegistryMapInPlace(map);

  return map;
}

function extractScalar(block: string, field: string): string | null {
  const regex = new RegExp(`\\n\\s*${field}\\s*:\\s*([^\\n]+)`);
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

function extractRequired(block: string): string[] | undefined {
  const inlineRegex = /\n\s*required\s*:\s*\[([^\]]+)\]/;
  const inlineMatch = block.match(inlineRegex);
  if (inlineMatch) {
    const list = inlineMatch[1]
      .split(",")
      .map((item) => item.trim().replace(/^['\"]|['\"]$/g, ""))
      .filter((item) => item.length > 0);
    return list.length ? list : undefined;
  }

  const blockRegex =
    /\n\s*required\s*:\s*\n([\s\S]*?)(?=\n\s*[a-zA-Z]|\n\s*#|$)/;
  const blockMatch = block.match(blockRegex);
  if (blockMatch) {
    const lines = blockMatch[1]
      .split("\n")
      .map((line) => line.trim().replace(/^-\s*/, ""))
      .filter((line) => line.length > 0);
    return lines.length ? lines : undefined;
  }

  return undefined;
}

async function createSession(userId: string | null, agentKey: string) {
  const response = await callRpc("agent_create_session", {
    p_user: userId,
    p_agent: agentKey,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`create_session failed: ${text}`);
  }
  return await response.json();
}

async function getSession(sessionId: string) {
  const response = await callRpc("agent_get_session", { p_id: sessionId });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`get_session failed: ${text}`);
  }
  const data = await response.json();
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }
  return data ?? null;
}

async function fetchWorkingPlan(
  sessionId: string,
): Promise<Record<string, unknown> | null> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/agent_memory_view`);
  url.searchParams.set("session_id", `eq.${sessionId}`);
  url.searchParams.set("scope", "eq.working_plan");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: serviceHeaders(),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`fetch plan failed: ${text}`);
  }
  const rows = await response.json();
  if (Array.isArray(rows) && rows[0] && typeof rows[0].content === "object") {
    return rows[0].content as Record<string, unknown>;
  }
  return null;
}

async function upsertWorkingPlan(
  sessionId: string,
  plan: Record<string, unknown>,
) {
  const response = await callRpc("agent_upsert_memory", {
    p_session: sessionId,
    p_scope: "working_plan",
    p_content: plan,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`upsert plan failed: ${text}`);
  }
  await response.json();
}

async function insertEvent(
  sessionId: string,
  level: string,
  event: string,
  payload: Record<string, unknown>,
) {
  const response = await callRpc("agent_insert_event", {
    p_session: sessionId,
    p_level: level,
    p_event: event,
    p_payload: payload,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`insert event failed: ${text}`);
  }
  return await response.json();
}

async function appendShortTermMessages(
  sessionId: string,
  agentKey: string,
  messages: ConversationMessage[],
) {
  for (const message of messages) {
    const entry: Record<string, unknown> = {
      ts: new Date().toISOString(),
      agent: agentKey,
      role: message.role,
      content: message.content,
    };

    if (message.metadata) {
      entry.metadata = message.metadata;
    }

    const response = await callRpc("agent_append_memory", {
      p_session: sessionId,
      p_scope: "short_term",
      p_entry: entry,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`append short_term failed: ${text}`);
    }
    await response.json();
  }
}

function findMissingRequiredFields(
  required: string[],
  input: Record<string, unknown>,
): string[] {
  const missing: string[] = [];
  for (const field of required) {
    if (!hasValue(input, field)) {
      missing.push(field);
    }
  }
  return missing;
}

function hasValue(input: Record<string, unknown>, path: string): boolean {
  const segments = path.split(".");
  let current: unknown = input;
  for (const segment of segments) {
    if (
      typeof current !== "object" || current === null || Array.isArray(current)
    ) {
      return false;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current !== undefined && current !== null;
}

const RISK_FLAG_BOOLEAN_KEYS = new Set<string>([
  "flagged",
  "risk_flag",
  "moderation_flag",
  "unsafe",
  "blocked",
  "risky",
]);

const RISK_FLAG_STRING_VALUES = new Set<string>([
  "block",
  "blocked",
  "escalate",
  "refuse",
  "unsafe",
  "risky",
  "deny",
  "high",
  "critical",
]);

const RISK_HINT_KEYS = new Set<string>([
  "category",
  "categories",
  "subcategory",
  "label",
  "tag",
  "type",
  "policy",
  "classification",
  "threat",
  "abuse",
  "risk",
  "topic",
]);

const RISK_HINT_VALUES = new Set<string>([
  "threat",
  "violence",
  "harassment",
  "hate",
  "sexual",
  "child",
  "self-harm",
  "crisis",
  "illegal",
  "dangerous",
  "spam",
  "fraud",
  "misinformation",
  "safety",
]);

const RISK_REASON_KEYS = new Set<string>([
  "reason",
  "note",
  "explanation",
  "comment",
  "message",
]);

const RISK_SCORE_KEYS = new Set<string>([
  "score",
  "probability",
  "confidence",
  "likelihood",
]);

function extractRiskyModerationCandidates(
  messages: ConversationMessage[],
): ModerationCandidate[] {
  const candidates: ModerationCandidate[] = [];
  messages.forEach((message, index) => {
    if (!message.metadata) {
      return;
    }

    const signal = parseRiskMetadata(message.metadata);
    if (!signal.flagged) {
      return;
    }

    candidates.push({
      index,
      role: message.role,
      content: message.content,
      metadata: message.metadata,
      hints: signal.hints,
      flaggedReason: signal.reason,
    });
  });
  return candidates;
}

function parseRiskMetadata(metadata: Record<string, unknown>): {
  flagged: boolean;
  hints: string[];
  reason?: string;
} {
  const hints: string[] = [];
  let flagged = false;
  let reason: string | undefined;
  const stack: Record<string, unknown>[] = [metadata];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const [key, value] of Object.entries(current)) {
      const lowerKey = key.toLowerCase();
      if (typeof value === "boolean") {
        if (value && RISK_FLAG_BOOLEAN_KEYS.has(lowerKey)) {
          flagged = true;
        }
      } else if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) continue;
        const lowerValue = trimmed.toLowerCase();
        const numericValue = Number(trimmed);
        if (!Number.isNaN(numericValue) && RISK_SCORE_KEYS.has(lowerKey)) {
          if (numericValue >= 0.8) {
            flagged = true;
          }
        }
        if (RISK_FLAG_STRING_VALUES.has(lowerValue)) {
          flagged = true;
        }
        if (RISK_HINT_KEYS.has(lowerKey) || RISK_HINT_VALUES.has(lowerValue)) {
          hints.push(lowerValue);
        }
        if (!reason && RISK_REASON_KEYS.has(lowerKey)) {
          reason = trimmed;
        }
      } else if (typeof value === "number") {
        if (value >= 0.8 && RISK_SCORE_KEYS.has(lowerKey)) {
          flagged = true;
        }
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string" && item.trim()) {
            hints.push(item.trim().toLowerCase());
          } else if (
            item &&
            typeof item === "object" &&
            !Array.isArray(item)
          ) {
            stack.push(item as Record<string, unknown>);
          }
        }
      } else if (value && typeof value === "object") {
        stack.push(value as Record<string, unknown>);
      }
    }
  }

  const uniqueHints = Array.from(new Set(
    hints.filter((hint) => typeof hint === "string" && hint.length > 0),
  ));
  return { flagged, hints: uniqueHints, reason };
}

async function requestModerationDecision(
  candidates: ModerationCandidate[],
  agentKey: string,
  requestId: string,
): Promise<ModerationSummary> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/moderate`, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "content-type": "application/json",
      "x-request-id": requestId,
      "x-agent-key": agentKey,
    },
    body: JSON.stringify({
      agent: agentKey,
      request_id: requestId,
      messages: candidates.map((candidate) => ({
        role: candidate.role,
        content: candidate.content,
        metadata: candidate.metadata ?? {},
        hints: candidate.hints,
        flagged: true,
        flagged_reason: candidate.flaggedReason,
      })),
    }),
  });

  const text = await response.text();
  if (!response.ok) {
    const message = text || `moderate responded with ${response.status}`;
    throw new Error(message);
  }

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch (_error) {
    throw new Error("moderate returned invalid JSON");
  }

  return normalizeModerationResponse(parsed);
}

function normalizeModerationResponse(payload: unknown): ModerationSummary {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { action: "escalate", category: "unknown", decisions: [] };
  }

  const record = payload as Record<string, unknown>;
  const rawDecisions = Array.isArray(record.decisions)
    ? record.decisions
    : [];

  const decisions: ModerationDecisionRecord[] = [];
  for (const item of rawDecisions) {
    const normalized = normalizeModerationDecision(item);
    if (normalized) {
      decisions.push(normalized);
    }
  }

  return {
    action: ensureModerationAction(record.action),
    category: typeof record.category === "string" && record.category.trim()
      ? record.category
      : "unknown",
    decisions,
  };
}

function normalizeModerationDecision(
  decision: unknown,
): ModerationDecisionRecord | null {
  if (!decision || typeof decision !== "object" || Array.isArray(decision)) {
    return null;
  }

  const record = decision as Record<string, unknown>;
  const indexCandidate = record.message_index ?? record.index ?? record.position;
  const numericIndex = typeof indexCandidate === "number"
    ? indexCandidate
    : Number(indexCandidate);

  if (!Number.isFinite(numericIndex)) {
    return null;
  }

  const message_index = Math.max(0, Math.floor(Number(numericIndex)));
  const category = typeof record.category === "string" && record.category.trim()
    ? record.category
    : "unknown";
  const reason = typeof record.reason === "string" && record.reason.trim()
    ? record.reason
    : undefined;

  let matched: Record<string, unknown> | undefined;
  if (
    record.matched &&
    typeof record.matched === "object" &&
    record.matched !== null &&
    !Array.isArray(record.matched)
  ) {
    matched = record.matched as Record<string, unknown>;
  }

  return {
    message_index,
    action: ensureModerationAction(record.action),
    category,
    reason,
    matched,
  };
}

function ensureModerationAction(value: unknown): ModerationAction {
  if (value === "allow" || value === "refuse" || value === "escalate") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "allow" || normalized === "refuse") {
      return normalized as ModerationAction;
    }
    if (normalized === "escalate" || normalized === "review") {
      return "escalate";
    }
    if (normalized === "block" || normalized === "deny") {
      return "refuse";
    }
  }

  return "escalate";
}

function createModerationAuditPayload(
  agentKey: string,
  candidates: ModerationCandidate[],
  summary: ModerationSummary,
): Record<string, unknown> {
  return {
    agent: agentKey,
    source: "moderate",
    action: summary.action,
    category: summary.category,
    decisions: summary.decisions.map((decision) => ({
      message_index: decision.message_index,
      action: decision.action,
      category: decision.category,
      reason: decision.reason,
    })),
    flagged_messages: candidates.map((candidate) => ({
      message_index: candidate.index,
      role: candidate.role,
      hints: candidate.hints,
      excerpt: truncateForAudit(candidate.content),
    })),
  };
}

function truncateForAudit(text: string, limit = 160): string {
  if (text.length <= limit) {
    return text;
  }
  return `${text.slice(0, limit)}…`;
}

async function executeTool(
  tool: ToolDefinition,
  endpoint: string,
  input: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown>> {
  const method = tool.method.toUpperCase();
  const headers = serviceHeaders();
  headers["content-type"] = "application/json";
  headers["x-request-id"] = requestId;
  headers["x-agent-key"] = tool.key;

  let response: Response;
  if (method === "GET") {
    const url = new URL(endpoint);
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
    response = await fetch(url, {
      method,
      headers,
    });
  } else {
    response = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(input ?? {}),
    });
  }

  const rawText = await response.text();
  let parsedBody: unknown;
  try {
    parsedBody = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    parsedBody = rawText;
  }

  return {
    status: response.status,
    body: parsedBody,
  };
}

async function callRpc(name: string, body: Record<string, unknown>) {
  return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      ...serviceHeaders(),
      "content-type": "application/json",
      Prefer: "params=single-object",
    },
    body: JSON.stringify(body),
  });
}

function serviceHeaders(): Record<string, string> {
  return {
    apikey: SERVICE_ROLE_KEY!,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  };
}

async function runPlannerOptimizers(
  input: Record<string, unknown>,
  requestId: string,
): Promise<{
  why: string[];
  conflicts: unknown[];
  dayBalance: Record<string, unknown> | null;
  diffSummary: Record<string, unknown>[];
  rationales: string[];
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  source: string;
  lastRunAt: string;
} | null> {
  const [conflictRes, balanceRes] = await Promise.all([
    callOptimizerEndpoint("conflict-resolver", input, requestId),
    callOptimizerEndpoint("day-balancer", input, requestId),
  ]);

  if (!conflictRes && !balanceRes) {
    return null;
  }

  const lastRunAt = new Date().toISOString();
  const why: string[] = [];

  const conflicts = conflictRes && Array.isArray(conflictRes["conflicts"])
    ? (conflictRes["conflicts"] as unknown[])
    : [];
  for (const entry of conflicts) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const recommendation =
      typeof record.recommendation === "string"
        ? record.recommendation
        : null;
    const rationale =
      typeof record.rationale === "string" ? record.rationale : null;
    const id = typeof record.id === "string" ? record.id : "conflict";
    if (recommendation) {
      why.push(`Resolve ${id}: ${recommendation}`);
    } else if (rationale) {
      why.push(`Resolve ${id}: ${rationale}`);
    }
  }

  const rationales = balanceRes && Array.isArray(balanceRes["rationales"])
    ? (balanceRes["rationales"] as unknown[])
        .filter((item): item is string => typeof item === "string")
    : [];
  for (const note of rationales) {
    why.push(`Auto-balance: ${note}`);
  }

  const diffSummary = balanceRes && Array.isArray(balanceRes["diff_summary"])
    ? (balanceRes["diff_summary"] as Record<string, unknown>[])
    : [];

  const before =
    balanceRes && typeof balanceRes["before"] === "object" &&
      balanceRes["before"] !== null &&
      !Array.isArray(balanceRes["before"])
      ? (balanceRes["before"] as Record<string, unknown>)
      : undefined;
  const after =
    balanceRes && typeof balanceRes["after"] === "object" &&
      balanceRes["after"] !== null && !Array.isArray(balanceRes["after"])
      ? (balanceRes["after"] as Record<string, unknown>)
      : undefined;

  return {
    why,
    conflicts,
    dayBalance: after ?? null,
    diffSummary,
    rationales,
    before,
    after,
    source:
      (balanceRes && typeof balanceRes["source"] === "string" &&
        (balanceRes["source"] as string).length > 0)
        ? (balanceRes["source"] as string)
        : (conflictRes && typeof conflictRes["source"] === "string" &&
            (conflictRes["source"] as string).length > 0)
        ? (conflictRes["source"] as string)
        : "fixtures",
    lastRunAt,
  };
}

async function callOptimizerEndpoint(
  slug: "conflict-resolver" | "day-balancer",
  input: Record<string, unknown>,
  requestId: string,
): Promise<Record<string, unknown> | null> {
  const endpoint = `${SUPABASE_URL}/functions/v1/${slug}`;
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...serviceHeaders(),
        "content-type": "application/json",
        "x-request-id": requestId,
        "x-optimizer-slug": slug,
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(
        JSON.stringify({
          level: "WARN",
          event: "optimizer.endpoint.failure",
          fn: "agent-orchestrator",
          requestId,
          slug,
          status: response.status,
          error: errorText,
        }),
      );
      return null;
    }

    const raw = await response.text();
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch (error) {
    console.error(
      JSON.stringify({
        level: "ERROR",
        event: "optimizer.endpoint.error",
        fn: "agent-orchestrator",
        requestId,
        slug,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return null;
  }
}

function extractOptimizerInput(
  plan: Record<string, unknown>,
): Record<string, unknown> | null {
  if (!plan || typeof plan !== "object") {
    return null;
  }

  const candidateValue = (plan as Record<string, unknown>)["optimizer_input"];
  const candidate =
    candidateValue && typeof candidateValue === "object" &&
      candidateValue !== null && !Array.isArray(candidateValue)
      ? (candidateValue as Record<string, unknown>)
      : plan;

  if (!Array.isArray(candidate["days"]) || candidate["days"].length === 0) {
    return null;
  }
  if (!Array.isArray(candidate["anchors"])) {
    return null;
  }
  if (!Array.isArray(candidate["windows"])) {
    return null;
  }
  if (typeof candidate["max_drive_minutes"] !== "number") {
    return null;
  }
  if (typeof candidate["pace"] !== "string") {
    return null;
  }

  return {
    days: candidate["days"],
    anchors: candidate["anchors"],
    windows: candidate["windows"],
    max_drive_minutes: candidate["max_drive_minutes"],
    pace: candidate["pace"],
  };
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      results.push(value);
    }
  }
  return results;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof output[key] === "object" &&
      output[key] !== null &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(
        output[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      output[key] = value;
    }
  }
  return output;
}

function sanitizeRegistryMapInPlace(map: Map<string, ToolDefinition>): void {
  for (const key of Array.from(map.keys())) {
    if (!TOOL_ALLOWLIST.has(key)) {
      map.delete(key);
    }
  }

  for (const [key, canonical] of Object.entries(CANONICAL_TOOL_DEFINITIONS)) {
    const current = map.get(key);
    if (current) {
      map.set(key, {
        ...current,
        ...canonical,
        requiredFields: canonical.requiredFields ?? current.requiredFields,
      });
    } else {
      map.set(key, { ...canonical });
    }
  }
}
