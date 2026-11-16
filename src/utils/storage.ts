import type { AppMode } from '../types/jeonju';

/**
 * Client-side localStorage must NEVER store sensitive personal information
 * (birthDate, plaintext recovery codes, or unverified auth backups).
 * Auth & session persistence live in server-side DB + HttpOnly Partitioned cookies,
 * with a RAM-only in-memory token fallback if a browser strictly blocks 3P iframe cookies.
 */

const LEGACY_SESSION_ID_KEY = 'jeonsaeng_session_id_v1';
const LEGACY_SESSION_BACKUP_KEY = 'jeonsaeng_session_backup_v1';

const inMemoryAuthTokens: Partial<Record<AppMode, string>> = {};

export function scrubLegacySensitiveStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.removeItem(LEGACY_SESSION_ID_KEY);
    window.localStorage.removeItem(LEGACY_SESSION_BACKUP_KEY);
  } catch {
    // Ignore storage unavailability
  }
}

export function setMemoryAuthToken(mode: AppMode, token: string | null | undefined): void {
  if (token) {
    inMemoryAuthTokens[mode] = token;
  } else {
    delete inMemoryAuthTokens[mode];
  }
}

export function clearMemoryAuthToken(mode: AppMode): void {
  delete inMemoryAuthTokens[mode];
}

export function getAuthHeaders(mode: AppMode): Record<string, string> {
  const token = inMemoryAuthTokens[mode];
  return token ? { 'x-jeonsaeng-token': token } : {};
}
