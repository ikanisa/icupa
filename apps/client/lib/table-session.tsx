'use client';
/* eslint-disable react-refresh/only-export-components */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'icupa_table_session_id';

interface TableSessionContextValue {
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

const TableSessionContext = createContext<TableSessionContextValue | undefined>(undefined);

const safeRead = () => {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const safeWrite = (value: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (value) {
      window.localStorage.setItem(STORAGE_KEY, value);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage quota errors in low-storage contexts.
  }
};

export function TableSessionProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionIdState] = useState<string | null>(() => safeRead());
  const lastSeenRef = useRef<string | null>(sessionId);

  const setSessionId = useCallback((next: string | null) => {
    setSessionIdState(next);
    safeWrite(next);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('tableSession') ?? params.get('table_session') ?? params.get('session');
    if (fromQuery && fromQuery !== lastSeenRef.current) {
      lastSeenRef.current = fromQuery;
      setSessionId(fromQuery);
    }
  }, [setSessionId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handler = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setSessionIdState(event.newValue);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const value = useMemo(() => ({ sessionId, setSessionId }), [sessionId, setSessionId]);

  return <TableSessionContext.Provider value={value}>{children}</TableSessionContext.Provider>;
}

export function useTableSession() {
  const ctx = useContext(TableSessionContext);
  if (!ctx) {
    throw new Error('useTableSession must be used within a TableSessionProvider');
  }
  return ctx;
}
