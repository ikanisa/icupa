import { createBrowserSupabaseClient } from '@icupa/db';
import type { SupabaseClientOptions } from '@icupa/db';
import { getTableSessionHeader } from './table-session';

const options: SupabaseClientOptions = {
  getHeaders: () => {
    if (typeof window === 'undefined') {
      return {};
    }
    const sessionId = getTableSessionHeader();
    return sessionId ? { 'x-icupa-session': sessionId } : {};
  },
};

export const supabaseBrowser = createBrowserSupabaseClient(options);
export const supabase = supabaseBrowser;
