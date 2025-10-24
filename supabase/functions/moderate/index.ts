import rulesFixture from "./fixtures/rules.json" with { type: "json" };
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import { emitMetric } from "../_obs/withObs.ts";

const ACTION_PRIORITY: Record<ModerationAction, number> = {
  allow: 0,
  refuse: 1,
  escalate: 2,
};

const RULES: ModerationRule[] = (rulesFixture as ModerationRule[]).map((rule) => ({
  category: rule.category,
  action: rule.action,
  keywords: (rule.keywords ?? []).map((keyword) => keyword.toLowerCase()),
  hints: (rule.hints ?? []).map((hint) => hint.toLowerCase()),
  description: rule.description,
}));

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("moderate");
  }

  if (req.method !== "POST") {
    logDecision({ requestId, outcome: "method_not_allowed" });
    emitMetric({
      fn: "moderate",
      requestId,
      name: "moderation.method_not_allowed",
      value: 1,
    });
    return jsonResponse({ ok: false, error: "POST only" }, 405);
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch (_error) {
    logDecision({ requestId, outcome: "invalid_json" });
    emitMetric({
      fn: "moderate",
      requestId,
      name: "moderation.invalid_json",
      value: 1,
    });
    return jsonResponse({ ok: false, error: "Invalid JSON" }, 400);
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    logDecision({
      requestId,
      outcome: "validation_failed",
      errors: validation.errors,
    });
    emitMetric({
      fn: "moderate",
      requestId,
      name: "moderation.validation_failed",
      value: 1,
    });
    return jsonResponse({ ok: false, errors: validation.errors }, 400);
  }

  const decisions = evaluateMessages(validation.messages);
  const summary = summarizeDecisions(decisions);

  logDecision({
    requestId,
    outcome: "evaluated",
    action: summary.action,
    category: summary.category,
    agent: validation.agent,
    decisions: decisions.map((decision) => ({
      index: decision.index,
      action: decision.action,
      category: decision.category,
      reason: decision.reason,
      matched: decision.matched,
    })),
  });

  emitMetric({
    fn: "moderate",
    requestId,
    name: "moderation.action",
    value: 1,
    tags: {
      action: summary.action,
      category: summary.category,
    },
  });

  return jsonResponse({
    request_id: requestId,
    action: summary.action,
    category: summary.category,
    source: "fixtures",
    decisions: decisions.map((decision) => ({
      message_index: decision.index,
      action: decision.action,
      category: decision.category,
      reason: decision.reason,
      matched: decision.matched,
    })),
  });
}, { fn: "moderate", defaultErrorCode: ERROR_CODES.UNKNOWN });

Deno.serve(handler);

function validatePayload(payload: unknown):
  | { ok: false; errors: string[] }
  | { ok: true; messages: ModerationMessage[]; agent?: string } {
  const errors: string[] = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, errors: ["payload must be an object"] };
  }

  const record = payload as Record<string, unknown>;
  const agent = typeof record.agent === "string"
    ? record.agent.trim()
    : undefined;

  const messagesValue = record.messages;
  if (!Array.isArray(messagesValue) || messagesValue.length === 0) {
    return { ok: false, errors: ["messages must be a non-empty array"] };
  }

  const messages: ModerationMessage[] = [];
  for (const [index, raw] of messagesValue.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      errors.push(`messages[${index}] must be an object`);
      continue;
    }

    const message = raw as Record<string, unknown>;
    const role = typeof message.role === "string" ? message.role.trim() : "";
    const content = typeof message.content === "string"
      ? message.content.trim()
      : "";

    if (!role) {
      errors.push(`messages[${index}].role is required`);
    }
    if (!content) {
      errors.push(`messages[${index}].content is required`);
    }

    let metadata: Record<string, unknown> | undefined;
    if (message.metadata !== undefined) {
      if (
        typeof message.metadata === "object" &&
        message.metadata !== null &&
        !Array.isArray(message.metadata)
      ) {
        metadata = message.metadata as Record<string, unknown>;
      } else {
        errors.push(`messages[${index}].metadata must be an object when provided`);
      }
    }

    const hints: string[] = [];
    if (Array.isArray(message.hints)) {
      for (const hint of message.hints) {
        if (typeof hint === "string" && hint.trim()) {
          hints.push(hint.trim().toLowerCase());
        }
      }
    }

    const flaggedReason = extractString(
      message,
      ["flagged_reason", "reason", "note"],
    );
    const flagged = typeof message.flagged === "boolean"
      ? message.flagged
      : false;

    messages.push({
      index,
      role,
      content,
      hints,
      metadata,
      flagged,
      flaggedReason,
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, messages, agent };
}

function evaluateMessages(messages: ModerationMessage[]): ModerationDecision[] {
  const decisions: ModerationDecision[] = [];
  for (const message of messages) {
    const decision = evaluateMessage(message);
    decisions.push(decision);
  }
  return decisions;
}

function evaluateMessage(message: ModerationMessage): ModerationDecision {
  const normalizedContent = message.content.toLowerCase();

  let matchedRule = matchByHints(message.hints);
  let matchType: string | undefined;
  if (matchedRule) {
    matchType = "hint";
  }

  if (!matchedRule) {
    matchedRule = matchByMetadata(message.metadata);
    if (matchedRule) {
      matchType = "metadata";
    }
  }

  if (!matchedRule) {
    matchedRule = matchByKeywords(normalizedContent);
    if (matchedRule) {
      matchType = "keyword";
    }
  }

  if (matchedRule) {
    return {
      index: message.index,
      action: matchedRule.action,
      category: matchedRule.category,
      reason: matchedRule.description,
      matched: {
        type: matchType,
        category: matchedRule.category,
        hints: message.hints,
      },
    };
  }

  if (message.flagged) {
    return {
      index: message.index,
      action: "escalate",
      category: "unknown",
      reason: message.flaggedReason ?? "Flagged without matching rule",
      matched: {
        type: "flagged",
        hints: message.hints,
      },
    };
  }

  return {
    index: message.index,
    action: "allow",
    category: "benign",
    reason: "No abuse detected",
    matched: {
      type: "none",
      hints: message.hints,
    },
  };
}

function summarizeDecisions(decisions: ModerationDecision[]) {
  let topAction: ModerationAction = "allow";
  let topCategory = "benign";
  for (const decision of decisions) {
    if (ACTION_PRIORITY[decision.action] > ACTION_PRIORITY[topAction]) {
      topAction = decision.action;
      topCategory = decision.category;
    }
  }
  return { action: topAction, category: topCategory };
}

function matchByHints(hints: string[]): ModerationRule | undefined {
  for (const hint of hints) {
    const rule = RULES.find((candidate) => candidate.hints.includes(hint));
    if (rule) {
      return rule;
    }
  }
  return undefined;
}

function matchByMetadata(
  metadata: Record<string, unknown> | undefined,
): ModerationRule | undefined {
  if (!metadata) {
    return undefined;
  }
  const candidateStrings = collectMetadataStrings(metadata);
  for (const value of candidateStrings) {
    const normalized = value.toLowerCase();
    const rule = RULES.find((candidate) => {
      return candidate.category === normalized ||
        candidate.hints.includes(normalized);
    });
    if (rule) {
      return rule;
    }
  }
  return undefined;
}

function matchByKeywords(content: string): ModerationRule | undefined {
  for (const rule of RULES) {
    for (const keyword of rule.keywords) {
      if (keyword && content.includes(keyword)) {
        return rule;
      }
    }
  }
  return undefined;
}

function collectMetadataStrings(metadata: Record<string, unknown>): string[] {
  const values: string[] = [];
  for (const value of Object.values(metadata)) {
    if (typeof value === "string" && value.trim()) {
      values.push(value.trim());
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && item.trim()) {
          values.push(item.trim());
        }
      }
    } else if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      values.push(...collectMetadataStrings(value as Record<string, unknown>));
    }
  }
  return values;
}

function extractString(
  input: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = input[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function logDecision(fields: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "moderation.decision",
      fn: "moderate",
      ts: new Date().toISOString(),
      ...fields,
    }),
  );
}

type ModerationAction = "allow" | "refuse" | "escalate";

type ModerationRule = {
  category: string;
  action: ModerationAction;
  keywords: string[];
  hints: string[];
  description: string;
};

type ModerationMessage = {
  index: number;
  role: string;
  content: string;
  hints: string[];
  metadata?: Record<string, unknown>;
  flagged: boolean;
  flaggedReason?: string;
};

type ModerationDecision = {
  index: number;
  action: ModerationAction;
  category: string;
  reason: string;
  matched: Record<string, unknown>;
};
