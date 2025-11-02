import { useMemo } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";

export interface PrefetchQuery {
  key: QueryKey;
  fn: () => Promise<unknown>;
  staleTime?: number;
}

export interface UseIntentPrefetchOptions {
  route?: () => Promise<void>;
  queries?: PrefetchQuery[];
}

export const useIntentPrefetch = (options?: UseIntentPrefetchOptions) => {
  const queryClient = useQueryClient();
  const { route, queries = [] } = options ?? {};

  return useMemo(() => {
    return {
      trigger: () => {
        if (route) {
          void route();
        }
        queries.forEach(({ key, fn, staleTime }) => {
          void queryClient.prefetchQuery({ queryKey: key, queryFn: fn, staleTime: staleTime ?? 60_000 });
        });
      },
    };
  }, [queries, queryClient, route]);
};
