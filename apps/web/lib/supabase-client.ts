import { createClient } from '@supabase/supabase-js';
import { getTableSessionHeader } from './table-session';

const SUPABASE_URL = 'https://elhlcdiosomutugpneoc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVsaGxjZGlvc29tdXR1Z3BuZW9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MDU3NTMsImV4cCI6MjA3NDQ4MTc1M30.d92ZJG5E_9r7bOlRLBXRI6gcB_7ERVbL-Elp7fk4avY';

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
