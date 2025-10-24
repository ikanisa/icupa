'use client';

import { useMemo } from 'react';
import { createBrowserSupabaseClient } from '@icupa/db';
import { useTableSession } from './table-session';

export function useSupabaseClient() {
  const { sessionId } = useTableSession();

  const client = useMemo(() => {
    return createBrowserSupabaseClient({
      getHeaders: () => {
        if (!sessionId) {
          return {};
        }
        return { 'x-icupa-session': sessionId };
      },
    });
  }, [sessionId]);

  return client;
}
