/**
 * 보존 1 — 캐릭터 ID·JSON 구조·자산 경로.
 * 이야기 문장(설정·대사 등)은 고정하지 않는다. 키·자료형·ID·경로만 지킨다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { ensureBrowserStubs, PROJECT_ROOT, readFixture } from './helpers.ts';

ensureBrowserStubs();
const { CHARACTERS } = await import('../../src/data/characters.ts');

type Shape = string | { [k: string]: Shape };
const fixture = readFixture<{
  ids: string[];
  entryShape: Shape;
  assets: Record<string, { image: string; audio: string }>;
}>('characters.schema.json');
const raw = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'src/data/charactersData.json'), 'utf8')) as Record<
  string,
  Record<string, unknown>
>;

function shapeOf(v: unknown): Shape {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  if (typeof v === 'object') {
    return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shapeOf(x)]));
  }
  return typeof v;
}

describe('보존: 캐릭터 데이터', () => {
  it('ID 는 01~10 의 10개이고 추가·삭제·변경이 없다', () => {
    assert.deepEqual(Object.keys(raw).sort(), fixture.ids);
    assert.deepEqual(fixture.ids, ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10']);
  });

  it('모든 항목의 키 구성과 자료형이 기준과 같다', () => {
    for (const id of fixture.ids) {
      assert.deepEqual(shapeOf(raw[id]), fixture.entryShape, `캐릭터 ${id} 구조가 바뀜`);
      assert.equal(raw[id].id, id, `캐릭터 ${id} 의 id 필드가 키와 다름`);
      for (const field of ['name', 'emoji', 'quote'] as const) {
        assert.ok(String(raw[id][field]).trim().length > 0, `캐릭터 ${id}.${field} 가 비어 있음`);
      }
    }
  });

  it('이미지·음성 경로가 기준과 같고 실제 파일이 있다', () => {
    for (const id of fixture.ids) {
      assert.equal(raw[id].image, fixture.assets[id].image);
      assert.equal(raw[id].audio, fixture.assets[id].audio);
      assert.equal(raw[id].image, `/characters/${id}.jpg`);
      assert.equal(raw[id].audio, `/characters/${id}.mp3`);
      assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'public', String(raw[id].image))), `${raw[id].image} 없음`);
      assert.ok(fs.existsSync(path.join(PROJECT_ROOT, 'public', String(raw[id].audio))), `${raw[id].audio} 없음`);
    }
  });

  it('로더(CHARACTERS)가 10종을 ID 순서대로 같은 경로로 내보낸다', () => {
    assert.deepEqual(
      CHARACTERS.map((c) => c.id),
      fixture.ids,
    );
    for (const c of CHARACTERS) {
      assert.equal(c.imageUrl, fixture.assets[c.id].image);
      assert.equal(c.audioUrl, fixture.assets[c.id].audio);
    }
  });
});
