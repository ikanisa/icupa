import { createBrowserSupabaseClient } from '@icupa/db';
import type { TypedSupabaseClient } from '@icupa/db';

let client: TypedSupabaseClient | undefined;

export function getSupabaseBrowserClient(): TypedSupabaseClient {
  if (!client) {
    client = createBrowserSupabaseClient();
  }
  return client;
}
