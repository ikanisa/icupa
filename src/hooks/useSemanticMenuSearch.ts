import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MenuItem } from "@/data/menu";

interface SemanticSearchOptions {
  query: string;
  items: MenuItem[];
  locationId: string | null | undefined;
  tableSessionId: string | null | undefined;
  enabled: boolean;
  limit?: number;
  minScore?: number;
}

interface RpcSearchRow {
  item_id: string;
  similarity: number;
}

interface RpcSearchResponse {
  results?: RpcSearchRow[];
}

function normaliseQuery(input: string): string {
  return input.trim();
}

export function useSemanticMenuSearch({
  query,
  items,
  locationId,
  tableSessionId,
  enabled,
  limit = 10,
  minScore = 0.55,
}: SemanticSearchOptions) {
  const trimmedQuery = normaliseQuery(query);
  const shouldFetch =
    enabled &&
    typeof window !== "undefined" &&
    Boolean(locationId) &&
    trimmedQuery.length >= 3;

  const searchQuery = useQuery({
    queryKey: [
      "semantic-menu-search",
      locationId,
      tableSessionId,
      trimmedQuery,
      limit,
      minScore,
    ],
    enabled: shouldFetch,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<RpcSearchResponse>(
        "menu/search_items",
        {
          body: {
            query: trimmedQuery,
            limit,
            minScore,
          },
        },
      );

      if (error) {
        throw error;
      }

      return (data?.results ?? []).filter(
        (row): row is RpcSearchRow => typeof row?.item_id === "string",
      );
    },
  });

  const mappedResults = useMemo(() => {
    if (!searchQuery.data || searchQuery.data.length === 0) {
      return { matches: [] as MenuItem[], scores: {} as Record<string, number> };
    }

    const itemIndex = new Map(items.map((item) => [item.id, item]));
    const seen = new Set<string>();
    const matches: MenuItem[] = [];
    const scores: Record<string, number> = {};

    for (const row of searchQuery.data) {
      if (seen.has(row.item_id)) {
        continue;
      }
      const matchedItem = itemIndex.get(row.item_id);
      if (!matchedItem) {
        continue;
      }
      seen.add(row.item_id);
      matches.push(matchedItem);
      scores[matchedItem.id] = typeof row.similarity === "number" ? row.similarity : 0;
    }

    return { matches, scores };
  }, [items, searchQuery.data]);

  const attempted = shouldFetch && (searchQuery.isFetched || searchQuery.isFetching);
  const usedSemantic = attempted && mappedResults.matches.length > 0 && !searchQuery.isFetching;

  return {
    matches: mappedResults.matches,
    scores: mappedResults.scores,
    isFetching: searchQuery.isFetching,
    isError: searchQuery.isError,
    error: searchQuery.error,
    attempted,
    usedSemantic,
  };
}
