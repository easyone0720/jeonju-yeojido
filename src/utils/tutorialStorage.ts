export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const TUTORIAL_HIDE_UNTIL_KEY = 'jeonsaeng_tutorial_hide_until_v1';

function resolveStorage(customStorage?: StorageLike): StorageLike | null {
  if (customStorage) {
    return customStorage;
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Returns epoch ms for the upcoming local midnight (00:00:00.000 of the next calendar day
 * in the user's browser/runtime local timezone).
 */
export function getNextLocalMidnightMs(now: Date = new Date()): number {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    0
  ).getTime();
}

/**
 * Returns true if the tutorial popup should be shown at `now`.
 * Hidden strictly until local midnight; expired, malformed, or inaccessible storage
 * safely defaults to showing the tutorial without throwing.
 */
export function shouldShowTutorial(
  now: Date = new Date(),
  customStorage?: StorageLike
): boolean {
  const storage = resolveStorage(customStorage);
  if (!storage) {
    return true;
  }

  try {
    const raw = storage.getItem(TUTORIAL_HIDE_UNTIL_KEY);
    if (!raw) {
      return true;
    }
    const hideUntilMs = Number(raw);
    if (!Number.isFinite(hideUntilMs) || hideUntilMs <= 0) {
      storage.removeItem(TUTORIAL_HIDE_UNTIL_KEY);
      return true;
    }
    if (now.getTime() < hideUntilMs) {
      return false;
    }
    // Expired past local midnight — clean up and allow tutorial again
    storage.removeItem(TUTORIAL_HIDE_UNTIL_KEY);
    return true;
  } catch {
    return true;
  }
}

/**
 * Persists local midnight cutoff so tutorial remains hidden for the rest of today.
 */
export function hideTutorialForToday(
  now: Date = new Date(),
  customStorage?: StorageLike
): number {
  const hideUntilMs = getNextLocalMidnightMs(now);
  const storage = resolveStorage(customStorage);
  if (storage) {
    try {
      storage.setItem(TUTORIAL_HIDE_UNTIL_KEY, String(hideUntilMs));
    } catch {
      // Ignore storage quota or restricted private browsing failures cleanly
    }
  }
  return hideUntilMs;
}

export function clearTutorialHide(customStorage?: StorageLike): void {
  const storage = resolveStorage(customStorage);
  if (!storage) return;
  try {
    storage.removeItem(TUTORIAL_HIDE_UNTIL_KEY);
  } catch {
    // Ignore
  }
}
