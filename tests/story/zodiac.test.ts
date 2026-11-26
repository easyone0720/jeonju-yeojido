/**
 * 띠 코드 계산 (한국 음력 설 경계, korean-lunar-calendar). 경계일은 라이브러리의 간지 연도로도 대조한다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { ZODIAC_CODES, getZodiacCode, isZodiacCode } from '../../src/utils/zodiacMotif.ts';

/** 라이브러리 간지 연도(예: '계묘년')의 지지 글자로 띠를 다시 구한다 — 테스트 기대값을 손으로 적지 않기 위해 */
const BRANCH_TO_CODE: Record<string, string> = {
  자: 'rat', 축: 'ox', 인: 'tiger', 묘: 'rabbit', 진: 'dragon', 사: 'snake',
  오: 'horse', 미: 'goat', 신: 'monkey', 유: 'rooster', 술: 'dog', 해: 'pig',
};
function libraryZodiac(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const cal = new KoreanLunarCalendar();
  assert.equal(cal.setSolarDate(y, m, d), true, date);
  return BRANCH_TO_CODE[cal.getKoreanGapja().year.charAt(1)];
}

describe('띠 계산 — 음력 설이 해의 경계', () => {
  // [설 전날, 설날] — 1~2월 설 전후
  const boundaries: Array<[string, string]> = [
    ['1990-01-26', '1990-01-27'],
    ['2000-02-04', '2000-02-05'],
    ['2015-02-18', '2015-02-19'],
    ['2020-01-24', '2020-01-25'],
    ['2023-01-21', '2023-01-22'],
    ['2024-02-09', '2024-02-10'],
  ];
  for (const [eve, newYear] of boundaries) {
    it(`${eve} / ${newYear}`, () => {
      const before = getZodiacCode(eve);
      const after = getZodiacCode(newYear);
      assert.equal(before, libraryZodiac(eve));
      assert.equal(after, libraryZodiac(newYear));
      assert.notEqual(before, after, '설 전날과 설날의 띠는 달라야 한다');
      assert.equal(ZODIAC_CODES.indexOf(after!), (ZODIAC_CODES.indexOf(before!) + 1) % 12);
    });
  }

  it('2015-02-19(설) 은 양띠 코드 goat', () => {
    assert.equal(getZodiacCode('2015-02-19'), 'goat');
  });

  it('양력 1월 1일은 설 이전이라 전년도 띠 (양력 연도 % 12 와 다름)', () => {
    assert.equal(getZodiacCode('2000-01-01'), libraryZodiac('2000-01-01'));
    assert.notEqual(getZodiacCode('2000-01-01'), ZODIAC_CODES[(2000 - 4) % 12]);
  });

  it('형식 오류·지원 범위 밖·없는 날짜는 null', () => {
    for (const bad of ['', 'abc', '1990/01/27', '0999-12-31', '2051-01-01', '2023-02-30']) {
      assert.equal(getZodiacCode(bad), null, bad);
    }
  });

  it('허용 코드 12종', () => {
    assert.equal(ZODIAC_CODES.length, 12);
    assert.equal(isZodiacCode('goat'), true);
    assert.equal(isZodiacCode('sheep'), false);
    assert.equal(isZodiacCode('tiger-3'), false);
  });
});
