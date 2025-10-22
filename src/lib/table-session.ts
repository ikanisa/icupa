export interface StoredTableSession {
  id: string;
  tableId: string;
  locationId: string | null;
  expiresAt: string;
}

const STORAGE_KEY = 'icupa_table_session';
const TABLE_SESSION_EVENT = 'icupa:table-session';

const dispatchTableSessionEvent = (session: StoredTableSession | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(TABLE_SESSION_EVENT, { detail: session }));
};

export function getStoredTableSession(): StoredTableSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }
    
    const session = JSON.parse(stored) as StoredTableSession;
    const expiresAt = new Date(session.expiresAt);
    
    if (expiresAt.getTime() < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      dispatchTableSessionEvent(null);
      return null;
    }
    
    return session;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function storeTableSession(session: StoredTableSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  dispatchTableSessionEvent(session);
}

export function clearTableSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  dispatchTableSessionEvent(null);
}

export function getTableSessionHeader(): string | null {
  const session = getStoredTableSession();
  return session?.id || null;
}