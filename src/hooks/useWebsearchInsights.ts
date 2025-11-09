import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withSupabaseCaching } from "@/lib/query-client";

export interface WebsearchQuery {
  id: string;
  query: string;
  agentType: string | null;
  results: Array<{ title: string; url: string; snippet: string }>;
  createdAt: string;
  latencyMs: number | null;
  source: string;
}

function normaliseResults(input: unknown): WebsearchQuery["results"] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry): entry is { title?: unknown; url?: unknown; snippet?: unknown } => typeof entry === "object" && entry !== null)
    .map((entry) => ({
      title: typeof entry.title === "string" ? entry.title : "",
      url: typeof entry.url === "string" ? entry.url : "",
      snippet: typeof entry.snippet === "string" ? entry.snippet : "",
    }))
    .filter((entry) => entry.title.length > 0 && entry.url.length > 0);
}

async function fetchWebsearchQueries(tenantId: string): Promise<WebsearchQuery[]> {
  const { data, error } = await supabase
    .from("websearch_queries")
    .select("id, query, agent_type, results, created_at, latency_ms, source")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    query: (row.query as string) ?? "",
    agentType: (row.agent_type as string) ?? null,
    results: normaliseResults(row.results),
    createdAt: row.created_at as string,
    latencyMs: row.latency_ms as number | null,
    source: (row.source as string) ?? "duckduckgo",
  }));
}

export function useWebsearchInsights(tenantId: string | null) {
  return useQuery({
    queryKey: ["supabase", "admin", "websearch", tenantId],
    queryFn: () => fetchWebsearchQueries(tenantId ?? ""),
    enabled: Boolean(tenantId),
    ...withSupabaseCaching({ entity: "websearch", staleTime: 60_000 }),
  });
}
