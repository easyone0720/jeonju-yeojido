/**
 * 0단계 보존 테스트 공용 도구.
 * - 앱 코드는 수정하지 않는다. node 에 없는 브라우저 저장소만 대역으로 채운다.
 * - 다른 테스트 파일이 이미 window 대역을 만들었으면 그것을 그대로 쓴다(서로 덮어쓰지 않음).
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const FIXTURE_DIR = path.join(PROJECT_ROOT, 'tests/preservation/fixtures');

export function readFixture<T>(name: string): T {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8')) as T;
}

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, String(v));
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
}

type BrowserLike = {
  sessionStorage: { clear(): void; getItem(k: string): string | null };
  localStorage: { clear(): void; getItem(k: string): string | null };
  location: { origin: string; search?: string };
};

/** window 대역 준비 (없을 때만 만든다) */
export function ensureBrowserStubs(): void {
  const g = globalThis as unknown as { window?: BrowserLike };
  if (!g.window) {
    g.window = {
      sessionStorage: new MemoryStorage(),
      localStorage: new MemoryStorage(),
      location: { origin: 'http://localhost', search: '' },
    };
  }
}

/** 각 테스트 전에 브라우저 저장소를 비운다 (그 시점의 window 를 사용) */
export function clearBrowserStorage(): void {
  const w = (globalThis as unknown as { window: BrowserLike }).window;
  w.sessionStorage.clear();
  w.localStorage.clear();
}

export function sha256File(absPath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(absPath)).digest('hex');
}

export interface ManifestEntry {
  path: string;
  group: string;
  reason: string;
  bytes: number;
  sha256: string;
}

export interface ManifestProblem {
  path: string;
  problem: 'missing' | 'size' | 'hash';
}

/** 기준 해시와 실제 파일 비교. rootDir 를 바꾸면 임시 복사본을 검사할 수 있다. */
export function verifyManifest(entries: ManifestEntry[], rootDir: string): ManifestProblem[] {
  const problems: ManifestProblem[] = [];
  for (const e of entries) {
    const abs = path.join(rootDir, e.path);
    if (!fs.existsSync(abs)) {
      problems.push({ path: e.path, problem: 'missing' });
      continue;
    }
    if (fs.statSync(abs).size !== e.bytes) {
      problems.push({ path: e.path, problem: 'size' });
      continue;
    }
    if (sha256File(abs) !== e.sha256) problems.push({ path: e.path, problem: 'hash' });
  }
  return problems;
}

/**
 * 테스트용 가짜 생년월일 (기준 자료에 저장하지 않음).
 * 현재 등록 API 가 생년월일을 필수로 받기 때문에 실행 중에만 만들어 쓴다.
 */
export function syntheticBirthDate(i: number): string {
  const y = 1950 + (i % 60);
  const m = String((i % 12) + 1).padStart(2, '0');
  const d = String((i % 28) + 1).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
