/**
 * 무료 미디어 생성 — 낭독 음성(msedge-tts)과 초상화(Gemini 무료 티어 → Pollinations → 기존 캐릭터 초상화).
 * 서버(server.ts, api/past-life/story.ts)에서만 쓴다. 외부 의존은 npm 패키지와 fetch 뿐이다.
 *
 * 초상화 우선순위
 *  1. Gemini gemini-2.5-flash-image (GEMINI_API_KEY, 무료 티어) — generateContent, responseModalities: ['IMAGE']
 *  2. 1순위가 429(분당 한도)·오류로 실패하면 Pollinations.ai 를 1회 호출
 *  3. 둘 다 실패하면 null → 호출 측이 같은 유형의 기존 캐릭터 초상화(/characters/NN.jpg)로 대체한다
 */

/**
 * 초상화 미술 디렉션 — public/characters/01~10.jpg 와 같은 화풍으로 고정한다. (image_prompt 는 인물·표정·소품만 담당)
 * 화풍: 조선 후기 초상화·풍속화. 먹선 위에 옅은 광물 안료. 배경은 빈 한지.
 */
export const PORTRAIT_STYLE_EN = [
  'Late Joseon Korean portrait and genre painting: fine dark ink brushwork with thin brown fine-brush outlines,',
  'colored with muted natural mineral pigments in a light, transparent watercolor wash.',
  'Clean empty warm aged hanji paper background in ivory and beige with subtle vertical paper fibers; no buildings, no landscape, no scenery.',
  'Restrained palette only: indigo slate blue, faded terracotta red, muted sage green, raw hemp beige, charcoal ink.',
  'Composition: waist-up three-quarter angle portrait of one person (not a frontal ID-photo pose), centered with generous hanji margin.',
  'The face shows the story humor — a sly smile, mischievous eyes or a pretend-serious look — and the person holds or wears the key props of the story.',
  'Frame: a thin double-line chamfered ink border inset in the outer hanji margin with faint vermilion traditional corner ornaments.',
  'Absolutely no text, no letters, no hanja, no seal stamp, no signature, no watermark.',
  'Forbidden: 3D gloss, digital airbrush, neon or saturated primary colors, photorealism, modern objects.',
].join(' ');

/** Pollinations 는 프롬프트가 URL 에 들어가므로 같은 지침을 줄여서 쓴다 */
export const PORTRAIT_STYLE_SHORT =
  'Late Joseon Korean ink and light mineral watercolor portrait on empty aged ivory hanji paper, waist-up three-quarter view, muted indigo terracotta sage hemp charcoal palette, thin double-line border, no text, no seal, no watermark, no background scenery';

export const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
export const DEFAULT_GEMINI_IMAGE_MODEL = 'gemini-2.5-flash-image';
export const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt/';

export interface ImageResult {
  data: Buffer;
  mimeType: string;
}

const GEMINI_STEP_MS = 30_000;
const PROMPT_MAX = 700; // Pollinations 는 프롬프트가 URL 에 들어가므로 길이를 제한한다
const GEMINI_PROMPT_MAX = 4000;

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function withLimit(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timer = AbortSignal.timeout(ms);
  return signal ? AbortSignal.any([signal, timer]) : timer;
}

class HttpError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function readImage(res: Response, source: string): Promise<ImageResult> {
  if (!res.ok) {
    // 한도 초과(Pollinations 무료: IP당 45초에 1장)·결제 필요(402) 같은 이유를 로그에 남긴다
    const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 160);
    throw new HttpError(`${source} HTTP ${res.status}${body ? ` ${body}` : ''}`, res.status);
  }
  const mimeType = (res.headers.get('content-type') ?? '').split(';')[0].trim();
  if (!mimeType.startsWith('image/')) throw new Error(`${source} 응답이 이미지가 아닙니다 (${mimeType || 'content-type 없음'})`);
  const data = Buffer.from(await res.arrayBuffer());
  if (data.length < 1024) throw new Error(`${source} 이미지가 너무 작습니다 (${data.length}B)`);
  return { data, mimeType };
}

/** 장면(image_prompt) + 고정 화풍. kind 에 따라 길이를 맞춘다 (gemini: 전체 지침, pollinations: 축약) */
export function buildPortraitPrompt(imagePrompt: string, kind: 'gemini' | 'pollinations' = 'pollinations'): string {
  const scene = imagePrompt.replace(/\s+/g, ' ').trim();
  if (kind === 'gemini') return `${PORTRAIT_STYLE_EN}

Scene: ${scene}`.slice(0, GEMINI_PROMPT_MAX);
  // 축약 화풍은 항상 남기고 장면을 남은 길이만큼 자른다
  return `${PORTRAIT_STYLE_SHORT}. ${scene.slice(0, Math.max(0, PROMPT_MAX - PORTRAIT_STYLE_SHORT.length - 2))}`;
}

export interface PortraitOptions {
  /** 비어 있거나 예시값(MY_...)이면 Gemini 단계를 건너뛴다 */
  geminiKey?: string;
  geminiModel?: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  log?: (message: string) => void;
}

/** Gemini generateContent 응답에서 첫 인라인 이미지를 꺼낸다 */
async function geminiImage(prompt: string, key: string, model: string, doFetch: typeof fetch, signal: AbortSignal): Promise<ImageResult> {
  const res = await doFetch(`${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } },
    }),
    signal,
  });
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
    throw new HttpError(`Gemini HTTP ${res.status} ${body}`, res.status);
  }
  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }> } }>;
  };
  for (const part of json.candidates?.[0]?.content?.parts ?? []) {
    const data = part.inlineData?.data ?? part.inline_data?.data;
    const mimeType = part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? 'image/png';
    if (data && mimeType.startsWith('image/')) return { data: Buffer.from(data, 'base64'), mimeType };
  }
  throw new Error('Gemini 응답에 이미지 데이터가 없습니다');
}

/** 초상화 1장. 모든 외부 호출이 실패하면 null (오류는 던지지 않는다) */
export async function generatePortrait(imagePrompt: string, opts: PortraitOptions = {}): Promise<ImageResult | null> {
  const doFetch = opts.fetchImpl ?? fetch;
  const log = opts.log ?? (() => {});
  const key = (opts.geminiKey ?? '').trim();

  if (key && !/^MY_/i.test(key)) {
    const model = opts.geminiModel?.trim() || DEFAULT_GEMINI_IMAGE_MODEL;
    const t0 = Date.now();
    try {
      const img = await geminiImage(buildPortraitPrompt(imagePrompt, 'gemini'), key, model, doFetch, withLimit(opts.signal, GEMINI_STEP_MS));
      log(`portrait source=gemini model=${model} ${Date.now() - t0}ms ${img.data.length}B`);
      return img;
    } catch (err) {
      log(`portrait gemini 실패 ${Date.now() - t0}ms: ${describe(err)} → Pollinations 로 넘어갑니다`);
    }
  } else {
    log('portrait gemini 건너뜀: GEMINI_API_KEY 없음');
  }

  if (opts.signal?.aborted) return null;
  const t1 = Date.now();
  try {
    const url = `${POLLINATIONS_URL}${encodeURIComponent(buildPortraitPrompt(imagePrompt, 'pollinations'))}?width=768&height=1024&model=flux&nologo=true`;
    const res = await doFetch(url, { signal: opts.signal });
    const img = await readImage(res, 'Pollinations');
    log(`portrait source=pollinations ${Date.now() - t1}ms ${img.data.length}B`);
    return img;
  } catch (err) {
    log(`portrait pollinations 실패 ${Date.now() - t1}ms: ${describe(err)} → 기존 캐릭터 초상화로 대체`);
    return null;
  }
}

// ---------------------------------------------------------------------------------------------
// 낭독 음성
// ---------------------------------------------------------------------------------------------
export const VOICE_MALE = 'ko-KR-InJoonNeural';
export const VOICE_FEMALE = 'ko-KR-SunHiNeural';

const FEMALE_HINTS = /여인|여자|여성|할머니|어머니|아씨|낭자|소녀|처녀|부인|마님|기생|무당|규수|그녀|누이|딸|며느리|여왕|공주|she|woman|lady|girl|grandmother/i;
const MALE_HINTS = /남자|사내|선비|할아버지|아버지|도령|장군|대감|영감|소년|그는|아들|왕\b|man\b|he\b|boy|grandfather/i;

/** 서사의 분위기에 맞춰 남/여 신경망 음성을 고른다. 단서가 모호하면 따뜻한 여성 음성(SunHi) */
export function pickVoice(...texts: string[]): string {
  const joined = texts.join(' ');
  const f = (joined.match(new RegExp(FEMALE_HINTS, 'gi')) ?? []).length;
  const m = (joined.match(new RegExp(MALE_HINTS, 'gi')) ?? []).length;
  return m > f ? VOICE_MALE : VOICE_FEMALE;
}

/** 낭독 원고 → MP3. 오디오가 비면 null */
const RATE: Record<string, string> = { slow: '-18%', normal: '-8%', fast: '+4%' };
const PITCH: Record<string, string> = { low: '-6Hz', normal: '+0Hz', high: '+6Hz' };

export async function synthesizeSpeech(
  text: string,
  voice: string,
  signal?: AbortSignal,
  direction?: { rate?: string; pitch?: string },
): Promise<Buffer | null> {
  const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
  const tts = new MsEdgeTTS();
  const onAbort = () => tts.close();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    // 이야기꾼 호흡: 약간 느리게. 쉼표·말줄임표는 원고에서 표시한다
    const { audioStream } = tts.toStream(text, { rate: RATE[direction?.rate ?? 'normal'] ?? RATE.normal, pitch: PITCH[direction?.pitch ?? 'normal'] ?? PITCH.normal });
    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const audio = Buffer.concat(chunks);
    return audio.length > 0 ? audio : null;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    tts.close();
  }
}
