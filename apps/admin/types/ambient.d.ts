declare module '@sentry/nextjs' {
  export function init(options: Record<string, unknown>): void;
  export * from '@sentry/types';
}

declare module '@supabase/auth-helpers-nextjs' {
  import type { SupabaseClient } from '@supabase/supabase-js';

  type CookieAdapter = {
    get(name: string): string | undefined;
    set(...args: unknown[]): void;
    remove(...args: unknown[]): void;
  };

  export function createServerClient<Database>(
    supabaseUrl: string,
    supabaseKey: string,
    options: { cookies: CookieAdapter },
  ): SupabaseClient<Database>;

  export function createMiddlewareClient<Database>(context: {
    req: unknown;
    res: unknown;
  }): SupabaseClient<Database>;
}

declare module '@supabase/auth-helpers-react' {
  export {}; // placeholder to satisfy TypeScript when the helper is not used directly
}
