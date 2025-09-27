import { createClient } from '@supabase/supabase-js';
import { getTableSessionHeader } from './table-session';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set.');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.');
}

const authStorage = typeof window === 'undefined' ? undefined : window.localStorage;

const withSessionHeader: typeof fetch = (input, init) => {
  const headers = new Headers(init?.headers ?? {});
  if (typeof window !== 'undefined') {
    const sessionId = getTableSessionHeader();
    if (sessionId) {
      headers.set('x-icupa-session', sessionId);
    }
  }
  return fetch(input, { ...init, headers });
};

export const supabaseBrowser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
  global: {
    fetch: withSessionHeader,
  },
});

export const supabase = supabaseBrowser;
