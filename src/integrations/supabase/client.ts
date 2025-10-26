import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { getTableSessionHeader } from '@/lib/table-session';

const env = import.meta.env as Record<string, string | undefined>;
const normalize = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed !== 'undefined' ? trimmed : undefined;
};
const url =
  normalize(env.VITE_SUPABASE_URL) ||
  normalize(env.NEXT_PUBLIC_SUPABASE_URL) ||
  '';
const anonKey =
  normalize(env.VITE_SUPABASE_ANON_KEY) ||
  normalize(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  '';

if (!url || !anonKey) {
  throw new Error(
    'Supabase environment is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running the app.',
  );
}

const authStorage = typeof window !== 'undefined' ? window.localStorage : undefined;

const withTableSession: typeof fetch = (input, init: RequestInit = {}) => {
  const headers = new Headers(init?.headers ?? {});
  if (typeof window !== 'undefined') {
    const sessionId = getTableSessionHeader();
    if (sessionId) {
      headers.set('x-icupa-session', sessionId);
    }
  }
  return fetch(input, { ...init, headers });
};

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: withTableSession,
  },
});
