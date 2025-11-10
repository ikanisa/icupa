import { createClient } from '@supabase/supabase-js';
import type { Database } from './types/database.types';

export const createSupabaseClient = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables. Please check your .env file.');
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storage: typeof window !== 'undefined' ? window.localStorage : undefined
    },
    global: {
      headers: { 'x-application': 'icupa-web' }
    },
    db: { schema: 'public' },
    realtime: {
      params: { eventsPerSecond: 10 }
    }
  });
};

export const createSupabaseServerClient = (serviceRoleKey: string) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase server configuration');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' }
  });
};

let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createSupabaseClient();
  }
  return supabaseClient;
};

export const supabase = getSupabaseClient();
