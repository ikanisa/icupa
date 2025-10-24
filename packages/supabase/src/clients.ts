import { createRouteHandlerClient, createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@ecotrips/types/supabase";

import { getSupabaseConfig, type SupabaseConfigInput } from "./config";

type ServerFactoryContext = Parameters<typeof createServerComponentClient<Database>>[0];
type RouteFactoryContext = Parameters<typeof createRouteHandlerClient<Database>>[0];
type ServerFactoryOptions = NonNullable<Parameters<typeof createServerComponentClient<Database>>[1]>;
type RouteFactoryOptions = NonNullable<Parameters<typeof createRouteHandlerClient<Database>>[1]>;

type SharedFactoryOverrides<TOptions> = {
  config?: SupabaseConfigInput;
  options?: TOptions["options"];
  cookieOptions?: TOptions["cookieOptions"];
};

export type TypedSupabaseClient = SupabaseClient<Database>;

export function createServerSupabaseClient(
  context: ServerFactoryContext,
  overrides: SharedFactoryOverrides<ServerFactoryOptions> = {},
): TypedSupabaseClient {
  const config = getSupabaseConfig(overrides.config);
  return createServerComponentClient<Database>(context, {
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseKey,
    options: overrides.options,
    cookieOptions: overrides.cookieOptions,
  });
}

export function createRouteHandlerSupabaseClient(
  context: RouteFactoryContext,
  overrides: SharedFactoryOverrides<RouteFactoryOptions> = {},
): TypedSupabaseClient {
  const config = getSupabaseConfig(overrides.config);
  return createRouteHandlerClient<Database>(context, {
    supabaseUrl: config.supabaseUrl,
    supabaseKey: config.supabaseKey,
    options: overrides.options,
    cookieOptions: overrides.cookieOptions,
  });
}
