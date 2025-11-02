import { createClient } from '@supabase/supabase-js';
import { loadClientEnv, loadServerEnv } from '@icupa/config';
import type { SupabaseClientOptions, TypedSupabaseClient } from './types';

interface SupabaseCredentials {
  url: string;
  key: string;
}

const resolveCredentials = (overrides: SupabaseClientOptions | undefined, isServer: boolean): SupabaseCredentials => {
  if (isServer) {
    const env = loadServerEnv(overrides?.env);
    return {
      url: overrides?.supabaseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL,
      key: overrides?.supabaseKey ?? env.SUPABASE_SERVICE_ROLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }

  const env = loadClientEnv(overrides?.env);
  return {
    url: overrides?.supabaseUrl ?? env.NEXT_PUBLIC_SUPABASE_URL,
    key: overrides?.supabaseKey ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
};

const resolveFetch = (overrides?: SupabaseClientOptions): typeof fetch | undefined => {
  const baseFetch = overrides?.options?.global?.fetch ?? (typeof fetch === 'function' ? fetch : undefined);

  if (!overrides?.getHeaders) {
    return baseFetch;
  }

  if (!baseFetch) {
    throw new Error('A fetch implementation is required to attach Supabase session headers.');
  }

  return async (input, init) => {
    const headers = new Headers(overrides.options?.global?.headers ?? undefined);

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headers.set(key, value);
      });
    }

    const extra = overrides.getHeaders();
    Object.entries(extra).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        headers.set(key, value);
      }
    });

    return baseFetch(input, {
      ...init,
      headers,
    });
  };
};

const buildClientOptions = (overrides: SupabaseClientOptions | undefined, isServer: boolean) => {
  const baseOptions = overrides?.options ?? {};
  const { auth: baseAuth, global: baseGlobal, ...other } = baseOptions;

  const auth = {
    ...(isServer
      ? { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      : { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }),
    ...baseAuth,
  };

  const fetchOverride = resolveFetch(overrides);
  const global =
    baseGlobal || fetchOverride
      ? { ...(baseGlobal ?? {}), ...(fetchOverride ? { fetch: fetchOverride } : {}) }
      : undefined;

  return {
    ...other,
    auth,
    ...(global ? { global } : {}),
  };
};

export const createBrowserSupabaseClient = (overrides?: SupabaseClientOptions): TypedSupabaseClient => {
  const credentials = resolveCredentials(overrides, false);
  const options = buildClientOptions(overrides, false);
  return createClient(credentials.url, credentials.key, options);
};

export const createServerSupabaseClient = (overrides?: SupabaseClientOptions): TypedSupabaseClient => {
  const credentials = resolveCredentials(overrides, true);
  const options = buildClientOptions(overrides, true);
  return createClient(credentials.url, credentials.key, options);
};
