import { QueryClient, type DefaultOptions, type Query } from "@tanstack/react-query";

export const SUPABASE_STALE_TIME_MS = 2 * 60 * 1000;
export const SUPABASE_GC_TIME_MS = 12 * 60 * 60 * 1000;
export const SUPABASE_REFETCH_INTERVAL_MS = 5 * 60 * 1000;

export interface SupabaseQueryMeta extends Record<string, unknown> {
  source: "supabase";
  entity?: string;
}

export interface SupabaseCachingOptions {
  staleTime?: number;
  gcTime?: number;
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
  refetchOnReconnect?: boolean | "always";
  refetchOnWindowFocus?: boolean;
  retry?: number;
  networkMode?: "online" | "offlineFirst" | "always";
  meta?: SupabaseQueryMeta;
}

export function withSupabaseCaching(
  overrides?: Partial<Omit<SupabaseCachingOptions, "meta">> & { entity?: string; meta?: SupabaseCachingOptions["meta"] }
): SupabaseCachingOptions {
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
    },
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

  return client;
}
