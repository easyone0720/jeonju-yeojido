/**
 * 띠 계산(한국 음력 설 경계).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import KoreanLunarCalendar from 'korean-lunar-calendar';
import { getZodiacCode } from '../../src/utils/zodiacMotif.ts';

describe('띠 계산 — 음력 설이 해의 경계', () => {
  // [설 전날, 설날, 설 전날 띠, 설날 띠]
  const cases: Array<[string, string, string, string]> = [
    ['1990-01-26', '1990-01-27', 'snake', 'horse'],
    ['2000-02-04', '2000-02-05', 'rabbit', 'dragon'],
    ['2020-01-24', '2020-01-25', 'pig', 'rat'],
    ['2023-01-21', '2023-01-22', 'tiger', 'rabbit'],
    ['2024-02-09', '2024-02-10', 'rabbit', 'dragon'],
  ];
  for (const [eve, newYear, before, after] of cases) {
    it(`${eve} → ${before}, ${newYear}(설) → ${after}`, () => {
      assert.equal(getZodiacCode(eve), before);
      assert.equal(getZodiacCode(newYear), after);
    });
  }

  it('양력 1월 1일은 설 이전이므로 전년도 띠 (양력 연도 % 12 와 다름)', () => {
    assert.equal(getZodiacCode('2000-01-01'), 'rabbit'); // 양력 2000 % 12 계산이면 dragon
    assert.equal(getZodiacCode('1988-01-01'), 'rabbit'); // 1988 무진년 설은 2/18
  });

  it('라이브러리의 간지 연도와 일치한다 (2023-01-22 = 계묘년)', () => {
    const cal = new KoreanLunarCalendar();
    assert.equal(cal.setSolarDate(2023, 1, 22), true);
    assert.equal(cal.getKoreanGapja().year, '계묘년');
  });

  it('형식 오류·지원 범위 밖·없는 날짜는 null (서사 소재 없이 진행)', () => {
    for (const bad of ['', 'abc', '1990/01/27', '0999-12-31', '2051-01-01', '2023-02-30']) {
      assert.equal(getZodiacCode(bad), null, bad);
    }
  });
});
