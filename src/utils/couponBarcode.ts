import type { ClueSpotId, CouponRecord } from '../types/jeonju.ts';

export type CouponDisplayStatus =
  | 'locked'
  | 'available'
  | 'barcode_visible'
  | 'used'
  | 'expired'
  | 'verification_failed';

export const SPOT_BARCODE_PREFIX: Record<ClueSpotId, string> = {
  gyeonggijeon: 'GJ',
  jeollagamyeong: 'JG',
  wanpanbon: 'WP',
  nambu_market: 'NM',
};

export const COUPON_VALIDITY_DAYS: Record<ClueSpotId, number> = {
  gyeonggijeon: 7,
  jeollagamyeong: 7,
  wanpanbon: 7,
  nambu_market: 14,
};

function hashFnv32(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 6);
}

export function computeCouponExpiresAt(spotId: ClueSpotId, unlockedAtIso: string): string {
  const baseMs = Date.parse(unlockedAtIso);
  const safeMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  const days = COUPON_VALIDITY_DAYS[spotId] ?? 7;
  return new Date(safeMs + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isCouponExpired(expiresAt?: string, nowMs = Date.now()): boolean {
  if (!expiresAt) return false;
  const parsed = Date.parse(expiresAt);
  if (!Number.isFinite(parsed)) return false;
  return parsed <= nowMs;
}

export function resolveCouponBaseStatus(
  coupon: Pick<CouponRecord, 'unlocked' | 'used' | 'expiresAt'>,
  nowMs = Date.now()
): 'locked' | 'available' | 'used' | 'expired' {
  if (!coupon.unlocked) return 'locked';
  if (coupon.used) return 'used';
  if (isCouponExpired(coupon.expiresAt, nowMs)) return 'expired';
  return 'available';
}

export function getCouponStatusLabel(status: CouponDisplayStatus): string {
  switch (status) {
    case 'locked':
      return '미획득';
    case 'available':
      return '사용 가능';
    case 'barcode_visible':
      return '바코드 표시 중';
    case 'used':
      return '사용 완료';
    case 'expired':
      return '유효기간 만료';
    case 'verification_failed':
      return '검증 실패';
  }
}

export function formatCouponExpiryDate(expiresAt?: string, fallbackLabel?: string): string {
  if (!expiresAt) {
    return fallbackLabel || '유효기간 정보 없음';
  }
  const d = new Date(expiresAt);
  if (Number.isNaN(d.getTime())) {
    return fallbackLabel || '유효기간 정보 없음';
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day}까지`;
}

export function generateDemoBarcodeNumber(
  spotId: ClueSpotId,
  sessionId: string,
  unlockedAtIso: string
): string {
  const spotCode = SPOT_BARCODE_PREFIX[spotId] ?? 'JJ';
  const digest = hashFnv32(`${spotId}|${sessionId}|${unlockedAtIso}`);
  return `JSYJ-DEMO-${spotCode}-${digest}`;
}

export function isDemoBarcodeNumber(barcodeNumber?: string | null): boolean {
  if (!barcodeNumber) return false;
  return barcodeNumber.toUpperCase().includes('-DEMO-');
}
