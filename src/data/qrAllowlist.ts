import type { SpotId } from '../types/jeonju.ts';

/**
 * Single authoritative allowlist of official Jeonju heritage spot QR URLs.
 * NOTE: Case-sensitive exact URL strings only (only leading/trailing whitespace is trimmed).
 * Never auto-follow redirects, normalize case, or accept query-modified variants.
 */
export const SPOT_QR_ALLOWLIST: Record<SpotId, string> = {
  gyeonggijeon: 'https://m.site.naver.com/2l46K',
  jeollagamyeong: 'https://m.site.naver.com/2l46J',
  wanpanbon: 'https://m.site.naver.com/2l46H',
  nambu_market: 'https://m.site.naver.com/2l46G',
  jeonju_museum: 'https://m.site.naver.com/2l46E',
};

const QR_URL_TO_SPOT_ID: Record<string, SpotId> = {
  [SPOT_QR_ALLOWLIST.gyeonggijeon]: 'gyeonggijeon',
  [SPOT_QR_ALLOWLIST.jeollagamyeong]: 'jeollagamyeong',
  [SPOT_QR_ALLOWLIST.wanpanbon]: 'wanpanbon',
  [SPOT_QR_ALLOWLIST.nambu_market]: 'nambu_market',
  [SPOT_QR_ALLOWLIST.jeonju_museum]: 'jeonju_museum',
};

/**
 * Connects external/spec spot ID aliases (e.g. 'jeolla_gamyeong') to the
 * canonical SpotId already persisted in the project database ('jeollagamyeong').
 */
export function canonicalizeSpotId(rawSpotId: string): SpotId | null {
  if (rawSpotId === 'jeolla_gamyeong') {
    return 'jeollagamyeong';
  }
  if (
    rawSpotId === 'gyeonggijeon' ||
    rawSpotId === 'jeollagamyeong' ||
    rawSpotId === 'wanpanbon' ||
    rawSpotId === 'nambu_market' ||
    rawSpotId === 'jeonju_museum'
  ) {
    return rawSpotId;
  }
  return null;
}

export type QrValidationErrorCode =
  | 'EMPTY_QR'
  | 'UNREGISTERED_QR'
  | 'WRONG_SPOT_QR';

export interface QrValidationResult {
  valid: boolean;
  matchedSpotId?: SpotId;
  canonicalQrUrl?: string;
  errorCode?: QrValidationErrorCode;
  error?: string;
}

/**
 * Strictly validates a decoded QR string against the 5-URL allowlist and expected spot.
 */
export function validateSpotQrCode(
  rawText: string,
  expectedSpotId?: SpotId
): QrValidationResult {
  const trimmed = typeof rawText === 'string' ? rawText.trim() : '';
  if (!trimmed) {
    return {
      valid: false,
      errorCode: 'EMPTY_QR',
      error: 'QR코드를 인식하지 못했습니다. 다시 시도해 주세요.',
    };
  }

  const matchedSpotId = QR_URL_TO_SPOT_ID[trimmed];
  if (!matchedSpotId) {
    return {
      valid: false,
      errorCode: 'UNREGISTERED_QR',
      error: '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.',
    };
  }

  if (expectedSpotId && matchedSpotId !== expectedSpotId) {
    return {
      valid: false,
      matchedSpotId,
      errorCode: 'WRONG_SPOT_QR',
      error: '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.',
    };
  }

  return {
    valid: true,
    matchedSpotId,
    canonicalQrUrl: SPOT_QR_ALLOWLIST[matchedSpotId],
  };
}
