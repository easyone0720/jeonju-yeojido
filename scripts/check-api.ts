/**
 * 외부 API 연결 점검 스크립트 (읽기 전용)
 *
 *   bun run check:api              # 환경변수 · Supabase · Claude(텍스트) · Gemini(이미지·음성, 선택) 모델 존재 확인
 *   bun run check:api --endpoint   # + 실행 중인 개발 서버의 /api/past-life/story 응답 확인
 *   bun run check:api --tts        # + 짧은 음성 1회 실제 생성 (요금 발생)
 *   bun run check:api --image      # + 작은 이미지 1회 실제 생성 (요금 발생)
 *
 * - bun 이 프로젝트의 .env 를 자동으로 읽는다.
 * - 키·토큰 값은 출력하지 않는다. 이름, 길이, 형식, 응답 상태만 출력한다.
 * - DB·Storage 에는 쓰지 않는다 (조회만). Google 로그인 토큰이 필요한 실제 생성 흐름은 점검하지 않는다.
 */
import { createClient } from '@supabase/supabase-js';
import { generateClaudeJson, getAnthropicApiKey, getClaudeModel } from '../src/utils/claudeClient.ts';
import { ZODIAC_CODES } from '../src/utils/zodiacMotif.ts';
import { BUCKETS } from '../src/services/aiPastLife/constants.ts';

const args = new Set(process.argv.slice(2));
const TIMEOUT_MS = 20_000;

let failures = 0;
let warnings = 0;
const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const warn = (msg: string) => {
  warnings += 1;
  console.log(`  ⚠️  ${msg}`);
};
const fail = (msg: string) => {
  failures += 1;
  console.log(`  ❌ ${msg}`);
};
const section = (title: string) => console.log(`\n■ ${title}`);

/** 오류에서 메시지·코드만 꺼낸다. 키가 섞여 나오지 않도록 길이를 자르고 키 값은 가린다 */
function errText(err: unknown): string {
  const e = err as { message?: unknown; code?: unknown; status?: unknown };
  let msg = typeof e?.message === 'string' ? e.message : String(err);
  for (const secret of [env('SUPABASE_SECRET_KEY'), env('VITE_SUPABASE_PUBLISHABLE_KEY'), env('GEMINI_API_KEY'), env('ANTHROPIC_API_KEY')]) {
    if (secret) msg = msg.split(secret).join('<가림>');
  }
  const code = typeof e?.code === 'string' ? e.code : typeof e?.status === 'number' ? String(e.status) : '';
  return `${code ? `[${code}] ` : ''}${msg}`.slice(0, 300);
}

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

async function withTimeout<T>(label: string, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await run(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) throw new Error(`${label}: ${TIMEOUT_MS / 1000}초 안에 응답 없음`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------------------------
// 1. 환경변수
// ---------------------------------------------------------------------------------------------
section('1. 환경변수 (.env)');
const REQUIRED: Array<[string, (v: string) => string | null]> = [
  ['VITE_SUPABASE_URL', (v) => (/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v) ? null : 'https://<프로젝트>.supabase.co 형식이 아님')],
  ['VITE_SUPABASE_PUBLISHABLE_KEY', (v) => (v.startsWith('sb_publishable_') || v.split('.').length === 3 ? null : 'Publishable(anon) 키 형식이 아님')],
  ['SUPABASE_SECRET_KEY', (v) => (v.startsWith('sb_secret_') || v.split('.').length === 3 ? null : 'Secret(service_role) 키 형식이 아님')],
  ['ANTHROPIC_API_KEY', (v) => (/^(MY_|YOUR_|your[-_])/i.test(v) ? '예시값 그대로임' : null)],
  ['ANTHROPIC_MODEL', () => null],
  // GEMINI_API_KEY 는 초상화 1순위(선택): 없으면 Pollinations, 그것도 실패하면 기존 캐릭터 초상화
  ['GEMINI_API_KEY', (v) => (v === 'MY_GEMINI_API_KEY' ? '예시값 그대로임' : null)],
  ['GEMINI_IMAGE_MODEL', () => null],
  ['VITE_PAST_LIFE_MODE', (v) => (v === 'api' ? null : `'api' 가 아님 (현재: ${v || '비어 있음'}) → 맞춤형 전생 화면이 켜지지 않음`)],
];
for (const [name, check] of REQUIRED) {
  const v = env(name);
  if (!v) {
    (name.startsWith('GEMINI_') || name === 'ANTHROPIC_MODEL' ? warn : fail)(`${name}: 비어 있음`);
    continue;
  }
  const problem = check(v);
  const shown = name.endsWith('_MODEL') || name === 'VITE_PAST_LIFE_MODE' ? ` = ${v}` : ` (길이 ${v.length})`;
  if (problem) fail(`${name}${shown}: ${problem}`);
  else ok(`${name}${shown}`);
}
for (const legacy of ['SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'VITE_SUPABASE_SECRET_KEY', 'SUPABASE_URL']) {
  if (env(legacy)) {
    if (legacy === 'VITE_SUPABASE_SECRET_KEY') fail(`${legacy}: Secret 키에 VITE_ 를 붙이면 브라우저 번들에 들어갈 수 있음 → 이 줄을 지우세요`);
    else if (legacy === 'SUPABASE_URL') ok(`${legacy}: 서버가 VITE_SUPABASE_URL 대신 이 값을 씀 (같은 주소인지 확인)`);
    else warn(`${legacy}: 코드가 읽지 않는 옛 이름 (SUPABASE_SECRET_KEY / VITE_SUPABASE_PUBLISHABLE_KEY 를 사용)`);
  }
}

const SUPABASE_URL = (env('SUPABASE_URL') || env('VITE_SUPABASE_URL')).replace(/\/$/, '');
const PUBLISHABLE = env('VITE_SUPABASE_PUBLISHABLE_KEY');
const SECRET = env('SUPABASE_SECRET_KEY');

// ---------------------------------------------------------------------------------------------
// 2. Supabase
// ---------------------------------------------------------------------------------------------
section('2. Supabase');
if (!SUPABASE_URL || !PUBLISHABLE || !SECRET) {
  fail('Supabase 환경변수가 없어 건너뜀');
} else {
  // 2-1. Auth 설정 (Publishable 키) — Google 로그인 활성 여부
  try {
    const res = await withTimeout('Auth 설정', (signal) =>
      fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: PUBLISHABLE }, signal }),
    );
    if (res.ok) {
      const s = (await res.json()) as { external?: Record<string, boolean> };
      ok(`프로젝트 연결 + Publishable 키 사용 가능 (HTTP ${res.status})`);
      if (s.external?.google) ok('Auth: Google 로그인 활성화됨');
      else fail('Auth: Google 로그인이 꺼져 있음 (Authentication → Sign In / Providers → Google)');
    } else {
      fail(`Auth 설정 조회 실패 HTTP ${res.status} → URL 또는 Publishable 키 확인`);
    }
  } catch (err) {
    fail(`Supabase 에 연결 실패: ${errText(err)}`);
  }

  const admin = createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });

  // 2-2. 테이블 (Secret 키, 조회만)
  const TABLES: Array<{ name: string; expect: string[]; optional?: string[]; written?: string[]; show?: string[] }> = [
    { name: 'story_categories', expect: ['category_code|code', 'name|category_name', 'description'], show: ['category_code', 'code'] },
    {
      name: 'story_characters',
      expect: ['character_id|id', 'category_code|category', 'identity', 'era', 'social_role', 'background', 'core_items', 'fixed_rules', 'reference_story'],
    },
    { name: 'story_prompt_rules', expect: ['rule_key|key', 'output_template', 'writing_rules', 'generation_rules'], show: ['rule_key', 'key'] },
    {
      name: 'zodiac_story_rules',
      expect: ['zodiac_code|code', 'zodiac_name|name'],
      optional: ['motif_keywords', 'scene_seeds'], // 없으면 띠 이름만 소재로 쓴다
      show: ['zodiac_code', 'code'],
    },
    {
      name: 'past_life_results',
      expect: ['id', 'user_id', 'user_name', 'character_id', 'category_code', 'zodiac_code', 'fragments', 'story', 'image_path', 'voice_path', 'created_at'],
      // 서버가 저장할 때 값을 넣는 컬럼. 이 밖의 NOT NULL(기본값 없음) 컬럼이 있으면 저장이 실패한다
      written: ['id', 'user_id', 'user_name', 'character_id', 'category_code', 'zodiac_code', 'fragments', 'story', 'image_path', 'voice_path'],
    },
  ];

  // 빈 테이블도 컬럼을 알 수 있도록 PostgREST OpenAPI 정의를 먼저 시도
  let definitions: Record<string, { properties?: Record<string, { default?: unknown } | unknown>; required?: string[] }> = {};
  try {
    const res = await withTimeout('스키마 정의', (signal) =>
      fetch(`${SUPABASE_URL}/rest/v1/`, { headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}` }, signal }),
    );
    if (res.ok) definitions = ((await res.json()) as { definitions?: typeof definitions }).definitions ?? {};
  } catch {
    // 아래에서 행 기준으로 다시 확인
  }

  const valuesOf: Record<string, string[]> = {};
  for (const t of TABLES) {
    try {
      const { data, error, count } = await admin.from(t.name).select('*', { count: 'exact' }).limit(50);
      if (error) {
        fail(`${t.name}: 조회 실패 ${errText(error)}`);
        continue;
      }
      const rows = (data ?? []) as Record<string, unknown>[];
      const columns = new Set<string>([
        ...Object.keys(definitions[t.name]?.properties ?? {}),
        ...rows.flatMap((r) => Object.keys(r)),
      ]);
      const missing = t.expect.filter((alts) => !alts.split('|').some((c) => columns.has(c)));
      const summary = `${t.name}: 행 ${count ?? rows.length}개, 컬럼 [${[...columns].join(', ') || '알 수 없음(빈 테이블)'}]`;
      if (columns.size === 0) warn(summary);
      else if (missing.length > 0) fail(`${summary}\n       → 코드가 찾는 컬럼 없음: ${missing.join(', ')}`);
      else ok(summary);
      const optionalMissing = (t.optional ?? []).filter((c) => !columns.has(c));
      if (optionalMissing.length) warn(`${t.name}: 선택 컬럼 없음(${optionalMissing.join(', ')}) → 띠 이름만 이야기 소재로 씀`);
      if (t.written) {
        const required = definitions[t.name]?.required;
        if (!required) warn(`${t.name}: NOT NULL 정보를 읽지 못함 (스키마 정의 조회 실패)`);
        else {
          const props = (definitions[t.name]?.properties ?? {}) as Record<string, { default?: unknown } | undefined>;
          // PostgREST 의 required 는 기본값이 있어도 NOT NULL 이면 들어간다 → 기본값이 있는 컬럼은 제외
          const blocking = required.filter((c) => !t.written!.includes(c) && props[c]?.default === undefined);
          if (blocking.length) fail(`${t.name}: 서버가 값을 넣지 않는 NOT NULL(기본값 없음) 컬럼 → 저장 실패 원인: ${blocking.join(', ')}`);
          else ok(`${t.name}: 저장에 필요한 NOT NULL 컬럼 문제 없음`);
        }
        const unused = [...columns].filter((c) => !t.expect.includes(c));
        if (unused.length) warn(`${t.name}: 코드가 쓰지 않는 컬럼 ${unused.join(', ')} (이전 초안의 남은 컬럼으로 보임)`);
      }
      if (t.show) {
        const key = t.show.find((k) => columns.has(k));
        if (key) valuesOf[t.name] = rows.map((r) => String(r[key]));
      }
    } catch (err) {
      fail(`${t.name}: ${errText(err)}`);
    }
  }

  // 2-3. 코드값 대조
  const zodiac = valuesOf.zodiac_story_rules ?? [];
  if (zodiac.length) {
    const notInDb = ZODIAC_CODES.filter((c) => !zodiac.includes(c));
    const notInCode = zodiac.filter((c) => !(ZODIAC_CODES as readonly string[]).includes(c));
    if (notInDb.length || notInCode.length) {
      fail(`띠 코드 불일치 → DB에만: [${notInCode.join(', ')}] / 코드에만: [${notInDb.join(', ')}]`);
    } else ok(`띠 코드 12종 일치 (${zodiac.join(', ')})`);
  }
  const cats = valuesOf.story_categories ?? [];
  if (cats.length) {
    const want = ['pioneer', 'expression', 'legacy', 'connection', 'guardian'];
    const diff = [...want.filter((c) => !cats.includes(c)), ...cats.filter((c) => !want.includes(c))];
    if (diff.length) fail(`유형 코드 불일치: ${diff.join(', ')} (heritage 가 남아 있으면 legacy 로 정리 필요)`);
    else ok(`유형 코드 5종 일치 (${cats.join(', ')})`);
  }
  const rules = valuesOf.story_prompt_rules ?? [];
  if (rules.length && !rules.includes('default')) fail(`story_prompt_rules 에 rule_key='default' 행이 없음 (있는 값: ${rules.join(', ')})`);
  else if (rules.length) ok("story_prompt_rules: 'default' 규칙 있음");

  // 2-4. Storage 버킷
  try {
    const { data, error } = await admin.storage.listBuckets();
    if (error) fail(`Storage 버킷 조회 실패: ${errText(error)}`);
    else {
      for (const b of Object.values(BUCKETS)) {
        const found = data.find((x) => x.id === b || x.name === b);
        if (found) ok(`버킷 ${b} 있음 (public: ${found.public})`);
        else fail(`버킷 ${b} 없음`);
      }
    }
  } catch (err) {
    fail(`Storage: ${errText(err)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Claude (이야기·유형 분류)
// ---------------------------------------------------------------------------------------------
section('3. Claude (Anthropic Messages API)');
const CLAUDE_KEY = getAnthropicApiKey();
if (!CLAUDE_KEY) {
  fail('ANTHROPIC_API_KEY 가 없어 건너뜀');
} else {
  const claudeModel = getClaudeModel();
  try {
    const t0 = Date.now();
    const text = await withTimeout('Claude 텍스트 생성', (signal) =>
      generateClaudeJson({
        apiKey: CLAUDE_KEY,
        model: claudeModel,
        user: '연결 확인입니다. {"ok": true} 만 돌려주세요.',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        temperature: 0,
        maxTokens: 64,
        signal,
      }),
    );
    const parsed = JSON.parse(text) as { ok?: unknown };
    if (parsed.ok === true) ok(`Claude(${claudeModel}) JSON 생성 성공 (${Date.now() - t0}ms)`);
    else fail(`Claude 응답이 예상과 다름: ${text.slice(0, 80)}`);
  } catch (err) {
    fail(`Claude 호출 실패: ${errText(err)}`);
  }
}

// ---------------------------------------------------------------------------------------------
// 4. 무료 미디어 — 음성: msedge-tts(키 불필요), 초상화: Gemini 무료 티어 → Pollinations → 기존 캐릭터 초상화
// ---------------------------------------------------------------------------------------------
section('4. 초상화·음성 (무료 모델)');
{
  const { generatePortrait, synthesizeSpeech, pickVoice } = await import('../src/utils/freeMedia.ts');
  if (env('GEMINI_API_KEY') && env('GEMINI_API_KEY') !== 'MY_GEMINI_API_KEY') ok(`GEMINI_API_KEY 있음 → 초상화 1순위 ${env('GEMINI_IMAGE_MODEL') || 'gemini-2.5-flash-image'}`);
  else warn('GEMINI_API_KEY 없음 → 초상화는 Pollinations 로 생성됨');
  if (args.has('--tts')) {
    try {
      const t0 = Date.now();
      const audio = await withTimeout('음성 생성', (signal) => synthesizeSpeech('안녕하세요. 전생여지도 연결 확인입니다.', pickVoice(''), signal));
      if (audio) ok(`음성(msedge-tts) 생성 성공: MP3 ${Math.round(audio.length / 1024)}KB (${Date.now() - t0}ms)`);
      else fail('음성 응답이 비어 있음');
    } catch (err) {
      fail(`음성 생성 실패: ${errText(err)}`);
    }
  }
  if (args.has('--image')) {
    const t0 = Date.now();
    const img = await generatePortrait('an old scholar holding a lantern', {
      geminiKey: env('GEMINI_API_KEY'),
      geminiModel: env('GEMINI_IMAGE_MODEL') || undefined,
      log: (m) => console.log(`     ${m}`),
    });
    if (img) ok(`초상화 생성 성공: ${img.mimeType}, ${Math.round(img.data.length / 1024)}KB (${Date.now() - t0}ms)`);
    else warn('초상화 외부 생성 모두 실패 → 서비스에서는 기존 캐릭터 초상화로 대체됨');
  }
}

// ---------------------------------------------------------------------------------------------
// 5. (선택) 실행 중인 개발 서버의 API 라우트
// ---------------------------------------------------------------------------------------------
if (args.has('--endpoint')) {
  section('5. 개발 서버 /api/past-life/story');
  const base = `http://localhost:${env('PORT') || '3000'}`;
  try {
    const res = await withTimeout('API 라우트', (signal) =>
      fetch(`${base}/api/past-life/story`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list' }),
        signal,
      }),
    );
    const body = (await res.json().catch(() => ({}))) as { error?: string; missingEnv?: string[] };
    if (res.status === 401) ok(`라우트 연결됨 + 서버 환경변수 로드됨 (로그인 없이 호출 → 401 정상)`);
    else if (res.status === 503) fail(`서버 설정 미완료: ${body.error ?? ''} ${body.missingEnv ? `누락: ${body.missingEnv.join(', ')}` : ''}`);
    else fail(`예상 밖 응답 HTTP ${res.status}: ${body.error ?? ''}`);
  } catch (err) {
    fail(`${base} 에 연결 실패 (bun run dev 가 켜져 있는지 확인): ${errText(err)}`);
  }
}

console.log(`\n결과: 실패 ${failures}건, 주의 ${warnings}건`);
if (!args.has('--endpoint') || !args.has('--tts') || !args.has('--image')) {
  console.log('추가 점검: --endpoint (개발 서버 라우트), --tts (음성 1회 생성), --image (이미지 1회 생성)');
}
process.exit(failures > 0 ? 1 : 0);
