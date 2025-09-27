import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import { loadConfig } from './config';

export type AnySupabaseClient = SupabaseClient<any, any, any>;

const config = loadConfig();

export const supabaseClient: AnySupabaseClient = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    headers: {
      'x-icupa-internal': 'agents-service'
    }
  }
});

export function assertNoSupabaseError<T>(result: { data: T; error: PostgrestError | null }, message: string): T {
  if (result.error) {
    throw new Error(`${message}: ${result.error.message}`);
  }

  return result.data;
}
