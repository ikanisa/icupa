import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, withObs } from "../_obs/withObs.ts";
import { maybeHandleHealth } from "../_shared/health.ts";
import {
  ClusterCandidate,
  ClusterRecommendation,
  ClusterRecord,
  clusters,
} from "../_shared/groupsClusters.ts";

interface CandidateSummary {
  group_id: string;
  label: string | null;
  status: string | null;
  member_count: number | null;
  similarity_score: number;
  signals: unknown[];
}

interface RecommendationSummary {
  suggestion_id: string;
  user_id: string;
  group_id: string;
  group_label: string | null;
  score: number;
  reason: string | null;
  signals: unknown[];
}

interface ClusterSummary {
  cluster_id: string;
  generated_at: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  anchor_group: {
    group_id: string;
    label: string | null;
    itinerary_id: string | null;
    status: string | null;
    member_count: number | null;
    region: string | null;
    owner_id: string | null;
  };
  candidate_count: number;
  suggestion_count: number;
  top_candidate_score: number | null;
  top_suggestion_score: number | null;
  candidates?: CandidateSummary[];
  recommendations?: RecommendationSummary[];
}

const MAX_CLUSTER_LIMIT = 25;

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
      event: "ops.groups.suggestions",
      fn: "ops-groups-suggestions",
      ...event,
    }),
  );
}

function parseLimit(raw: string | null): number {
  if (!raw) return MAX_CLUSTER_LIMIT;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    return MAX_CLUSTER_LIMIT;
  }
  return Math.min(MAX_CLUSTER_LIMIT, Math.max(1, Math.floor(value)));
}

function parseMinScore(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }
  if (value > 1) {
    return 1;
  }
  return value;
}

function hasTag(cluster: ClusterRecord, tag: string | null): boolean {
  if (!tag) return true;
  const normalized = tag.toLowerCase();
  const tags = Array.isArray(cluster.tags) ? cluster.tags : [];
  return tags.some((item) => item.toLowerCase() === normalized);
}

function summarizeCandidate(candidate: ClusterCandidate): CandidateSummary {
  return {
    group_id: candidate.group_id,
    label: candidate.label ?? null,
    status: candidate.status ?? null,
    member_count: typeof candidate.member_count === "number"
      ? candidate.member_count
      : null,
    similarity_score: typeof candidate.similarity_score === "number"
      ? candidate.similarity_score
      : 0,
    signals: Array.isArray(candidate.signals) ? candidate.signals : [],
  };
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

function summarizeRecommendation(
  cluster: ClusterRecord,
  recommendation: ClusterRecommendation,
): RecommendationSummary {
  return {
    suggestion_id: recommendation.suggestion_id,
    user_id: recommendation.user_id,
    group_id: recommendation.group_id,
    group_label: resolveLabel(cluster, recommendation.group_id),
    score: typeof recommendation.score === "number"
      ? recommendation.score
      : 0,
    reason: recommendation.reason ?? null,
    signals: Array.isArray(recommendation.signals)
      ? recommendation.signals
      : [],
  };
}

function topScore(values: number[]): number | null {
  if (values.length === 0) return null;
  let max = values[0];
  for (const value of values) {
    if (value > max) {
      max = value;
    }
  }
  return max;
}

function buildSummary(
  cluster: ClusterRecord,
  minScore: number | null,
  includeFull: boolean,
): ClusterSummary {
  const generatedAt = typeof cluster.generated_at === "string"
    ? cluster.generated_at
    : null;
  const tags = Array.isArray(cluster.tags) ? cluster.tags : [];
  const metadata = typeof cluster.metadata === "object" && cluster.metadata
    ? cluster.metadata
    : {};

  const candidateSummaries = (cluster.candidates ?? [])
    .map(summarizeCandidate)
    .filter((candidate) => minScore === null || candidate.similarity_score >= minScore);
  const recommendationSummaries = (cluster.recommendations ?? [])
    .map((recommendation) => summarizeRecommendation(cluster, recommendation))
    .filter((rec) => minScore === null || rec.score >= minScore);

  const summary: ClusterSummary = {
    cluster_id: cluster.cluster_id,
    generated_at: generatedAt,
    tags,
    metadata,
    anchor_group: {
      group_id: cluster.anchor_group.group_id,
      label: cluster.anchor_group.label ?? null,
      itinerary_id: cluster.anchor_group.itinerary_id ?? null,
      status: cluster.anchor_group.status ?? null,
      member_count: typeof cluster.anchor_group.member_count === "number"
        ? cluster.anchor_group.member_count
        : null,
      region: cluster.anchor_group.region ?? null,
      owner_id: cluster.anchor_group.owner_id ?? null,
    },
    candidate_count: candidateSummaries.length,
    suggestion_count: recommendationSummaries.length,
    top_candidate_score: topScore(
      candidateSummaries.map((candidate) => candidate.similarity_score),
    ),
    top_suggestion_score: topScore(
      recommendationSummaries.map((recommendation) => recommendation.score),
    ),
  };

  if (includeFull) {
    summary.candidates = candidateSummaries;
    summary.recommendations = recommendationSummaries;
  }

  return summary;
}

Deno.serve(withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const maybeHealth = maybeHandleHealth(req, "ops-groups-suggestions");
  if (maybeHealth) {
    return maybeHealth;
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, { status: 405 });
  }

  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const limit = parseLimit(url.searchParams.get("limit"));
  const minScore = parseMinScore(url.searchParams.get("min_score"));
  const detail = url.searchParams.get("detail")?.toLowerCase();
  const includeFull = detail !== "summary";

  const filteredClusters = (clusters as ClusterRecord[])
    .filter((cluster) => hasTag(cluster, tag))
    .slice(0, limit)
    .map((cluster) => buildSummary(cluster, minScore, includeFull));

  audit({
    requestId,
    tag: tag ?? "",
    limit,
    minScore: minScore ?? "",
    detail: includeFull ? "full" : "summary",
    clusters: filteredClusters.length,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    tag: tag ?? null,
    min_score: minScore,
    detail: includeFull ? "full" : "summary",
    clusters: filteredClusters,
  });
}, { fn: "ops-groups-suggestions", defaultErrorCode: ERROR_CODES.UNKNOWN }));
