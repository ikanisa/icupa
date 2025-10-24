import { ERROR_CODES } from "../_obs/constants.ts";
import { getRequestId, withObs } from "../_obs/withObs.ts";
import { maybeHandleHealth } from "../_shared/health.ts";
import {
  ClusterRecord,
  clusters,
} from "../_shared/groupsClusters.ts";

interface NormalizedMatch {
  cluster_id: string;
  role: "anchor" | "candidate";
  group_id: string;
  partner_group_id: string;
  partner_group_label: string | null;
  partner_group_status: string | null;
  partner_group_members: number | null;
  similarity_score: number;
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
      event: "groups.match",
      fn: "groups-match",
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

function normalizeMatches(groupId: string): NormalizedMatch[] {
  const matches: NormalizedMatch[] = [];
  for (const cluster of clusters as ClusterRecord[]) {
    const generatedAt = typeof cluster.generated_at === "string"
      ? cluster.generated_at
      : null;
    const tags = Array.isArray(cluster.tags) ? cluster.tags : [];
    const metadata = typeof cluster.metadata === "object" && cluster.metadata
      ? cluster.metadata
      : {};

    if (cluster.anchor_group?.group_id === groupId) {
      for (const candidate of cluster.candidates ?? []) {
        matches.push({
          cluster_id: cluster.cluster_id,
          role: "anchor",
          group_id,
          partner_group_id: candidate.group_id,
          partner_group_label: candidate.label ?? null,
          partner_group_status: candidate.status ?? null,
          partner_group_members: typeof candidate.member_count === "number"
            ? candidate.member_count
            : null,
          similarity_score: typeof candidate.similarity_score === "number"
            ? candidate.similarity_score
            : 0,
          signals: Array.isArray(candidate.signals)
            ? candidate.signals
            : [],
          generated_at: generatedAt,
          tags,
          metadata,
        });
      }
      continue;
    }

    const candidate = (cluster.candidates ?? []).find((item) =>
      item.group_id === groupId
    );
    if (candidate) {
      const anchor = cluster.anchor_group;
      matches.push({
        cluster_id: cluster.cluster_id,
        role: "candidate",
        group_id,
        partner_group_id: anchor?.group_id ?? "",
        partner_group_label: anchor?.label ?? null,
        partner_group_status: anchor?.status ?? null,
        partner_group_members: typeof anchor?.member_count === "number"
          ? anchor.member_count ?? null
          : null,
        similarity_score: typeof candidate.similarity_score === "number"
          ? candidate.similarity_score
          : 0,
        signals: Array.isArray(candidate.signals) ? candidate.signals : [],
        generated_at: generatedAt,
        tags,
        metadata,
      });
    }
  }
  return matches;
}

Deno.serve(withObs(async (req) => {
  const requestId = getRequestId(req) ?? crypto.randomUUID();
  const maybeHealth = maybeHandleHealth(req, "groups-match");
  if (maybeHealth) {
    return maybeHealth;
  }

  if (req.method !== "GET") {
    return jsonResponse({ ok: false, error: "GET only" }, { status: 405 });
  }

  const url = new URL(req.url);
  const groupId = url.searchParams.get("group_id")?.trim();
  if (!groupId) {
    return jsonResponse({ ok: false, error: "group_id is required" }, {
      status: 400,
    });
  }

  const limit = parseLimit(url.searchParams.get("limit"));
  const matches = normalizeMatches(groupId).slice(0, limit);

  audit({
    requestId,
    groupId,
    limit,
    matches: matches.length,
    clustersExamined: clusters.length,
  });

  return jsonResponse({
    ok: true,
    request_id: requestId,
    group_id: groupId,
    matches,
  });
}, { fn: "groups-match", defaultErrorCode: ERROR_CODES.UNKNOWN }));
