import { createClient } from '@supabase/supabase-js';
import type { TypedSupabaseClient, SupabaseClientOptions } from './types';
import { loadClientEnv, loadServerEnv } from '@icupa/config/env';

const resolveCredentials = (overrides?: SupabaseClientOptions, isServer = false) => {
  if (isServer) {
    const env = loadServerEnv();
    return {
      url: overrides?.supabaseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL,
      key: overrides?.supabaseKey ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }

  const env = loadClientEnv();
  return {
    url: overrides?.supabaseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL,
    key: overrides?.supabaseKey ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
};

const withSessionHeaders = (options?: SupabaseClientOptions) => {
  if (!options?.getHeaders) {
    return undefined;
  }
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    const extra = options.getHeaders();
    Object.entries(extra).forEach(([key, value]) => {
      if (value) {
        headers.set(key, value);
      }
    });
    return fetch(input, {
      ...init,
      headers,
    });
  };
};

export const createBrowserSupabaseClient = (overrides?: SupabaseClientOptions): TypedSupabaseClient => {
  const { url, key } = resolveCredentials(overrides, false);
  return createClient(url, key, {
    global: {
      fetch: withSessionHeaders(overrides),
    },
  });
};

export const createServerSupabaseClient = (overrides?: SupabaseClientOptions): TypedSupabaseClient => {
  const { url, key } = resolveCredentials(overrides, true);
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      fetch: withSessionHeaders(overrides),
    },
  });
};
