export interface StoredTableSession {
  id: string;
  tableId: string;
  locationId: string | null;
  expiresAt: string;
}

const STORAGE_KEY = 'icupa_table_session';

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
}

export function clearTableSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.removeItem(STORAGE_KEY);
}

export function getTableSessionHeader(): string | null {
  const session = getStoredTableSession();
  return session?.id || null;
}