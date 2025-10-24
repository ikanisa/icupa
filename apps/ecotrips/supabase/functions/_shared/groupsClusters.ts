import clustersFixture from "../../../ops/fixtures/groups_clusters.json" with {
  type: "json",
};

export interface ClusterSignal {
  type?: string;
  value?: unknown;
  [key: string]: unknown;
}

export interface ClusterCandidate {
  group_id: string;
  label?: string;
  status?: string;
  member_count?: number;
  similarity_score?: number;
  signals?: ClusterSignal[] | unknown[];
}

export interface ClusterRecommendation {
  suggestion_id: string;
  user_id: string;
  group_id: string;
  score?: number;
  reason?: string;
  signals?: ClusterSignal[] | unknown[];
}

export interface ClusterRecord {
  cluster_id: string;
  generated_at?: string;
  tags?: string[];
  anchor_group: {
    group_id: string;
    label?: string;
    itinerary_id?: string | null;
    status?: string;
    member_count?: number;
    region?: string | null;
    owner_id?: string | null;
  };
  metadata?: Record<string, unknown>;
  candidates?: ClusterCandidate[];
  recommendations?: ClusterRecommendation[];
}

interface RawClusters {
  clusters?: ClusterRecord[];
}

const raw = clustersFixture as RawClusters;
const clusterList = Array.isArray(raw.clusters) ? raw.clusters : [];

export const clusters: ClusterRecord[] = clusterList.map((cluster) => ({
  ...cluster,
  candidates: Array.isArray(cluster.candidates) ? cluster.candidates : [],
  recommendations: Array.isArray(cluster.recommendations)
    ? cluster.recommendations
    : [],
  tags: Array.isArray(cluster.tags) ? cluster.tags : [],
  metadata: typeof cluster.metadata === "object" && cluster.metadata
    ? cluster.metadata
    : {},
}));
