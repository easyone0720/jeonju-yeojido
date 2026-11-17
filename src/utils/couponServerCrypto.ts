import crypto from 'node:crypto';
import type { ClueSpotId } from '../types/jeonju.ts';
import { SPOT_BARCODE_PREFIX } from './couponBarcode.ts';

function getCouponSecret(): string {
  return (
    process.env.COUPON_HMAC_SECRET ||
    process.env.ADMIN_PASSCODE ||
    'jeonsaeng-jeonju-coupon-secret-2026'
  );
}

/**
 * Generates an unpredictable, verifiable CODE128-safe server barcode for live coupons.
 * Format: JSYJ-LV-<SPOT>-<RANDOM8>-<TAG4>
 */
export function generateLiveCouponBarcode(params: {
  spotId: ClueSpotId;
  userId: string;
  couponId: string;
}): string {
  const spotCode = SPOT_BARCODE_PREFIX[params.spotId] ?? 'JJ';
  const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
  const body = `JSYJ-LV-${spotCode}-${rand}`;
  const hmac = crypto
    .createHmac('sha256', getCouponSecret())
    .update(`${body}|${params.userId}|${params.couponId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
  return `${body}-${hmac}`;
}

export function verifyLiveCouponBarcodeSignature(params: {
  issueCode: string;
  userId: string;
  couponId: string;
}): boolean {
  const trimmed = params.issueCode.trim().toUpperCase();
  const match = /^(JSYJ-LV-[A-Z]{2}-[0-9A-F]{8})-([0-9A-F]{4})$/.exec(trimmed);
  if (!match) return false;
  const [, body, providedTag] = match;
  const expectedTag = crypto
    .createHmac('sha256', getCouponSecret())
    .update(`${body}|${params.userId}|${params.couponId}`)
    .digest('hex')
    .slice(0, 4)
    .toUpperCase();
  try {
    return crypto.timingSafeEqual(
      Buffer.from(providedTag, 'utf8'),
      Buffer.from(expectedTag, 'utf8')
    );
  } catch {
    return false;
  }
}
