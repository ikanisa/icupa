import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import {
  isAutonomyCategory,
  isAutonomyLevel,
  isComposerDial,
  rankAutonomyLevel,
  type AutonomyCategory,
  type AutonomyLevel,
  type ComposerDial,
} from "../_shared/autonomy.ts";
import autonomyFixtures from "../../../ops/fixtures/user_autonomy_prefs.json" assert {
  type: "json",
};

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

interface RouterToolSelection {
  key?: string;
  input?: Record<string, unknown>;
  policy_ref?: string;
  autonomy_floor?: number;
  require_license?: boolean;
}

interface RouterSelection {
  router_id?: string;
  router_version?: string;
  target_agent?: string;
  reason?: string;
  tool?: RouterToolSelection;
  service_tools?: RouterToolSelection[];
  metadata?: Record<string, unknown>;
}

interface RequestPayload {
  router_selection?: RouterSelection;
  router_trace_id?: string;
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

const AUTONOMY_PREFS_FIXTURES = Deno.env.get("AUTONOMY_PREFS_FIXTURES") === "1";
const AUTONOMY_PREFS_CACHE_TTL_MS = Number(
  Deno.env.get("AUTONOMY_PREFS_CACHE_MS") ?? "60000",
);
const AUTONOMY_DEFAULT_LEVEL: AutonomyLevel = "L1";
const AUTONOMY_DEFAULT_COMPOSER: ComposerDial = "assist";
const AUTONOMY_MIN_EXECUTION_LEVEL = 2;

type RouterToolPolicy = {
  key: string;
  policy_id?: string;
  autonomy_floor?: number;
  require_license?: boolean;
  metadata?: Record<string, unknown> | null;
};

type RouterAgentProfile = {
  router_id: string;
  router_version?: string | null;
  target_agent: string;
  allowed_tools: string[];
  tool_policies: RouterToolPolicy[];
  policy_ref?: string | null;
  metadata?: Record<string, unknown> | null;
  active: boolean;
};

type RouterServiceToolContext = {
  key: string;
  policyRef?: string;
  policyAutonomyFloor?: number;
  policyRequireLicense?: boolean;
  policyMetadata?: Record<string, unknown> | null;
  input?: Record<string, unknown> | null;
};

type RouterNormalizationContext = {
  routerId: string;
  routerVersion?: string;
  targetAgent: string;
  allowedTools: string[];
  toolKey?: string;
  reason?: string;
  policyRef?: string;
  policyAutonomyFloor?: number;
  policyRequireLicense?: boolean;
  policyMetadata?: Record<string, unknown> | null;
  serviceTools?: RouterServiceToolContext[];
  traceId?: string;
};

type RouterNormalizationResult = {
  agentKey?: string;
  toolCall?: ToolCallInput;
  errors: string[];
  context: RouterNormalizationContext | null;
  auditPayload?: Record<string, unknown> | null;
};

type ComplianceSentinelResult = {
  status: "clear" | "warn" | "block";
  warnings: string[];
  violations: string[];
  licence_detected?: string | null;
  triggers: string[];
  policy_ref?: string;
  router_id?: string;
  router_version?: string;
  tool_key?: string;
};

const HIGH_RISK_TOOLS = new Set<string>([
  "checkout.intent",
  "ops.refund",
  "groups.contribute",
  "groups.create_escrow",
  "groups.payout_now",
  "permits.ops_approve",
  "permits.ops_reject",
  "webhook.stripe",
]);

const AGENT_AUTONOMY_CATEGORY: Record<string, AutonomyCategory> = {
  PlannerCoPilot: "planner",
  ConciergeGuide: "concierge",
  GroupBuilder: "planner",
  SupportCopilot: "support",
  SupplierOpsAgent: "ops",
  FinOpsAgent: "ops",
  ContentMarketingAgent: "marketing",
};

type StoredAutonomyPreference = {
  level: AutonomyLevel;
  composer: ComposerDial;
  updatedAt?: string;
  source: "db" | "fixtures";
};

type AutonomyGateResult = {
  allowed: boolean;
  category: AutonomyCategory;
  level: AutonomyLevel;
  composer: ComposerDial;
  source: "db" | "fixtures" | "default";
  requiredLevel: number;
};

const AUTONOMY_PREF_CACHE = new Map<
  string,
  { expiresAt: number; prefs: Map<AutonomyCategory, StoredAutonomyPreference> }
>();

const ROUTER_CONFIG_CACHE_TTL_MS = Number(
  Deno.env.get("ROUTER_CONFIG_CACHE_MS") ?? "45000",
);
const ROUTER_CONFIG_CACHE = new Map<
  string,
  { expiresAt: number; profiles: RouterAgentProfile[] }
>();

const LICENCE_FIELD_PATHS = [
  "license_id",
  "licence_id",
  "compliance.license_id",
  "compliance.licence_id",
  "operator.licence_id",
  "operator.license_id",
  "policy.licence_id",
  "policy.license_id",
  "metadata.licence",
  "metadata.license",
  "regulatory.licence",
  "regulatory.license",
  "licence_number",
  "license_number",
];

const LICENSE_REQUIRED_TOOLS = new Set<string>([
  "checkout.intent",
  "inventory.hold",
  "permits.request",
  "groups.create_escrow",
  "groups.payout_now",
]);

const PACKAGE_TRAVEL_TOOLS = new Set<string>([
  "checkout.intent",
  "inventory.hold",
  "permits.request",
  "groups.create_escrow",
]);

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

  let routerContext: RouterNormalizationContext | null = null;
  let routerAuditPayload: Record<string, unknown> | null = null;
  try {
    const routerNormalization = await resolveRouterSelection(
      payload,
      registry,
      requestId,
    );
    if (routerNormalization.errors.length > 0) {
      validationErrors.push(...routerNormalization.errors);
    }
    if (routerNormalization.agentKey) {
      payload.agent = routerNormalization.agentKey;
    }
    if (routerNormalization.toolCall) {
      payload.tool_call = routerNormalization.toolCall;
    }
    routerContext = routerNormalization.context;
    routerAuditPayload = routerNormalization.auditPayload ?? null;
  } catch (error) {
    validationErrors.push(
      `router_selection error: ${(error as Error).message}`,
    );
  }

  const agentKey =
    typeof payload.agent === "string" && payload.agent.trim().length > 0
      ? payload.agent.trim()
      : "";
  const autonomyCategory = resolveAutonomyCategory(agentKey);
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
  const moderationSummary: ModerationSummary | null = null;
  let routerEventId: number | undefined;

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

  if (sessionId && routerAuditPayload) {
    try {
      const routerEvent = await insertEvent(
        sessionId,
        "AUDIT",
        "agent.router_selection",
        {
          agent: agentKey,
          selection: routerAuditPayload,
        },
      );
      routerEventId = routerEvent.id;
    } catch (error) {
      return jsonResponse({
        ok: false,
        error: `router audit error: ${(error as Error).message}`,
      }, 500);
    }
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

  let autonomyGate: AutonomyGateResult | null = null;
  let complianceResult: ComplianceSentinelResult | null = null;
  if (toolDef) {
    if (payload.user_id) {
      autonomyGate = await evaluateAutonomyGate(
        payload.user_id,
        autonomyCategory,
        toolDef.key,
        requestId,
      );
    } else {
      autonomyGate = buildDefaultAutonomyGate(autonomyCategory, toolDef.key);
    }

    if (
      autonomyGate &&
      routerContext?.policyAutonomyFloor !== undefined &&
      Number.isFinite(routerContext.policyAutonomyFloor)
    ) {
      autonomyGate = applyRouterAutonomyPolicy(
        autonomyGate,
        routerContext.policyAutonomyFloor,
      );
    }

    if (!dryRun && payload.user_id && autonomyGate && !autonomyGate.allowed) {
      return jsonResponse({
        ok: false,
        error: "autonomy_threshold",
        autonomy: {
          category: autonomyGate.category,
          level: autonomyGate.level,
          composer: autonomyGate.composer,
          source: autonomyGate.source,
          required_level: `L${autonomyGate.requiredLevel}`,
          allowed: autonomyGate.allowed,
        },
      }, 403);
    }
  }

  const toolRequestId = crypto.randomUUID();
  let plannedTool: Record<string, unknown> | undefined;
  let toolResult: Record<string, unknown> | undefined;

  if (toolDef) {
    complianceResult = evaluateComplianceSentinel(
      toolDef.key,
      toolInput ?? {},
      payload.plan,
      routerContext,
    );

    if (sessionId && complianceResult.status === "warn") {
      try {
        await insertEvent(sessionId, "WARN", "agent.compliance_warning", {
          agent: agentKey,
          tool: toolDef.key,
          compliance: complianceResult,
        });
      } catch (error) {
        return jsonResponse({
          ok: false,
          error: `compliance warn error: ${(error as Error).message}`,
        }, 500);
      }
    }

    if (complianceResult.status === "block") {
      if (sessionId) {
        try {
          await insertEvent(sessionId, "ERROR", "agent.compliance_block", {
            agent: agentKey,
            tool: toolDef.key,
            compliance: complianceResult,
          });
        } catch (error) {
          return jsonResponse({
            ok: false,
            error: `compliance block error: ${(error as Error).message}`,
          }, 500);
        }
      }

      return jsonResponse({
        ok: false,
        error: "compliance_violation",
        compliance: complianceResult,
      }, 422);
    }
  }

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

  if (routerContext) {
    const routerResponse: Record<string, unknown> = {
      id: routerContext.routerId,
      version: routerContext.routerVersion,
      target_agent: routerContext.targetAgent,
      tool: routerContext.toolKey,
      policy_ref: routerContext.policyRef,
      trace_id: routerContext.traceId,
    };
    if (routerEventId !== undefined) {
      routerResponse.event_id = routerEventId;
    }
    if (routerContext.allowedTools.length > 0) {
      routerResponse.allowed_tools = routerContext.allowedTools;
    }
    if (routerContext.serviceTools && routerContext.serviceTools.length > 0) {
      routerResponse.service_tools = routerContext.serviceTools.map((service) => {
        const entry: Record<string, unknown> = { key: service.key };
        if (service.policyRef) {
          entry.policy_ref = service.policyRef;
        }
        if (service.policyAutonomyFloor !== undefined) {
          entry.autonomy_floor = service.policyAutonomyFloor;
        }
        if (service.policyRequireLicense) {
          entry.require_license = true;
        }
        if (service.policyMetadata) {
          entry.policy_metadata = scrubForAudit(service.policyMetadata);
        }
        if (service.input) {
          entry.input = service.input;
        }
        return entry;
      });
    }
    responsePayload.router = routerResponse;
  } else if (routerEventId !== undefined) {
    responsePayload.router_event_id = routerEventId;
  }

  if (complianceResult) {
    responsePayload.compliance = complianceResult;
  }

  const autonomySnapshot = autonomyGate ??
    buildDefaultAutonomyGate(autonomyCategory, toolDef?.key ?? null);
  responsePayload.autonomy = {
    category: autonomySnapshot.category,
    level: autonomySnapshot.level,
    composer: autonomySnapshot.composer,
    source: autonomySnapshot.source,
    required_level: `L${autonomySnapshot.requiredLevel}`,
    allowed: autonomySnapshot.allowed,
  };

  if (
    routerContext?.policyAutonomyFloor !== undefined &&
    Number.isFinite(routerContext.policyAutonomyFloor)
  ) {
    const adjusted = applyRouterAutonomyPolicy(
      autonomySnapshot,
      routerContext.policyAutonomyFloor,
    );
    responsePayload.autonomy = {
      category: adjusted.category,
      level: adjusted.level,
      composer: adjusted.composer,
      source: adjusted.source,
      required_level: `L${adjusted.requiredLevel}`,
      allowed: adjusted.allowed,
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
      .map((item) => item.trim().replace(/^['"]|['"]$/g, ""))
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

function resolveAutonomyCategory(agentKey: string): AutonomyCategory {
  if (isAutonomyCategory(agentKey)) {
    return agentKey;
  }
  return AGENT_AUTONOMY_CATEGORY[agentKey] ?? "planner";
}

function requiredLevelForTool(toolKey: string | null | undefined): number {
  if (!toolKey) return AUTONOMY_MIN_EXECUTION_LEVEL;
  return HIGH_RISK_TOOLS.has(toolKey)
    ? 4
    : AUTONOMY_MIN_EXECUTION_LEVEL;
}

function buildDefaultAutonomyGate(
  category: AutonomyCategory,
  toolKey: string | null,
): AutonomyGateResult {
  const requiredLevel = requiredLevelForTool(toolKey);
  const level = AUTONOMY_DEFAULT_LEVEL;
  const allowed = rankAutonomyLevel(level) >= requiredLevel;
  return {
    allowed,
    category,
    level,
    composer: AUTONOMY_DEFAULT_COMPOSER,
    source: "default",
    requiredLevel,
  };
}

async function evaluateAutonomyGate(
  userId: string,
  category: AutonomyCategory,
  toolKey: string,
  requestId: string,
): Promise<AutonomyGateResult> {
  const prefs = await getAutonomyPreferences(userId, requestId);
  const pref = prefs.get(category);
  const level = pref?.level ?? AUTONOMY_DEFAULT_LEVEL;
  const composer = pref?.composer ?? AUTONOMY_DEFAULT_COMPOSER;
  const source = pref?.source ?? "default";
  const requiredLevel = requiredLevelForTool(toolKey);
  const allowed = rankAutonomyLevel(level) >= requiredLevel;
  return {
    allowed,
    category,
    level,
    composer,
    source,
    requiredLevel,
  };
}

async function getAutonomyPreferences(
  userId: string,
  requestId: string,
): Promise<Map<AutonomyCategory, StoredAutonomyPreference>> {
  const cached = AUTONOMY_PREF_CACHE.get(userId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.prefs;
  }

  if (AUTONOMY_PREFS_FIXTURES) {
    const prefs = buildFixturePreferences();
    AUTONOMY_PREF_CACHE.set(userId, {
      prefs,
      expiresAt: now + AUTONOMY_PREFS_CACHE_TTL_MS,
    });
    return prefs;
  }

  try {
    const headers = { ...serviceHeaders(), "Accept-Profile": "app" };
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/app.user_autonomy_prefs?select=category,autonomy_level,composer_mode,updated_at&user_id=eq.${userId}`,
      { headers },
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    const map = new Map<AutonomyCategory, StoredAutonomyPreference>();
    for (const row of rows) {
      const category = row.category;
      const level = row.autonomy_level;
      const composer = row.composer_mode;
      if (
        isAutonomyCategory(category) &&
        isAutonomyLevel(level) &&
        isComposerDial(composer)
      ) {
        map.set(category, {
          level,
          composer,
          updatedAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
          source: "db",
        });
      }
    }

    AUTONOMY_PREF_CACHE.set(userId, {
      prefs: map,
      expiresAt: now + AUTONOMY_PREFS_CACHE_TTL_MS,
    });
    return map;
  } catch (error) {
    console.log(JSON.stringify({
      level: "WARN",
      event: "agent.autonomy.fetch_failed",
      fn: "agent-orchestrator",
      request_id: requestId,
      message: (error as Error).message,
    }));
    const fallback = new Map<AutonomyCategory, StoredAutonomyPreference>();
    AUTONOMY_PREF_CACHE.set(userId, {
      prefs: fallback,
      expiresAt: now + AUTONOMY_PREFS_CACHE_TTL_MS,
    });
    return fallback;
  }
}

function buildFixturePreferences(): Map<AutonomyCategory, StoredAutonomyPreference> {
  const map = new Map<AutonomyCategory, StoredAutonomyPreference>();
  const items = Array.isArray((autonomyFixtures as { preferences?: unknown }).preferences)
    ? (autonomyFixtures as { preferences: unknown[] }).preferences
    : [];
  const timestamp = new Date().toISOString();
  for (const entry of items) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const category = (entry as Record<string, unknown>).category;
    const level = (entry as Record<string, unknown>).level;
    const composer = (entry as Record<string, unknown>).composer;
    if (
      isAutonomyCategory(category) &&
      isAutonomyLevel(level) &&
      isComposerDial(composer)
    ) {
      map.set(category, {
        level,
        composer,
        updatedAt: timestamp,
        source: "fixtures",
      });
    }
  }
  return map;
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

function applyRouterAutonomyPolicy(
  gate: AutonomyGateResult,
  requiredFloor: number,
): AutonomyGateResult {
  const normalizedFloor = Number.isFinite(requiredFloor)
    ? Math.max(AUTONOMY_MIN_EXECUTION_LEVEL, Math.floor(requiredFloor))
    : AUTONOMY_MIN_EXECUTION_LEVEL;
  const requiredLevel = Math.max(gate.requiredLevel, normalizedFloor);
  const allowed = rankAutonomyLevel(gate.level) >= requiredLevel;
  return {
    ...gate,
    requiredLevel,
    allowed,
  };
}

async function resolveRouterSelection(
  payload: RequestPayload,
  registry: Map<string, ToolDefinition>,
  requestId: string,
): Promise<RouterNormalizationResult> {
  const result: RouterNormalizationResult = {
    errors: [],
    context: null,
    auditPayload: null,
  };

  const selection = payload.router_selection;
  if (!selection) {
    return result;
  }

  if (!isPlainObject(selection)) {
    result.errors.push("router_selection must be an object");
    return result;
  }

  const routerId = typeof selection.router_id === "string"
    ? selection.router_id.trim()
    : "";
  if (!routerId) {
    result.errors.push("router_selection.router_id is required");
    return result;
  }

  const routerVersion = typeof selection.router_version === "string"
    ? selection.router_version.trim()
    : undefined;

  const profiles = await getRouterAgentProfiles(routerId, requestId);
  if (profiles.length === 0) {
    result.errors.push(
      `router ${routerId} is not registered in config.router_agents`,
    );
    return result;
  }

  const traceId = typeof payload.router_trace_id === "string"
      && payload.router_trace_id.trim().length > 0
    ? payload.router_trace_id.trim()
    : undefined;

  let candidates = profiles.filter((profile) => profile.active);
  if (routerVersion) {
    const matchedVersion = candidates.filter((profile) =>
      (profile.router_version ?? "") === routerVersion
    );
    if (matchedVersion.length > 0) {
      candidates = matchedVersion;
    }
  }

  if (candidates.length === 0) {
    result.errors.push(
      routerVersion
        ? `router ${routerId} has no active configuration for version ${routerVersion}`
        : `router ${routerId} has no active configuration`,
    );
    return result;
  }

  let targetAgent = typeof selection.target_agent === "string"
      && selection.target_agent.trim().length > 0
    ? selection.target_agent.trim()
    : undefined;

  if (targetAgent) {
    const allowedAgent = candidates.find((candidate) =>
      candidate.target_agent === targetAgent
    );
    if (!allowedAgent) {
      result.errors.push(
        `router ${routerId} is not permitted to target agent ${targetAgent}`,
      );
      return result;
    }
  } else {
    targetAgent = candidates[0]?.target_agent;
  }

  if (!targetAgent) {
    result.errors.push("router_selection.target_agent could not be resolved");
    return result;
  }

  const profile = candidates.find((candidate) =>
    candidate.target_agent === targetAgent
  ) ?? candidates[0];

  const toolSelection = selection.tool;
  const incomingTool = payload.tool_call;

  const selectedToolKeyRaw = typeof toolSelection?.key === "string"
      && toolSelection.key.trim().length > 0
    ? toolSelection.key.trim()
    : (typeof incomingTool?.key === "string"
        ? incomingTool.key.trim()
        : "");

  if (!selectedToolKeyRaw) {
    result.errors.push("router_selection.tool.key is required when routing");
    return result;
  }

  if (!registry.has(selectedToolKeyRaw)) {
    result.errors.push(`router requested unknown tool ${selectedToolKeyRaw}`);
    return result;
  }

  const allowedTools = Array.isArray(profile.allowed_tools)
    ? profile.allowed_tools
    : [];
  const allowAll = allowedTools.includes("*");
  if (!allowAll && allowedTools.length > 0 &&
    !allowedTools.includes(selectedToolKeyRaw)) {
    result.errors.push(
      `router ${routerId} is not permitted to call tool ${selectedToolKeyRaw} for ${targetAgent}`,
    );
    return result;
  }

  const normalizedInput: Record<string, unknown> = {};
  if (isPlainObject(incomingTool?.input)) {
    Object.assign(normalizedInput, incomingTool!.input);
  }
  if (isPlainObject(toolSelection?.input)) {
    Object.assign(normalizedInput, toolSelection!.input);
  }

  const policy = profile.tool_policies.find((item) =>
    item.key === selectedToolKeyRaw || item.key === "*"
  ) ?? null;

  const policyAutonomyFloor =
    toolSelection?.autonomy_floor ?? policy?.autonomy_floor;
  const policyRequireLicense = Boolean(
    toolSelection?.require_license ?? policy?.require_license,
  );
  const policyRef = toolSelection?.policy_ref ?? policy?.policy_id ??
    profile.policy_ref ?? undefined;

  const normalizedServiceTools: RouterServiceToolContext[] = [];
  const auditServiceTools: Record<string, unknown>[] = [];
  if (selection.service_tools !== undefined) {
    if (!Array.isArray(selection.service_tools)) {
      result.errors.push("router_selection.service_tools must be an array");
      return result;
    }

    selection.service_tools.forEach((entry, index) => {
      if (!isPlainObject(entry)) {
        result.errors.push(
          `router_selection.service_tools[${index}] must be an object`,
        );
        return;
      }

      const key = typeof entry.key === "string" ? entry.key.trim() : "";
      if (!key) {
        result.errors.push(
          `router_selection.service_tools[${index}].key is required`,
        );
        return;
      }

      if (!registry.has(key)) {
        result.errors.push(
          `router requested unknown service tool ${key}`,
        );
        return;
      }

      if (!allowAll && allowedTools.length > 0 && !allowedTools.includes(key)) {
        result.errors.push(
          `router ${routerId} is not permitted to call service tool ${key} for ${targetAgent}`,
        );
        return;
      }

      const entryPolicy = profile.tool_policies.find((item) =>
        item.key === key || item.key === "*"
      ) ?? null;

      const entryPolicyAutonomyFloor =
        typeof entry.autonomy_floor === "number"
          ? entry.autonomy_floor
          : entryPolicy?.autonomy_floor;
      const entryPolicyRequireLicense = Boolean(
        typeof entry.require_license === "boolean"
          ? entry.require_license
          : entryPolicy?.require_license,
      );
      const entryPolicyRef = typeof entry.policy_ref === "string" &&
          entry.policy_ref.trim().length > 0
        ? entry.policy_ref.trim()
        : entryPolicy?.policy_id ?? profile.policy_ref ?? undefined;

      const sanitizedInput = isPlainObject(entry.input)
        ? scrubForAudit(entry.input)
        : undefined;

      const serviceToolContext: RouterServiceToolContext = {
        key,
      };
      if (entryPolicyRef) {
        serviceToolContext.policyRef = entryPolicyRef;
      }
      if (
        typeof entryPolicyAutonomyFloor === "number" &&
        Number.isFinite(entryPolicyAutonomyFloor)
      ) {
        serviceToolContext.policyAutonomyFloor = Math.floor(
          entryPolicyAutonomyFloor,
        );
      }
      if (entryPolicyRequireLicense) {
        serviceToolContext.policyRequireLicense = true;
      }
      if (entryPolicy?.metadata) {
        serviceToolContext.policyMetadata = entryPolicy.metadata;
      }
      if (sanitizedInput) {
        serviceToolContext.input = sanitizedInput as Record<string, unknown>;
      }

      normalizedServiceTools.push(serviceToolContext);

      const auditEntry: Record<string, unknown> = { key };
      if (entryPolicyRef) {
        auditEntry.policy_ref = entryPolicyRef;
      }
      if (serviceToolContext.policyAutonomyFloor !== undefined) {
        auditEntry.autonomy_floor = serviceToolContext.policyAutonomyFloor;
      }
      if (entryPolicyRequireLicense) {
        auditEntry.require_license = true;
      }
      if (entryPolicy?.metadata) {
        auditEntry.policy_metadata = scrubForAudit(entryPolicy.metadata);
      }
      if (sanitizedInput) {
        auditEntry.input = sanitizedInput;
      }
      auditServiceTools.push(auditEntry);
    });
  }

  const toolCall: ToolCallInput = {
    key: selectedToolKeyRaw,
    input: normalizedInput,
  };

  result.agentKey = targetAgent;
  result.toolCall = toolCall;

  const context: RouterNormalizationContext = {
    routerId,
    routerVersion,
    targetAgent,
    allowedTools,
    toolKey: selectedToolKeyRaw,
    reason: typeof selection.reason === "string"
      ? selection.reason
      : undefined,
    policyRef,
    policyAutonomyFloor: typeof policyAutonomyFloor === "number"
        && Number.isFinite(policyAutonomyFloor)
      ? Math.floor(policyAutonomyFloor)
      : undefined,
    policyRequireLicense: policyRequireLicense || undefined,
    policyMetadata: policy?.metadata ?? null,
    serviceTools: normalizedServiceTools.length > 0
      ? normalizedServiceTools
      : undefined,
    traceId,
  };

  result.context = context;

  const auditPayload: Record<string, unknown> = {
    router_id: routerId,
    router_version: routerVersion,
    target_agent: targetAgent,
    allowed_tools: allowedTools,
    requested_tool: selectedToolKeyRaw,
    reason: context.reason,
    trace_id: traceId,
  };
  if (policyRef) {
    auditPayload.policy_ref = policyRef;
  }
  if (context.policyAutonomyFloor !== undefined) {
    auditPayload.policy_autonomy_floor = context.policyAutonomyFloor;
  }
  if (context.policyRequireLicense) {
    auditPayload.policy_require_licence = true;
  }
  if (policy?.metadata && Object.keys(policy.metadata).length > 0) {
    auditPayload.policy_metadata = scrubForAudit(policy.metadata);
  }
  if (toolSelection?.input) {
    auditPayload.router_tool_input = scrubForAudit(toolSelection.input);
  }
  if (selection.metadata) {
    auditPayload.router_metadata = scrubForAudit(selection.metadata);
  }
  if (auditServiceTools.length > 0) {
    auditPayload.service_tools = auditServiceTools;
  }

  result.auditPayload = auditPayload;
  return result;
}

async function getRouterAgentProfiles(
  routerId: string,
  requestId: string,
): Promise<RouterAgentProfile[]> {
  const cached = ROUTER_CONFIG_CACHE.get(routerId);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.profiles;
  }

  try {
    const headers = { ...serviceHeaders(), "Accept-Profile": "config" };
    const url = new URL(`${SUPABASE_URL}/rest/v1/config.router_agents`);
    url.searchParams.set(
      "select",
      "router_id,router_version,target_agent,allowed_tools,tool_policies,policy_ref,metadata,active",
    );
    url.searchParams.set("router_id", `eq.${routerId}`);

    const response = await fetch(url, { headers });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || response.statusText);
    }

    const rows = await response.json() as Array<Record<string, unknown>>;
    const profiles = rows
      .map((row) => parseRouterAgentProfile(row))
      .filter((profile): profile is RouterAgentProfile => Boolean(profile));

    ROUTER_CONFIG_CACHE.set(routerId, {
      profiles,
      expiresAt: now + ROUTER_CONFIG_CACHE_TTL_MS,
    });

    return profiles;
  } catch (error) {
    console.log(JSON.stringify({
      level: "WARN",
      event: "agent.router_config.fetch_failed",
      fn: "agent-orchestrator",
      request_id: requestId,
      router_id: routerId,
      message: (error as Error).message,
    }));
    ROUTER_CONFIG_CACHE.set(routerId, {
      profiles: [],
      expiresAt: now + ROUTER_CONFIG_CACHE_TTL_MS,
    });
    return [];
  }
}

function parseRouterAgentProfile(
  row: Record<string, unknown>,
): RouterAgentProfile | null {
  const routerId = typeof row.router_id === "string" ? row.router_id : null;
  const targetAgent = typeof row.target_agent === "string"
    ? row.target_agent
    : null;
  if (!routerId || !targetAgent) {
    return null;
  }

  const allowedTools = Array.isArray(row.allowed_tools)
    ? row.allowed_tools.filter((tool): tool is string => typeof tool === "string")
    : [];

  const toolPolicies = parseRouterToolPolicies(row.tool_policies);

  const metadata = isPlainObject(row.metadata)
    ? row.metadata as Record<string, unknown>
    : null;

  const active = typeof row.active === "boolean" ? row.active : true;

  return {
    router_id: routerId,
    router_version: typeof row.router_version === "string"
      ? row.router_version
      : null,
    target_agent: targetAgent,
    allowed_tools: allowedTools,
    tool_policies: toolPolicies,
    policy_ref: typeof row.policy_ref === "string" ? row.policy_ref : null,
    metadata,
    active,
  };
}

function parseRouterToolPolicies(value: unknown): RouterToolPolicy[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const policies: RouterToolPolicy[] = [];
  for (const entry of value) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const key = typeof entry.key === "string" ? entry.key.trim() : "";
    if (!key) {
      continue;
    }
    const policy: RouterToolPolicy = { key };
    if (typeof entry.policy_id === "string" && entry.policy_id.trim()) {
      policy.policy_id = entry.policy_id.trim();
    }
    if (
      typeof entry.autonomy_floor === "number" &&
      Number.isFinite(entry.autonomy_floor)
    ) {
      policy.autonomy_floor = Math.floor(entry.autonomy_floor);
    }
    if (typeof entry.require_license === "boolean") {
      policy.require_license = entry.require_license;
    }
    if (isPlainObject(entry.metadata)) {
      policy.metadata = entry.metadata as Record<string, unknown>;
    }
    policies.push(policy);
  }
  return policies;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function scrubForAudit(value: unknown, depth = 0): unknown {
  if (depth >= 3) {
    return Array.isArray(value) ? "[array]" : "[object]";
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => scrubForAudit(item, depth + 1));
  }
  if (isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    let count = 0;
    for (const [key, entry] of Object.entries(value)) {
      if (count >= 8) {
        output.__truncated__ = true;
        break;
      }
      output[key] = scrubForAudit(entry, depth + 1);
      count += 1;
    }
    return output;
  }
  if (typeof value === "string") {
    return truncateForAudit(value, 120);
  }
  return value;
}

function evaluateComplianceSentinel(
  toolKey: string,
  toolInput: Record<string, unknown>,
  plan: Record<string, unknown> | undefined,
  routerContext: RouterNormalizationContext | null,
): ComplianceSentinelResult {
  const warnings: string[] = [];
  const violations: string[] = [];
  const triggers = detectPackageTravelTriggers(toolKey, toolInput, plan);
  const licence = findLicenceIdentifier(toolInput, plan);

  if (routerContext?.policyRequireLicense && !licence) {
    violations.push("Router policy requires a licence identifier before execution.");
  }

  if (LICENSE_REQUIRED_TOOLS.has(toolKey) && !licence) {
    violations.push(`Tool ${toolKey} requires a licence identifier.`);
  }

  if (triggers.length > 0 && !licence) {
    violations.push(
      "Package travel trigger detected without a licence identifier.",
    );
  }

  if (triggers.length > 0 && licence) {
    warnings.push("Package travel trigger detected with licence present.");
  }

  const status: "clear" | "warn" | "block" = violations.length > 0
    ? "block"
    : warnings.length > 0
    ? "warn"
    : "clear";

  return {
    status,
    warnings,
    violations,
    licence_detected: licence,
    triggers,
    policy_ref: routerContext?.policyRef,
    router_id: routerContext?.routerId,
    router_version: routerContext?.routerVersion,
    tool_key: toolKey,
  };
}

function findLicenceIdentifier(
  toolInput: Record<string, unknown>,
  plan: Record<string, unknown> | undefined,
): string | null {
  for (const path of LICENCE_FIELD_PATHS) {
    const value = extractStringPath(toolInput, path);
    if (value) {
      return value;
    }
  }

  if (plan) {
    for (const path of LICENCE_FIELD_PATHS) {
      const value = extractStringPath(plan, path);
      if (value) {
        return value;
      }
    }
  }

  return null;
}

function extractStringPath(source: unknown, path: string): string | null {
  if (!isPlainObject(source)) {
    return null;
  }
  const segments = path.split(".");
  let current: unknown = source;
  for (const segment of segments) {
    if (!isPlainObject(current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[segment];
    if (current === undefined || current === null) {
      return null;
    }
  }
  if (typeof current === "string" && current.trim().length > 0) {
    return current.trim();
  }
  return null;
}

function detectPackageTravelTriggers(
  toolKey: string,
  toolInput: Record<string, unknown>,
  plan: Record<string, unknown> | undefined,
): string[] {
  const triggers = new Set<string>();

  if (PACKAGE_TRAVEL_TOOLS.has(toolKey)) {
    triggers.add(`tool:${toolKey}`);
  }

  if (typeof toolInput.package_type === "string" && toolInput.package_type) {
    triggers.add("package_type");
  }

  if (toolInput.package === true || toolInput.bundle === true) {
    triggers.add("package_flag");
  }

  if (typeof toolInput.package_reference === "string" &&
    toolInput.package_reference) {
    triggers.add("package_reference");
  }

  if (Array.isArray(toolInput.components) && toolInput.components.length >= 2) {
    triggers.add("multi_component_tool_input");
  }

  if (plan) {
    if (Array.isArray((plan as Record<string, unknown>).days) &&
      (plan as { days: unknown[] }).days.length >= 2) {
      triggers.add("multi_day_plan");
    }
    if (Array.isArray((plan as Record<string, unknown>).items) &&
      (plan as { items: unknown[] }).items.length >= 2) {
      triggers.add("multi_item_plan");
    }
    if (Array.isArray((plan as Record<string, unknown>).holds) &&
      (plan as { holds: unknown[] }).holds.length > 0) {
      triggers.add("hold_present");
    }
  }

  return Array.from(triggers);
}
