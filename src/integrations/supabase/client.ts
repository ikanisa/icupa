import { createBrowserSupabaseClient } from '@icupa/db';
import type { SupabaseClientOptions } from '@icupa/db';
import { getTableSessionHeader } from '@/lib/table-session';

const toEnvRecord = (input: Record<string, unknown>): Record<string, string | undefined> => {
  const entries = Object.entries(input).map(([key, value]) => [key, typeof value === 'string' ? value : undefined] as const);
  return Object.fromEntries(entries);
};

const clientOptions: SupabaseClientOptions = {
  env: {
    env: typeof import.meta !== 'undefined' ? toEnvRecord(import.meta.env as Record<string, unknown>) : undefined,
  },
  getHeaders: () => {
    if (typeof window === 'undefined') {
      return {};
    }
    const sessionId = getTableSessionHeader();
    if (!sessionId) {
      return {};
    }
    return { 'x-icupa-session': sessionId };
  },
};

export const supabase = createBrowserSupabaseClient(clientOptions);
