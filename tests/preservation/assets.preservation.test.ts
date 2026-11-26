/**
 * 보존 4 — 보호 대상 원본 자산의 해시.
 * 실패 감지 확인은 원본을 건드리지 않고 운영체제 임시 폴더의 복사본에서만 한다.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { ManifestEntry, PROJECT_ROOT, readFixture, verifyManifest } from './helpers.ts';

const manifest = readFixture<{ algorithm: string; count: number; entries: ManifestEntry[] }>('assets.manifest.json');

const tmpRoots: string[] = [];
after(() => {
  for (const dir of tmpRoots) fs.rmSync(dir, { recursive: true, force: true });
});

function copyToTemp(entries: ManifestEntry[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jeonsaeng-assets-'));
  tmpRoots.push(dir);
  for (const e of entries) {
    const dest = path.join(dir, e.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(PROJECT_ROOT, e.path), dest);
  }
  return dir;
}

describe('보존: 원본 자산 해시', () => {
  it('기준 목록 구성 (그룹별 개수)', () => {
    assert.equal(manifest.algorithm, 'sha256');
    assert.equal(manifest.entries.length, manifest.count);
    const byGroup: Record<string, number> = {};
    for (const e of manifest.entries) byGroup[e.group] = (byGroup[e.group] ?? 0) + 1;
    assert.deepEqual(byGroup, {
      'character-portrait': 11,
      'character-voice': 10,
      'goods-image': 14,
      'map-and-places': 7,
      'media-wall-video': 1,
    });
  });

  it('프로젝트의 보호 대상 파일이 모두 기준 해시와 같다', () => {
    assert.deepEqual(verifyManifest(manifest.entries, PROJECT_ROOT), []);
  });

  it('검사기가 변경·크기 변화·누락을 실제로 잡아낸다 (임시 복사본에서만 확인)', () => {
    const sample = [
      manifest.entries.find((e) => e.group === 'character-portrait')!,
      manifest.entries.find((e) => e.group === 'goods-image')!,
      manifest.entries.find((e) => e.group === 'character-voice')!,
    ];
    const tmp = copyToTemp(sample);
    assert.deepEqual(verifyManifest(sample, tmp), [], '복사 직후에는 같아야 함');

    // 1) 같은 크기로 바이트 하나만 바꿈 → 해시 불일치
    const p0 = path.join(tmp, sample[0].path);
    const buf = fs.readFileSync(p0);
    buf[buf.length - 1] = buf[buf.length - 1] ^ 0xff;
    fs.writeFileSync(p0, buf);
    // 2) 끝에 1바이트 추가 → 크기 불일치
    fs.appendFileSync(path.join(tmp, sample[1].path), Buffer.from([0]));
    // 3) 파일 삭제 → 누락
    fs.rmSync(path.join(tmp, sample[2].path));

    assert.deepEqual(verifyManifest(sample, tmp), [
      { path: sample[0].path, problem: 'hash' },
      { path: sample[1].path, problem: 'size' },
      { path: sample[2].path, problem: 'missing' },
    ]);
    // 원본은 그대로다
    assert.deepEqual(verifyManifest(sample, PROJECT_ROOT), []);
  });
});
