import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, healthResponse, withObs } from "../_obs/withObs.ts";
import {
  ensureAgentSession,
  insertAgentEventTelemetry,
  jsonResponse,
} from "../_shared/groups.ts";

interface SuggestionFixture {
  id: string;
  title: string;
  summary: string;
  badges: { label: string; tone: "neutral" | "info" | "success" | "warning" }[];
  actions: { label: string; intent: string; href?: string }[];
  minSize?: number;
  maxSize?: number;
}

const SUGGESTION_FIXTURES: SuggestionFixture[] = [
  {
    id: "impact-retreat",
    title: "Impact retreat in Volcanoes National Park",
    summary:
      "3-night carbon-negative offsite with reforestation lab, gorilla trekking permits, and regenerative cuisine.",
    badges: [
      { label: "10-18 travelers", tone: "info" },
      { label: "Carbon negative", tone: "success" },
    ],
    actions: [
      { label: "Preview itinerary", intent: "view_itinerary", href: "/itinerary/impact-retreat" },
      { label: "Ask Planner", intent: "rerun" },
    ],
    minSize: 8,
    maxSize: 24,
  },
  {
    id: "service-learning",
    title: "Service learning in Nyungwe canopy",
    summary:
      "Student-aligned itinerary with biodiversity monitoring, canopy walks, and ranger-led conservation briefings.",
    badges: [
      { label: "12-40 travelers", tone: "info" },
      { label: "Academic credit ready", tone: "neutral" },
    ],
    actions: [
      { label: "Share starter deck", intent: "share" },
      { label: "Ask Planner", intent: "rerun" },
    ],
    minSize: 12,
    maxSize: 48,
  },
  {
    id: "executive-forum",
    title: "Executive forum at Lake Kivu",
    summary:
      "Board-level forum blending solar catamaran transfers, lodge buyout, and circular economy workshops.",
    badges: [
      { label: "6-12 travelers", tone: "info" },
      { label: "Premium partners", tone: "warning" },
    ],
    actions: [
      { label: "Preview itinerary", intent: "view_itinerary", href: "/itinerary/executive-forum" },
      { label: "Ask Planner", intent: "rerun" },
    ],
    minSize: 4,
    maxSize: 16,
  },
  {
    id: "community-fundraiser",
    title: "Community fundraiser & impact summit",
    summary:
      "Hybrid on-site + virtual summit with Kigali Convention Centre studio, fair-trade marketplace, and offset briefing.",
    badges: [
      { label: "50-120 travelers", tone: "info" },
      { label: "Hybrid ready", tone: "neutral" },
    ],
    actions: [
      { label: "Download agenda draft", intent: "share" },
      { label: "Ask Planner", intent: "rerun" },
    ],
    minSize: 40,
    maxSize: 160,
  },
];

function normalizeBudget(raw: unknown): "lean" | "balanced" | "premium" {
  if (raw === "lean" || raw === "premium") {
    return raw;
  }
  return "balanced";
}

function normalizeLocale(raw: unknown): "en" | "rw" {
  if (raw === "rw") return "rw";
  return "en";
}

function sizeScore(suggestion: SuggestionFixture, size: number): number {
  const min = suggestion.minSize ?? 0;
  const max = suggestion.maxSize ?? Number.MAX_SAFE_INTEGER;
  if (size >= min && size <= max) {
    return 0;
  }
  if (size < min) {
    return min - size;
  }
  return size - max;
}

function buildSuggestions(
  budgetHint: "lean" | "balanced" | "premium",
  locale: "en" | "rw",
  groupSize?: number,
) {
  const ordered = [...SUGGESTION_FIXTURES];
  if (typeof groupSize === "number" && Number.isFinite(groupSize)) {
    ordered.sort((a, b) => sizeScore(a, groupSize) - sizeScore(b, groupSize));
  }

  const budgetBadge =
    budgetHint === "lean"
      ? { label: "Value-minded", tone: "neutral" as const }
      : budgetHint === "premium"
      ? { label: "Premium focus", tone: "warning" as const }
      : { label: "Balanced budget", tone: "info" as const };

  const localeBadge =
    locale === "rw"
      ? { label: "Kinyarwanda ops", tone: "success" as const }
      : { label: "English ops", tone: "success" as const };

  return ordered.slice(0, 3).map((suggestion) => {
    const { minSize, maxSize, ...rest } = suggestion;
    const badges = [
      ...rest.badges,
      budgetBadge,
      localeBadge,
    ];

    if (groupSize && (minSize || maxSize)) {
      const windowLabel = `${minSize ?? 4}-${maxSize ?? groupSize}+ pax ready`;
      badges.push({ label: windowLabel, tone: "neutral" });
    }

    let summary = rest.summary;
    if (budgetHint === "premium") {
      summary = `${summary} Premium carbon accounting and concierge staffing included.`;
    } else if (budgetHint === "lean") {
      summary = `${summary} Optimized for shared rooms and local transport to respect lean budgets.`;
    }

    const actions = rest.actions.map((action) =>
      action.intent === "rerun"
        ? { ...action, label: "Ask Planner" }
        : action
    );

    return {
      ...rest,
      summary,
      badges,
      actions,
    };
  });
}

const handler = withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const url = new URL(req.url);

  if (req.method === "GET" && url.pathname.endsWith("/health")) {
    return healthResponse("groups-suggest");
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "POST required" }, { status: 405 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_error) {
    body = {};
  }

  const topic = typeof body.topic === "string" ? body.topic.trim() : "";
  const sessionIdRaw = typeof body.session_id === "string" ? body.session_id : "";
  const userIdRaw = typeof body.user_id === "string" ? body.user_id : "";
  const budgetHint = normalizeBudget(body.budget_hint);
  const locale = normalizeLocale(body.locale);
  const groupSize =
    typeof body.group_size === "number" && Number.isFinite(body.group_size)
      ? Math.max(1, Math.min(500, Math.round(body.group_size)))
      : undefined;

  const suggestions = buildSuggestions(budgetHint, locale, groupSize);

  let ordered = suggestions;
  let followUp: string | undefined;
  if (topic) {
    const match = suggestions.find((suggestion) => suggestion.id === topic);
    if (match) {
      ordered = [match, ...suggestions.filter((entry) => entry.id !== topic)];
      followUp = `Logged interest in ${match.title}. Ops will prep next steps and reply within one business day.`;
    } else {
      followUp = `Captured interest in ${topic}. Ops will craft a tailored plan and respond shortly.`;
    }
  }

  const sessionId = await ensureAgentSession({
    sessionId: sessionIdRaw,
    userId: userIdRaw,
    agentKey: "groups_suggest",
  });

  await insertAgentEventTelemetry(sessionId, "groups.suggest", {
    request_id: requestId,
    topic: topic || null,
    budget_hint: budgetHint,
    locale,
    group_size: groupSize ?? null,
    suggestion_count: ordered.length,
  });

  return jsonResponse(
    {
      ok: true,
      request_id: requestId,
      session_id: sessionId ?? undefined,
      suggestions: ordered,
      follow_up: followUp,
    },
    { headers: { "cache-control": "public, max-age=30" } },
  );
}, { fn: "groups-suggest", defaultErrorCode: ERROR_CODES.UNKNOWN });

serve(handler);
