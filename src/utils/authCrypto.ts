import crypto from 'node:crypto';

// Unambiguous uppercase alphanumeric set (excludes O/0, I/1/L)
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRecoveryCode(): string {
  const chars: string[] = [];
  for (let i = 0; i < 12; i += 1) {
    chars.push(RECOVERY_ALPHABET[crypto.randomInt(0, RECOVERY_ALPHABET.length)]);
  }
  return `JSYJ-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export function normalizeRecoveryCode(rawCode: string): string {
  const compact = rawCode.trim().toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (compact.length === 12) {
    return `JSYJ${compact}`;
  }
  return compact;
}

export function hashRecoveryCode(
  rawCode: string,
  providedSaltHex?: string
): { salt: string; hash: string } {
  const normalized = normalizeRecoveryCode(rawCode);
  const salt = providedSaltHex ?? crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(normalized, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyRecoveryCodeHash(
  rawCode: string,
  saltHex: string,
  expectedHashHex: string
): boolean {
  const normalized = normalizeRecoveryCode(rawCode);
  if (normalized.length !== 16 || !normalized.startsWith('JSYJ')) {
    return false;
  }
  try {
    const derived = crypto.scryptSync(normalized, saltHex, 64);
    const expected = Buffer.from(expectedHashHex, 'hex');
    if (derived.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function generateAuthToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashAuthToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseCookieHeader(
  cookieHeader: string | undefined
): Record<string, string> {
  if (!cookieHeader) return {};
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function serializeHttpOnlyCookie(params: {
  name: string;
  value: string;
  maxAgeSeconds: number;
  secure: boolean;
}): string {
  const segments = [
    `${params.name}=${encodeURIComponent(params.value)}`,
    'Path=/',
    'HttpOnly',
    params.secure ? 'SameSite=None' : 'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(params.maxAgeSeconds))}`,
  ];
  if (params.secure) {
    segments.push('Secure');
    segments.push('Partitioned');
  }
  return segments.join('; ');
}

export class SlidingWindowRateLimiter {
  private readonly maxAttempts: number;
  private readonly windowMs: number;
  private readonly buckets = new Map<string, number[]>();

  constructor(maxAttempts = 8, windowMs = 5 * 60 * 1000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  consume(key: string, nowMs = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
    const cutoff = nowMs - this.windowMs;
    const recent = (this.buckets.get(key) ?? []).filter((ts) => ts > cutoff);
    if (recent.length >= this.maxAttempts) {
      const oldest = recent[0];
      const retryAfterSeconds = Math.max(1, Math.ceil((oldest + this.windowMs - nowMs) / 1000));
      this.buckets.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }
    recent.push(nowMs);
    this.buckets.set(key, recent);
    return { allowed: true, retryAfterSeconds: 0 };
  }

  reset(key?: string): void {
    if (key) {
      this.buckets.delete(key);
    } else {
      this.buckets.clear();
    }
  }
}
