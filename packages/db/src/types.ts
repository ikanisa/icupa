import type { LoadEnvOptions } from '@icupa/config';
import type { SupabaseClient, SupabaseClientOptions as SupabaseJsClientOptions } from '@supabase/supabase-js';
import type { Database } from '@icupa/types/database';

export type TypedSupabaseClient = SupabaseClient<Database>;
export type SupabaseClientConfiguration = SupabaseJsClientOptions<'public'>;

export interface SupabaseClientOptions {
  supabaseUrl?: string;
  supabaseKey?: string;
  /**
   * Return additional headers (for example `x-icupa-session` or `Authorization`)
   * that should be attached to every Supabase request.
   */
  getHeaders?: () => Record<string, string | undefined>;
  /**
   * Additional configuration passed directly to `createClient`.
   */
  options?: SupabaseClientConfiguration;
  /**
   * Environment sources forwarded to the config parser.
   */
  env?: LoadEnvOptions;
}

export type DatabaseFunctions = Database['public']['Functions'];
export type RpcName = keyof DatabaseFunctions;
export type RpcArgs<TName extends RpcName> = DatabaseFunctions[TName] extends { Args: infer TArgs }
  ? TArgs
  : never;
export type RpcResponse<TName extends RpcName> = DatabaseFunctions[TName] extends { Returns: infer TReturns }
  ? TReturns
  : never;
export type RpcInvokeOptions = Parameters<TypedSupabaseClient['rpc']>[2];
