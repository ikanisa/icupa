import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearTableSession,
  formatRemainingDuration,
  getStoredTableSession,
  getTimeUntilExpiration,
  isSessionExpired,
  storeTableSession,
  type StoredTableSession,
} from '../table-session';

const SESSION_ID = '11111111-2222-4333-8444-555555555555';
const TABLE_ID = '00000000-0000-4000-8000-000000000123';

describe('table-session utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));
    clearTableSession();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearTableSession();
  });

  it('persists and retrieves an active session', () => {
    const session: StoredTableSession = {
      id: SESSION_ID,
      tableId: TABLE_ID,
      locationId: 'loc-123',
      expiresAt: '2024-01-01T14:00:00Z',
    };

    storeTableSession(session);

    expect(getStoredTableSession()).toEqual(session);
  });

  it('drops expired sessions when reading from storage', () => {
    const expiredSession: StoredTableSession = {
      id: SESSION_ID,
      tableId: TABLE_ID,
      locationId: null,
      expiresAt: '2023-12-31T23:30:00Z',
    };

    storeTableSession(expiredSession);

    expect(getStoredTableSession()).toBeNull();
    expect(window.localStorage.getItem('icupa.table_session')).toBeNull();
  });

  it('calculates time until expiration relative to now', () => {
    expect(isSessionExpired('2023-12-31T23:30:00Z')).toBe(true);
    expect(isSessionExpired('2024-01-01T14:00:00Z')).toBe(false);

    const remainingMs = getTimeUntilExpiration('2024-01-01T12:45:00Z');
    expect(remainingMs).toBe(45 * 60 * 1000);
  });

  it('formats remaining durations for UI badges', () => {
    expect(formatRemainingDuration(null)).toBeNull();
    expect(formatRemainingDuration(-1)).toBe('less than 1 min');
    expect(formatRemainingDuration(2 * 60 * 1000)).toBe('2m');
    expect(formatRemainingDuration(60 * 60 * 1000)).toBe('1h');
    expect(formatRemainingDuration(90 * 60 * 1000)).toBe('1h 30m');
  });
});
