/**
 * 생년월일 → 12간지 코드 (브라우저 전용 계산).
 *
 * - 생년월일은 이 함수의 인자로만 쓰고 어디에도 저장·전송·로그하지 않는다. 결과로는 띠 코드만 나간다.
 * - 띠의 해 경계는 한국 음력 설(음력 1월 1일)이다. 'korean-lunar-calendar'(한국천문연구원 기준표)로
 *   양력 → 음력 변환한 음력 연도로 띠를 정한다. 양력 연도 % 12, 입춘 기준 계산을 쓰지 않는다.
 * - 지원 범위(양력 1000-02-13 ~ 2050-12-31) 밖이거나 변환에 실패하면 null → 띠 소재 없이 진행한다.
 * - 띠는 이야기 소재로만 쓰며 성격·운세·유형·캐릭터 판정에 쓰지 않는다.
 */
import KoreanLunarCalendar from 'korean-lunar-calendar';

/** 허용 띠 코드 12종 (zodiac_story_rules.zodiac_code 와 같은 값이어야 한다) */
export const ZODIAC_CODES = [
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig',
] as const;

export type ZodiacCode = (typeof ZODIAC_CODES)[number];

export function isZodiacCode(value: unknown): value is ZodiacCode {
  return typeof value === 'string' && (ZODIAC_CODES as readonly string[]).includes(value);
}

/** 'YYYY-MM-DD' 양력 날짜의 띠 코드. 형식 오류·지원 범위 밖·변환 실패면 null */
export function getZodiacCode(solarDate: string): ZodiacCode | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(solarDate);
  if (!m) return null;
  try {
    const calendar = new KoreanLunarCalendar();
    if (!calendar.setSolarDate(Number(m[1]), Number(m[2]), Number(m[3]))) return null;
    const lunarYear = calendar.getLunarCalendar().year;
    if (!Number.isInteger(lunarYear)) return null;
    // 음력 4년(갑자년)이 쥐띠 → (음력 연도 - 4) mod 12
    return ZODIAC_CODES[(((lunarYear - 4) % 12) + 12) % 12];
  } catch {
    return null;
  }
}
