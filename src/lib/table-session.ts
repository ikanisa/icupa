export interface StoredTableSession {
  id: string;
  tableId: string;
  locationId: string | null;
  expiresAt: string;
}

const STORAGE_KEY = "icupa.table_session";

function isExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return true;
  }
  return expiry.getTime() <= Date.now();
}

function safeParse(raw: string | null): StoredTableSession | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as StoredTableSession;
    if (!parsed.id || !parsed.expiresAt) {
      return null;
    }
    if (isExpired(parsed.expiresAt)) {
      return null;
    }
    return {
      id: parsed.id,
      tableId: parsed.tableId ?? "",
      locationId: parsed.locationId ?? null,
      expiresAt: parsed.expiresAt,
    };
  } catch (_error) {
    return null;
  }
}

export function getStoredTableSession(): StoredTableSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  const value = window.localStorage.getItem(STORAGE_KEY);
  const session = safeParse(value);
  if (!session && value) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return session;
}

export function storeTableSession(session: StoredTableSession): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearTableSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}

export function getTableSessionHeader(): string {
  const session = getStoredTableSession();
  return session?.id ?? "";
}
