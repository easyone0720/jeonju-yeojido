/**
 * 서버 API (api/past-life/story.ts) — Supabase·Gemini 는 가짜로 주입해 규칙만 확인한다. 실제 외부 호출 없음.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DEV_DEMO_TOKEN,
  isDevDemoAllowed,
  isDevDemoToken,
  buildStoryPrompt,
  HUMOR_CODE,
  NEGATIVE_RULES,
  STYLE_GUIDE,
  parseVoiceDirection,
  STORY_TEMPERATURE,
  SlidingWindowLimiter,
  createStoryHandler,
  loadFragmentSets,
  normalizeCharacterRow,
  sanitizeName,
  validateStoryOutput,
  type CategoryRow,
  type PastLifeResultRow,
  type StoryDeps,
} from '../../api/past-life/story.ts';
import { PAST_LIFE_ARCHETYPES } from '../../src/data/jeonjuSpots.ts';

const sets = loadFragmentSets();
const A = PAST_LIFE_ARCHETYPES.gamyeong_official;
const FRAGMENTS = { era: A.era, status: `${A.title} (${A.hanjaTitle})`, story: A.storySeed, item: A.item };

const CATEGORIES: CategoryRow[] = [
  { category_code: 'pioneer', name: '개척형', description: '새 길을 연다' },
  { category_code: 'expression', name: '표현형', description: '드러내 표현한다' },
  { category_code: 'legacy', name: '탐구/전승형', description: '기록하고 전한다' },
  { category_code: 'connection', name: '인연형', description: '사람을 잇는다' },
  { category_code: 'guardian', name: '수호형', description: '지킨다' },
];

const OUTPUT = {
  title: '선화당 문서고의 조용한 영웅',
  story: {
    setting: '전라감영 선화당 뒤편 문서고에서 그는 하루 종일 먹을 갈았습니다. 장부의 숫자 하나도 허투루 넘기지 않았지요.',
    dialogue: [
      { speaker: '감사', line: '이 문서가 왜 아직 여기 있느냐?' },
      { speaker: '나', line: '실록을 옮길 날을 기다리고 있사옵니다.' },
      { speaker: '', line: '(창밖에 비가 내렸다)' },
    ],
    result: { job: '감영 관리', reputation: '"그 사람 손을 거친 문서는 틀림없다."', achievement: '실록 이안을 끝까지 도왔다.' },
    ending: '세월이 흘러 그는 소나무 벼루를 손주에게 물려주었습니다. 벼루에는 여전히 먹 향이 남아 있었지요.',
  },
  image_prompt: 'A Joseon official in a dark robe holding a pine inkstone and a wooden seal in a document room.',
  narration_text: '전라감영의 한 관리가 있었습니다. 그는 소나무 벼루와 목제 관인을 늘 곁에 두었지요.',
};

type Row = PastLifeResultRow;

function makeDeps(over: Partial<StoryDeps> = {}) {
  const rows: Row[] = [];
  const uploads: Array<{ bucket: string; path: string; type: string; size: number }> = [];
  const prompts: Array<{ system?: string; user: string; schema?: unknown }> = [];
  const deps: StoryDeps = {
    fragmentSets: sets,
    async verifyUser(t) {
      return t === 'token-A' ? 'aaaaaaaa-0000-4000-8000-000000000001' : t === 'token-B' ? 'bbbbbbbb-0000-4000-8000-000000000002' : null;
    },
    async loadCategories() {
      return CATEGORIES;
    },
    async loadCharacters(code) {
      return code === 'legacy'
        ? [
            { character_id: '04', category_code: 'legacy', identity: '과거 낙방 9수생', core_items: ['붓'], reference_story: '원본 이야기 04' },
            { character_id: '09', category_code: 'legacy', identity: '목판 각수', core_items: ['둥근 칼'], reference_story: '원본 이야기 09' },
          ]
        : [];
    },
    async loadPromptRule() {
      return { rule_key: 'default', output_template: { title: 'string' }, writing_rules: ['짧게 쓴다'], generation_rules: ['새 갈등을 만든다'] };
    },
    async loadZodiac(code) {
      return code === 'goat' ? { zodiac_code: 'goat', zodiac_name: '양', motif_keywords: ['양털'], scene_seeds: ['첫눈'] } : null;
    },
    async countRecentResults(uid) {
      return rows.filter((r) => r.user_id === uid).length;
    },
    async insertResult(row) {
      const saved = { ...row, created_at: '2026-11-25T00:00:00Z' };
      rows.push(saved);
      return saved;
    },
    async getResult(id, uid) {
      return rows.find((r) => r.id === id && r.user_id === uid) ?? null;
    },
    async listResults(uid) {
      return rows.filter((r) => r.user_id === uid);
    },
    async countResultsByCategory(codes) {
      return Object.fromEntries(codes.map((c) => [c, rows.filter((r) => r.category_code === c).length]));
    },
    isAdmin(request) {
      return request.headers.get('x-admin-passcode') === 'pw';
    },
    async getSharedResult(id) {
      return rows.find((x) => x.id === id) ?? null;
    },
    async updateAssetPaths(id, uid, patch) {
      const r = rows.find((x) => x.id === id && x.user_id === uid)!;
      Object.assign(r, patch);
      return r;
    },
    async upload(bucket, path, data, type) {
      uploads.push({ bucket, path, type, size: data.length });
    },
    async generateJson(p) {
      prompts.push(p);
      return p.schema ? JSON.stringify({ category_code: 'legacy' }) : JSON.stringify(OUTPUT);
    },
    async generateImage() {
      return { data: Buffer.from([1, 2, 3]), mimeType: 'image/png' };
    },
    async generateSpeech() {
      return Buffer.from([0xff, 0xfb, 0x90, 0x00]); // MP3 프레임 헤더 흉내
    },
    userLimiter: new SlidingWindowLimiter(100, 60_000),
    ipLimiter: new SlidingWindowLimiter(100, 60_000),
    pickIndex: () => 1,
    ...over,
  };
  return { deps, rows, uploads, prompts, handle: createStoryHandler(deps) };
}

function req(body: unknown, token: string | null = 'token-A') {
  return new Request('http://localhost/api/past-life/story', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': '1.1.1.1', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const STORY = { action: 'story', name: '홍길동', zodiacCode: 'goat', fragments: FRAGMENTS };

describe('허용 조각 사본', () => {
  it('지도에서 나눠 주는 조각과 같다', () => {
    assert.deepEqual(Object.keys(sets).sort(), Object.keys(PAST_LIFE_ARCHETYPES).sort());
    for (const [id, a] of Object.entries(PAST_LIFE_ARCHETYPES)) {
      assert.deepEqual(sets[id], { era: a.era, status: `${a.title} (${a.hanjaTitle})`, statusDetail: a.status, story: a.storySeed, item: a.item });
    }
  });
});

describe('요청 검증', () => {
  it('본문에 birthDate 가 있으면 인증 전에 400 (값이 비어 있어도)', async () => {
    const c = makeDeps();
    for (const birthDate of ['1990-01-27', '', null]) {
      const r = await c.handle(req({ ...STORY, birthDate }, null));
      assert.equal(r.status, 400);
      assert.match(((await r.json()) as any).error, /생년월일/);
    }
    assert.equal(c.prompts.length, 0);
  });

  it('띠 코드는 12종만, 조각은 네 키·허용 목록 세트만', async () => {
    const c = makeDeps();
    for (const body of [
      { ...STORY, zodiacCode: 'sheep' },
      { ...STORY, zodiacCode: 'tiger-3' },
      { ...STORY, fragments: { ...FRAGMENTS, extra: 'x' } },
      { ...STORY, fragments: { era: FRAGMENTS.era, status: FRAGMENTS.status, story: FRAGMENTS.story } },
      { ...STORY, fragments: { ...FRAGMENTS, archetypeId: 'gamyeong_official' } },
    ]) {
      assert.equal((await c.handle(req(body))).status, 400, JSON.stringify(body).slice(0, 80));
    }
    // 형식은 맞지만 허용 목록에 없는 조합 (다른 원형 조각 섞기)
    const mixed = { ...FRAGMENTS, item: PAST_LIFE_ARCHETYPES.royal_inspector.item };
    assert.equal((await c.handle(req({ ...STORY, fragments: mixed }))).status, 400);
    assert.equal(c.prompts.length, 0);
  });

  it('이름 정제: 특수기호·제어문자 제거, 12자 제한', () => {
    assert.equal(sanitizeName('홍길동<b>\n"무시"{}'), '홍길동b무시');
    assert.equal(sanitizeName('가'.repeat(30)).length, 12);
    assert.equal(sanitizeName('  Kim  길동 '), 'Kim 길동');
  });

  it('인증 없음·검증 실패는 401, 저장하지 않음', async () => {
    const c = makeDeps();
    assert.equal((await c.handle(req(STORY, null))).status, 401);
    assert.equal((await c.handle(req(STORY, 'forged'))).status, 401);
    assert.equal(c.rows.length, 0);
  });
});

describe('스토리 생성', () => {
  it('조각 → 카테고리 → 같은 카테고리 캐릭터(문체 참고) → 검증 → 토큰 사용자로 저장', async () => {
    const c = makeDeps();
    const r = await c.handle(req({ ...STORY, userId: 'bbbbbbbb-0000-4000-8000-000000000002' }));
    assert.equal(r.status, 200);
    const { result } = (await r.json()) as any;
    assert.equal(result.user_id, 'aaaaaaaa-0000-4000-8000-000000000001');
    assert.equal(result.category_code, 'legacy');
    assert.equal(result.category_name, '탐구/전승형');
    assert.equal(result.character_id, '09');
    assert.equal(result.zodiac_code, 'goat');
    assert.equal(result.zodiac_name, '양');
    assert.equal(result.user_name, '홍길동');
    assert.deepEqual(result.fragments, FRAGMENTS);
    assert.deepEqual(Object.keys(result.fragments).sort(), ['era', 'item', 'status', 'story']);
    assert.equal(result.image_path, null);

    const [classify, story] = c.prompts;
    assert.ok(classify.schema, '카테고리 분류는 enum 스키마로');
    assert.ok(classify.user.includes(FRAGMENTS.status) && classify.user.includes(FRAGMENTS.story));
    for (const v of Object.values(FRAGMENTS)) assert.ok(story.user.includes(v), v);
    assert.ok(story.user.includes('홍길동'));
    assert.ok(story.user.includes('문체·유머·서사 호흡 참고용'));
    assert.ok(story.user.includes('원본 이야기 09'));
    assert.ok(story.user.includes('양털'));
    assert.ok(story.system?.includes('짧게 쓴다') && story.system.includes('새 갈등을 만든다'));
    assert.ok(story.system?.includes('4개 조각'));
    assert.ok(!JSON.stringify(c.prompts).includes('1990'));
  });

  it('DB 기준표에 없는 띠 코드는 소재 없이 진행하고 null 로 저장', async () => {
    const c = makeDeps();
    const r = await c.handle(req({ ...STORY, zodiacCode: 'rat' }));
    const { result } = (await r.json()) as any;
    assert.equal(result.zodiac_code, null);
    assert.ok(!c.prompts[1].user.includes('[12간지 소재'));
  });

  it('AI 응답 형식이 틀리면 502, 저장하지 않음', async () => {
    for (const bad of [
      'not json',
      JSON.stringify({ ...OUTPUT, image_prompt: undefined }),
      JSON.stringify({ ...OUTPUT, story: { ...OUTPUT.story, dialogue: '문자열' } }),
      JSON.stringify({ ...OUTPUT, story: { ...OUTPUT.story, result: { job: 'x' } } }),
      JSON.stringify({ ...OUTPUT, title: '양띠라서 온순한 성격' }),
    ]) {
      const c = makeDeps({ generateJson: async (p) => (p.schema ? '{"category_code":"legacy"}' : bad) });
      assert.equal((await c.handle(req(STORY))).status, 502, bad.slice(0, 40));
      assert.equal(c.rows.length, 0);
    }
  });

  it('카테고리 응답이 목록 밖이면 502', async () => {
    const c = makeDeps({ generateJson: async () => '{"category_code":"heritage"}' });
    assert.equal((await c.handle(req(STORY))).status, 502);
  });

  it('AI 시간 초과는 504', async () => {
    const c = makeDeps({
      timeouts: { category: 30 },
      generateJson: (_p, signal) => new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted')))),
    });
    assert.equal((await c.handle(req(STORY))).status, 504);
  });

  it('대화 줄 문자열 형식도 화자/대사로 정리', () => {
    const v = validateStoryOutput({ ...OUTPUT, story: { ...OUTPUT.story, dialogue: ['감사: 왜 그러느냐?', '(침묵)'] } });
    assert.equal(v.ok, true);
    if (v.ok) assert.deepEqual(v.value.story.dialogue, [{ speaker: '감사', line: '왜 그러느냐?' }, { speaker: '', line: '(침묵)' }]);
  });
});

describe('초상화·음성 (allSettled) 과 조회', () => {
  async function created(c: ReturnType<typeof makeDeps>) {
    const r = await c.handle(req(STORY));
    return ((await r.json()) as any).result as Row;
  }

  it('둘 다 성공 → 각 버킷에 업로드하고 경로 저장', async () => {
    const c = makeDeps();
    const row = await created(c);
    const r = await c.handle(req({ action: 'assets', resultId: row.id }));
    const body = (await r.json()) as any;
    assert.deepEqual(body.assets, { image: 'ok', voice: 'ok' });
    assert.equal(body.result.image_path, `${row.user_id}/${row.id}.png`);
    assert.equal(body.result.voice_path, `${row.user_id}/${row.id}.mp3`);
    assert.deepEqual(c.uploads.map((u) => u.bucket).sort(), ['past-life-portraits', 'past-life-voices']);
  });

  it('이미지가 실패해도 음성은 저장되고 이야기는 남는다', async () => {
    const c = makeDeps({ generateImage: async () => { throw new Error('image down'); } });
    const row = await created(c);
    const body = (await (await c.handle(req({ action: 'assets', resultId: row.id }))).json()) as any;
    assert.deepEqual(body.assets, { image: 'failed', voice: 'ok' });
    assert.equal(body.result.image_path, null);
    assert.ok(body.result.voice_path);
    assert.equal(body.result.story.title, OUTPUT.title);
  });

  it('다른 사용자의 결과는 에셋 생성·조회·목록 모두 불가', async () => {
    const c = makeDeps();
    const row = await created(c);
    assert.equal((await c.handle(req({ action: 'assets', resultId: row.id }, 'token-B'))).status, 404);
    assert.equal((await c.handle(req({ action: 'get', resultId: row.id }, 'token-B'))).status, 404);
    const list = (await (await c.handle(req({ action: 'list' }, 'token-B'))).json()) as any;
    assert.deepEqual(list.results, []);
    const own = (await (await c.handle(req({ action: 'list' }))).json()) as any;
    assert.equal(own.results.length, 1);
  });
});

describe('보조 함수', () => {
  it('캐릭터 id 컬럼은 character_id 또는 id', () => {
    assert.equal(normalizeCharacterRow({ id: 4, category_code: 'legacy' })?.character_id, '04');
    assert.equal(normalizeCharacterRow({ character_id: '09', category_code: 'legacy' })?.character_id, '09');
    assert.equal(normalizeCharacterRow({ category_code: 'legacy' }), null);
  });
});

describe('DB 컬럼 이름 차이와 오류 진단', () => {
  it('기준 테이블은 다른 컬럼 이름도 같은 값으로 읽는다', async () => {
    const m = await import('../../api/past-life/story.ts');
    assert.deepEqual(m.normalizeCategoryRow({ code: 'legacy', category_name: '탐구/전승형', description: 'd' }), {
      category_code: 'legacy',
      name: '탐구/전승형',
      description: 'd',
    });
    assert.equal(m.normalizeCharacterRow({ id: 4, category: 'legacy' })?.character_id, '04');
    assert.equal(m.normalizeZodiacRow({ code: 'goat', name: '양' })?.zodiac_name, '양');
    assert.equal(m.normalizePromptRuleRow({ key: 'default', output_template: {} }).rule_key, 'default');
  });

  it('DB 컬럼이 없으면 503 + 실패 단계, AI 실패는 502 + 단계', async () => {
    const m = await import('../../api/past-life/story.ts');
    const base = makeDeps();
    const missingColumn = Object.assign(new Error('column past_life_results.user_name does not exist'), { code: '42703' });
    const dbBroken = createStoryHandler({ ...base.deps, countRecentResults: async () => { throw missingColumn; } });
    const r1 = await dbBroken(req(STORY));
    const b1 = (await r1.json()) as any;
    assert.equal(r1.status, 503);
    assert.equal(b1.step, 'db:count past_life_results');
    assert.equal(b1.code, '42703');
    assert.match(b1.detail, /user_name/); // 테스트 환경은 production 이 아니므로 원인 포함

    const aiBroken = createStoryHandler({ ...base.deps, generateJson: async () => { throw Object.assign(new Error('model not found'), { status: 404 }); } });
    const r2 = await aiBroken(req(STORY));
    const b2 = (await r2.json()) as any;
    assert.equal(r2.status, 502);
    assert.equal(b2.step, 'ai:category');
    assert.match(b2.detail, /model not found/);
    assert.ok(m.isSchemaMismatch('PGRST204'));
  });
});

describe('서버 환경변수 (Claude 전환)', () => {
  it('ANTHROPIC_API_KEY 가 없으면 missingEnv 에 올라오고, GEMINI_API_KEY 는 필수가 아니다', async () => {
    const { missingServerEnv } = await import('../../api/past-life/story.ts');
    const saved = { ...process.env };
    try {
      process.env.VITE_SUPABASE_URL = 'https://x.supabase.co';
      process.env.SUPABASE_SECRET_KEY = 'sb_secret_test';
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.GEMINI_API_KEY;
      assert.deepEqual(missingServerEnv(), ['ANTHROPIC_API_KEY']);
      process.env.ANTHROPIC_API_KEY = 'MY_ANTHROPIC_API_KEY'; // 예시값은 미설정으로 취급
      assert.deepEqual(missingServerEnv(), ['ANTHROPIC_API_KEY']);
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      assert.deepEqual(missingServerEnv(), []);
    } finally {
      process.env = saved;
    }
  });
});

describe('유머 코드 프롬프트', () => {
  it('시스템 프롬프트에 유머 코드 4가지와 형식 예시가 들어가고 사용자 프롬프트에 출력 지침이 있다', () => {
    const { system, user } = buildStoryPrompt({
      name: '나그네',
      fragments: { era: 'e', status: 's', story: 't', item: 'i' },
      statusDetail: 'd',
      category: { category_code: 'pioneer', name: '개척형', description: 'x' },
      character: { character_id: '01', category_code: 'pioneer' },
      rule: { rule_key: 'default', output_template: {}, writing_rules: [], generation_rules: [] },
      zodiac: null,
    });
    assert.ok(system.includes(HUMOR_CODE));
    assert.ok(system.includes(NEGATIVE_RULES));
    assert.ok(system.includes(STYLE_GUIDE));
    for (const k of ['시대착오적 현대어', '진지한 궤변', '담백한 마무리', 'voice_direction']) assert.ok(STYLE_GUIDE.includes(k), k);
    assert.ok(system.indexOf(NEGATIVE_RULES) < system.indexOf(HUMOR_CODE), '금지 규칙이 먼저');
    for (const k of ['정직한 장사로 신뢰 쌓기', '장원급제', '연필', '의도된 개그 장치']) assert.ok(NEGATIVE_RULES.includes(k), k);
    for (const k of ['괴짜 집착', 'Deadpan Anachronism', '6~8줄', '괄호 지문', '1인칭 독백', '~하옵니다', '퓨전 신선로이옵니다', '인수합병을 검토 중이옵니다']) assert.ok(system.includes(k), k);
    assert.equal(STORY_TEMPERATURE, 0.9);
    for (const k of ['waist-up', '3/4', '1인칭 독백', '문답 6~8회', 'quirk']) assert.ok(user.includes(k), k);
  });
});

describe('로컬 시연 로그인 우회 (dev-demo:jeonju)', () => {
  it('운영(NODE_ENV=production)이거나 Vercel 이면 항상 꺼진다', () => {
    assert.equal(isDevDemoAllowed({ NODE_ENV: 'production' }), false);
    assert.equal(isDevDemoAllowed({ NODE_ENV: 'production', VERCEL: '1' }), false);
    assert.equal(isDevDemoAllowed({ NODE_ENV: 'development', VERCEL: '1' }), false);
    assert.equal(isDevDemoAllowed({ NODE_ENV: 'development' }), true);
  });

  it('운영 환경에서는 우회 토큰이 거부된다', () => {
    const prev = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'production';
      assert.equal(isDevDemoToken(DEV_DEMO_TOKEN), false);
      process.env.NODE_ENV = 'development';
      assert.equal(isDevDemoToken('dev-demo:other'), false);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });
});

describe('공유 링크 (shared)', () => {
  async function created(c: ReturnType<typeof makeDeps>) {
    const r = await c.handle(req(STORY));
    return ((await r.json()) as any).result as Row;
  }

  it('로그인 없이 결과 1건을 읽고, 소유자 id·이름은 지워서 돌려준다', async () => {
    const c = makeDeps();
    const row = await created(c);
    const r = await c.handle(new Request('http://x/api/past-life/story', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'shared', resultId: row.id }),
    }));
    assert.equal(r.status, 200);
    const body = (await r.json()) as any;
    assert.equal(body.result.id, row.id);
    assert.equal(body.result.user_id, '');
    assert.equal(body.result.user_name, '');
    assert.equal(body.result.story.title, OUTPUT.title);
  });

  it('없는 결과나 형식이 틀린 id 는 404/400', async () => {
    const c = makeDeps();
    const post = (b: unknown) => c.handle(new Request('http://x/api/past-life/story', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }));
    assert.equal((await post({ action: 'shared', resultId: '00000000-0000-4000-8000-000000000000' })).status, 404);
    assert.equal((await post({ action: 'shared', resultId: 'nope' })).status, 400);
  });
});

describe('운영자 전생 유형 집계 (admin_type_stats)', () => {
  const post = (c: ReturnType<typeof makeDeps>, headers: Record<string, string> = {}) =>
    c.handle(new Request('http://x/api/past-life/story', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ action: 'admin_type_stats' }) }));

  it('관리자 확인이 없으면 401', async () => {
    assert.equal((await post(makeDeps())).status, 401);
  });

  it('DB 카테고리 목록 전체에 실제 저장 수를 붙여 돌려준다(없는 유형은 0)', async () => {
    const c = makeDeps();
    await c.handle(req(STORY));
    await c.handle(req(STORY));
    const r = await post(c, { 'x-admin-passcode': 'pw' });
    assert.equal(r.status, 200);
    const body = (await r.json()) as { total: number; types: Array<{ category_code: string; name: string; count: number }> };
    assert.equal(body.total, 2);
    assert.ok(body.types.length >= 1);
    assert.equal(body.types.reduce((a, t) => a + t.count, 0), 2);
    assert.ok(body.types.every((t) => t.name && typeof t.count === 'number'));
  });
});

describe('낭독 연출 (voice_direction)', () => {
  it('허용된 값만 받고 나머지는 normal 로 맞춘다', () => {
    assert.deepEqual(parseVoiceDirection({ rate: 'slow', pitch: 'high' }), { rate: 'slow', pitch: 'high' });
    assert.deepEqual(parseVoiceDirection({ rate: 'x', pitch: 7 }), { rate: 'normal', pitch: 'normal' });
    assert.equal(parseVoiceDirection(null), null);
    assert.equal(parseVoiceDirection([]), null);
  });
});
