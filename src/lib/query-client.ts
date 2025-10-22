import {
  QueryClient,
  type DefaultOptions,
  type Query,
  type QueryKey,
  type QueryObserverOptions,
} from "@tanstack/react-query";

export const SUPABASE_STALE_TIME_MS = 2 * 60 * 1000;
export const SUPABASE_GC_TIME_MS = 12 * 60 * 60 * 1000;
export const SUPABASE_REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export interface SupabaseQueryMeta {
  source: "supabase";
  entity?: string;
}

type GenericQueryOptions = QueryObserverOptions<unknown, unknown, unknown, unknown, QueryKey>;

export function withSupabaseCaching(
  overrides?: Partial<Omit<GenericQueryOptions, "meta">> & { entity?: string; meta?: GenericQueryOptions["meta"] }
): Pick<
  GenericQueryOptions,
  | "staleTime"
  | "gcTime"
  | "refetchInterval"
  | "refetchIntervalInBackground"
  | "refetchOnReconnect"
  | "refetchOnWindowFocus"
  | "retry"
  | "networkMode"
  | "meta"
> {
  const { entity, meta, ...rest } = overrides ?? {};

  return {
    staleTime: SUPABASE_STALE_TIME_MS,
    gcTime: SUPABASE_GC_TIME_MS,
    refetchInterval: SUPABASE_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    retry: 2,
    networkMode: "offlineFirst",
    meta: {
      ...(meta ?? {}),
      source: "supabase",
      entity,
    } satisfies SupabaseQueryMeta,
    ...rest,
  };
}

const defaultOptions: DefaultOptions = {
  queries: {
    staleTime: SUPABASE_STALE_TIME_MS,
    gcTime: SUPABASE_GC_TIME_MS,
    refetchIntervalInBackground: true,
    refetchOnReconnect: "always",
    refetchOnWindowFocus: false,
    retry: 2,
    networkMode: "offlineFirst",
    refetchInterval: (query) =>
      isSupabaseQuery(query) ? SUPABASE_REFETCH_INTERVAL_MS : false,
  },
  mutations: {
    retry: 1,
    networkMode: "offlineFirst",
  },
};

function isSupabaseQuery(query: Query): boolean {
  const meta = query.meta as SupabaseQueryMeta | undefined;
  if (meta?.source === "supabase") {
    return true;
  }

  return query.queryKey.some((part) => {
    if (part === "supabase") {
      return true;
    }
    if (typeof part === "string") {
      return part.includes("supabase");
    }
    return false;
  });
}

export function createSupabaseQueryClient(): QueryClient {
  const client = new QueryClient({ defaultOptions });

  client.getQueryCache().subscribe((event) => {
    if (event?.type !== "queryAdded") {
      return;
    }

    const query = event.query;
    if (!isSupabaseQuery(query)) {
      return;
    }

    query.setOptions((current) => ({
      ...current,
      refetchInterval:
        current.refetchInterval ?? SUPABASE_REFETCH_INTERVAL_MS,
      refetchIntervalInBackground: true,
      staleTime:
        typeof current.staleTime === "number"
          ? current.staleTime
          : SUPABASE_STALE_TIME_MS,
      gcTime:
        typeof current.gcTime === "number" ? current.gcTime : SUPABASE_GC_TIME_MS,
      networkMode: current.networkMode ?? "offlineFirst",
    }));
  });

  return client;
}

