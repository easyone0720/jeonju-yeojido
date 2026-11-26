import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPortraitPrompt,
  generatePortrait,
  GEMINI_API_BASE,
  pickVoice,
  POLLINATIONS_URL,
  VOICE_FEMALE,
  VOICE_MALE,
} from '../../src/utils/freeMedia.ts';

const png = Buffer.alloc(2048, 1);
const imageRes = () => new Response(png, { status: 200, headers: { 'content-type': 'image/jpeg' } });

const geminiOk = () =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('초상화 생성 우선순위 (Gemini → Pollinations → null)', () => {
  it('GEMINI_API_KEY 가 있으면 gemini-2.5-flash-image 를 먼저, IMAGE 모달리티로 호출한다', async () => {
    const calls: Array<{ url: string; body: any; key: string | null }> = [];
    const img = await generatePortrait('선비', {
      geminiKey: 'k',
      fetchImpl: (async (u: string, init: RequestInit) => {
        calls.push({ url: String(u), body: JSON.parse(String(init.body)), key: (init.headers as Record<string, string>)['x-goog-api-key'] });
        return geminiOk();
      }) as unknown as typeof fetch,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `${GEMINI_API_BASE}/gemini-2.5-flash-image:generateContent`);
    assert.deepEqual(calls[0].body.generationConfig.responseModalities, ['IMAGE']);
    assert.equal(calls[0].key, 'k');
    assert.equal(img?.mimeType, 'image/png');
    assert.equal(img?.data.length, png.length);
  });

  it('GEMINI_IMAGE_MODEL 로 모델을 바꿀 수 있다', async () => {
    let url = '';
    await generatePortrait('선비', {
      geminiKey: 'k',
      geminiModel: 'gemini-x',
      fetchImpl: (async (u: string) => { url = String(u); return geminiOk(); }) as unknown as typeof fetch,
    });
    assert.ok(url.includes('/gemini-x:generateContent'));
  });

  it('Gemini 가 429 면 Pollinations 를 1회만 호출한다', async () => {
    const urls: string[] = [];
    const img = await generatePortrait('선비', {
      geminiKey: 'k',
      fetchImpl: (async (u: string) => {
        urls.push(String(u));
        return String(u).startsWith(GEMINI_API_BASE) ? new Response('quota', { status: 429 }) : imageRes();
      }) as unknown as typeof fetch,
    });
    assert.ok(img);
    assert.equal(urls.length, 2);
    assert.ok(urls[1].startsWith(POLLINATIONS_URL));
    assert.match(urls[1], /width=768&height=1024&model=flux&nologo=true/);
  });

  it('키가 없거나 예시값이면 Gemini 를 건너뛰고 Pollinations 만 쓴다', async () => {
    for (const geminiKey of [undefined, '', 'MY_GEMINI_API_KEY']) {
      const urls: string[] = [];
      await generatePortrait('선비', {
        geminiKey,
        fetchImpl: (async (u: string) => { urls.push(String(u)); return imageRes(); }) as unknown as typeof fetch,
      });
      assert.equal(urls.length, 1);
      assert.ok(urls[0].startsWith(POLLINATIONS_URL));
    }
  });

  it('Gemini 응답에 이미지가 없으면 실패로 보고 Pollinations 로 넘어간다', async () => {
    let n = 0;
    const img = await generatePortrait('선비', {
      geminiKey: 'k',
      fetchImpl: (async () => (++n === 1 ? new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'no' }] } }] }), { status: 200 }) : imageRes())) as unknown as typeof fetch,
    });
    assert.ok(img);
    assert.equal(n, 2);
  });

  it('둘 다 실패하면 null (재시도 없음)', async () => {
    let calls = 0;
    const img = await generatePortrait('선비', {
      geminiKey: 'k',
      fetchImpl: (async () => { calls++; return new Response('x', { status: 500 }); }) as unknown as typeof fetch,
    });
    assert.equal(img, null);
    assert.equal(calls, 2); // Gemini 1회 + Pollinations 1회
  });

  it('이미지가 아닌 응답은 실패로 본다', async () => {
    const img = await generatePortrait('선비', {
      fetchImpl: (async () => new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } })) as unknown as typeof fetch,
    });
    assert.equal(img, null);
  });

  it('Gemini 프롬프트에 고정 화풍 지침이 모두 들어간다', () => {
    const p = buildPortraitPrompt('a sly old scribe holding a brush', 'gemini');
    for (const k of ['fine dark ink brushwork', 'mineral pigments', 'empty warm aged hanji paper', 'waist-up three-quarter', 'indigo slate blue', 'double-line', 'no text'])
      assert.ok(p.includes(k), k);
    assert.ok(p.includes('a sly old scribe holding a brush'));
  });

  it('Pollinations 프롬프트는 길이 제한 안에서도 화풍을 남기고 장면을 자른다', () => {
    const p = buildPortraitPrompt('가'.repeat(2000), 'pollinations');
    assert.match(p, /^Late Joseon Korean ink and light mineral watercolor/);
    assert.ok(p.length <= 700);
  });
});

describe('낭독 음성 선택', () => {
  it('여성 단서면 SunHi, 남성 단서면 InJoon, 모호하면 SunHi', () => {
    assert.equal(pickVoice('한복을 입은 어머니와 낭자'), VOICE_FEMALE);
    assert.equal(pickVoice('갓을 쓴 선비와 장군, 대감'), VOICE_MALE);
    assert.equal(pickVoice('풍경'), VOICE_FEMALE);
  });
});
