export interface StoredTableSession {
  id: string;
  tableId: string;
  locationId: string | null;
  expiresAt: string;
}

const STORAGE_KEY = "icupa.table_session";
const MINUTE_IN_MS = 60_000;

export function isSessionExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return true;
  }
  return expiry.getTime() <= Date.now();
}

export function getTimeUntilExpiration(expiresAt: string): number | null {
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return null;
  }
  return expiry.getTime() - Date.now();
}

export function isSessionExpiringSoon(
  expiresAt: string,
  thresholdMinutes = 10,
): boolean {
  const remaining = getTimeUntilExpiration(expiresAt);
  if (remaining === null) {
    return false;
  }
  return remaining > 0 && remaining <= thresholdMinutes * MINUTE_IN_MS;
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
    if (isSessionExpired(parsed.expiresAt)) {
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

export function formatRemainingDuration(remainingMs: number | null): string | null {
  if (remainingMs === null) {
    return null;
  }
  if (remainingMs <= 0) {
    return "less than 1 min";
  }

  const totalMinutes = Math.ceil(remainingMs / MINUTE_IN_MS);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  return `${totalMinutes}m`;
}
