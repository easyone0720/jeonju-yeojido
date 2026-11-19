/**
 * 초상 이미지 파일 저장소 (서버 전용).
 * base64 이미지를 SQLite JSON에 통째로 넣으면 세션/미디어월 응답이 수 MB로 커지므로,
 * 디스크(.data/portraits)에 저장하고 result.portraitDataUrl에는 '/api/portraits/<uuid>.<ext>' URL을 넣는다.
 * 파일명은 추측 불가능한 UUID(capability URL)이며, 서버는 이름 형식을 엄격히 검증한다.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const PORTRAIT_URL_PREFIX = '/api/portraits/';

const MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

const FILE_NAME_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$/;

export interface ParsedImage {
  mimeType: string;
  base64: string;
  buffer: Buffer;
}

/** data:image/(png|jpeg|webp);base64,... 만 허용하고, 디코딩 후 크기를 제한한다. */
export function parseImageDataUrl(dataUrl: unknown, maxBytes: number): ParsedImage | null {
  if (typeof dataUrl !== 'string') return null;
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex < 0) return null;
  const header = dataUrl.slice(0, commaIndex);
  const mimeMatch = /^data:(image\/(?:png|jpeg|webp));base64$/.exec(header);
  if (!mimeMatch) return null;
  const base64 = dataUrl.slice(commaIndex + 1);
  if (!base64 || Math.floor((base64.length * 3) / 4) > maxBytes) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return null;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0 || buffer.length > maxBytes) return null;
  return { mimeType: mimeMatch[1], base64, buffer };
}

export function savePortraitFile(dir: string, buffer: Buffer, mimeType: string): string {
  const ext = MIME_TO_EXT[mimeType] ?? 'png';
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${crypto.randomUUID()}.${ext}`;
  fs.writeFileSync(path.join(dir, fileName), buffer);
  return `${PORTRAIT_URL_PREFIX}${fileName}`;
}

/** 요청된 파일명이 안전한 형식이면 디스크 경로를 돌려준다. */
export function resolvePortraitPath(dir: string, fileName: string): string | null {
  if (!FILE_NAME_PATTERN.test(fileName)) return null;
  return path.join(dir, fileName);
}

/** '/api/portraits/...' URL이면 해당 파일을 삭제한다 (사용자 기록 삭제 시 호출). */
export function deletePortraitByUrl(dir: string, url: string | undefined | null): void {
  if (!url || !url.startsWith(PORTRAIT_URL_PREFIX)) return;
  const filePath = resolvePortraitPath(dir, url.slice(PORTRAIT_URL_PREFIX.length));
  if (!filePath) return;
  try {
    fs.rmSync(filePath, { force: true });
  } catch {
    // 파일 삭제 실패는 사용자 기록 삭제를 막지 않는다
  }
}
