import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, withObs } from "../_obs/withObs.ts";
import { maybeHandleHealth } from "../_shared/health.ts";
import {
  ClusterRecord,
  clusters,
} from "../_shared/groupsClusters.ts";

interface NormalizedSuggestion {
  suggestion_id: string;
  user_id: string;
  group_id: string;
  group_label: string | null;
  cluster_id: string;
  score: number;
  reason: string | null;
  signals: unknown[];
  generated_at: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
}

const MAX_LIMIT = 50;

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });
}

function audit(event: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "AUDIT",
      event: "groups.suggest",
      fn: "groups-suggest",
      ...event,
    }),
  );
}

function parseLimit(raw: string | null): number {
  if (!raw) return MAX_LIMIT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return MAX_LIMIT;
  }
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function resolveLabel(cluster: ClusterRecord, groupId: string): string | null {
  if (cluster.anchor_group?.group_id === groupId) {
    return cluster.anchor_group.label ?? null;
  }
  const candidate = (cluster.candidates ?? []).find((item) =>
    item.group_id === groupId
  );
  return candidate?.label ?? null;
}

function normalizeSuggestions(userId: string): NormalizedSuggestion[] {
  const suggestions: NormalizedSuggestion[] = [];
  for (const cluster of clusters as ClusterRecord[]) {
    const generatedAt = typeof cluster.generated_at === "string"
      ? cluster.generated_at
      : null;
    const tags = Array.isArray(cluster.tags) ? cluster.tags : [];
    const metadata = typeof cluster.metadata === "object" && cluster.metadata
      ? cluster.metadata
      : {};

    for (const recommendation of cluster.recommendations ?? []) {
      if (recommendation.user_id !== userId) continue;
      suggestions.push({
        suggestion_id: recommendation.suggestion_id,
        user_id,
        group_id: recommendation.group_id,
        group_label: resolveLabel(cluster, recommendation.group_id),
        cluster_id: cluster.cluster_id,
        score: typeof recommendation.score === "number"
          ? recommendation.score
          : 0,
        reason: recommendation.reason ?? null,
        signals: Array.isArray(recommendation.signals)
          ? recommendation.signals
          : [],
        generated_at: generatedAt,
        tags,
        metadata,
      });
    }
  }
  return suggestions;
}

Deno.serve(withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const maybeHealth = maybeHandleHealth(req, "groups-suggest");
  if (maybeHealth) {
    return maybeHealth;
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, { status: 405 });
  }

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id")?.trim();
  if (!userId) {
    return jsonResponse({ ok: false, error: "user_id is required" }, {
      status: 400,
    });
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const suggestions = normalizeSuggestions(userId).slice(0, limit);

  audit({
    requestId,
    userId,
    limit,
    suggestions: suggestions.length,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    user_id: userId,
    suggestions,
  });
}, { fn: "groups-suggest", defaultErrorCode: ERROR_CODES.UNKNOWN }));
