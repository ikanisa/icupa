import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@icupa/types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;

export interface SupabaseClientOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  getHeaders?: () => Record<string, string>;
}
