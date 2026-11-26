/**
 * /api/past-life/story — 맞춤형 전생 스토리·초상화·음성 생성과 Supabase 저장 (Vercel Function)
 *
 * POST, Authorization: Bearer <Supabase Auth 액세스 토큰 (Google 로그인)>
 *  1) { action: "story", name, zodiacCode, fragments: { era, status, story, item } }
 *     → 카테고리 매칭(AI) → 같은 카테고리의 참고 캐릭터 선정 → 스토리 생성(AI, JSON) → 검증
 *     → past_life_results 저장 → 200 { result }
 *  2) { action: "assets", resultId }
 *     → 초상화·낭독 음성을 Promise.allSettled 로 생성 → Storage 업로드 → 행 갱신
 *     → 200 { result, assets: { image: "ok"|"failed"|"skipped", voice: ... } }
 *  3) { action: "list" } → 200 { results: [...] }   (본인 결과 최근 20건, AI 호출 없음)
 *  4) { action: "get", resultId } → 200 { result }   (본인 결과 1건, AI 호출 없음)
 *
 * 원칙
 * - 생년월일은 받지 않는다. 본문에 birthDate 가 있으면 400.
 * - 기준 데이터(story_categories, story_characters, story_prompt_rules, zodiac_story_rules)는
 *   서버의 SUPABASE_SECRET_KEY 클라이언트로만 조회한다.
 * - 4개 조각은 지도에서 나눠 주는 허용 목록(src/data/clueFragments.json)의 한 세트와 정확히 같아야 한다.
 *   조각이 전생의 시대·신분·사건·소지품을 결정하고, 캐릭터는 문체·유머·서사 호흡 참고용으로만 쓴다.
 * - 소유자는 검증한 토큰의 user.id 다. 요청 본문의 사용자 id 는 쓰지 않는다.
 * - AI 응답은 output_template 구조로 검증한 뒤에만 저장한다.
 *
 * 이 파일은 npm 패키지와 node 내장 모듈만 import 한다(Vercel 함수가 상대 경로 TS import 를 해석하지
 * 못하는 문제를 피하려고). 허용 조각 JSON 은 실행 시 읽으며 vercel.json 의 includeFiles 로 함께 배포된다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateClaudeJson, getAnthropicApiKey, getClaudeModel } from '../../src/utils/claudeClient.ts';
import { generatePortrait, pickVoice, synthesizeSpeech } from '../../src/utils/freeMedia.ts';

// =============================================================================================
// 타입 — story_prompt_rules.output_template 에 대응하는 생성 결과 (클라이언트도 type import 로 같이 쓴다)
// =============================================================================================
export interface DialogueLine {
  /** 화자. 지문이면 빈 문자열 */
  speaker: string;
  line: string;
}

export interface PastLifeStoryOutput {
  title: string;
  story: {
    setting: string;
    dialogue: DialogueLine[];
    result: { job: string; reputation: string; achievement: string };
    ending: string;
  };
  image_prompt: string;
  narration_text: string;
}

export interface Fragments {
  era: string;
  status: string;
  story: string;
  item: string;
}

/** past_life_results 한 행 */
export interface PastLifeResultRow {
  id: string;
  user_id: string;
  user_name: string;
  character_id: string;
  category_code: string;
  zodiac_code: string | null;
  fragments: Fragments;
  story: PastLifeStoryOutput;
  image_path: string | null;
  voice_path: string | null;
  created_at: string;
}

/** 응답용: 행 + 표시 이름 (DB 컬럼 아님) */
export interface PastLifeResultView extends PastLifeResultRow {
  category_name: string;
  zodiac_name: string | null;
}

export const ZODIAC_CODES = [
  'rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake',
  'horse', 'goat', 'monkey', 'rooster', 'dog', 'pig',
] as const;

export const BUCKETS = { portrait: 'past-life-portraits', voice: 'past-life-voices' } as const;

// =============================================================================================
// 기준 데이터 (DB). 캐릭터 id 컬럼은 character_id → id 순으로 찾는다.
// =============================================================================================
export interface CategoryRow {
  category_code: string;
  name: string;
  description: string;
}
export interface CharacterRow {
  character_id: string;
  category_code: string;
  identity?: unknown;
  era?: unknown;
  social_role?: unknown;
  background?: unknown;
  core_items?: unknown;
  fixed_rules?: unknown;
  reference_story?: unknown;
}
export interface PromptRuleRow {
  rule_key: string;
  output_template: unknown;
  writing_rules: unknown;
  generation_rules: unknown;
}
export interface ZodiacRuleRow {
  zodiac_code: string;
  zodiac_name: string;
  motif_keywords?: unknown;
  scene_seeds?: unknown;
}

/**
 * DB 컬럼 이름이 조금 달라도(예: code / category_code) 같은 값으로 읽는다.
 * 기준 테이블은 select('*') 로 읽은 뒤 여기서 코드가 쓰는 이름으로 맞춘다.
 */
export function pickField(raw: Record<string, unknown>, names: string[]): unknown {
  for (const n of names) if (raw[n] !== undefined && raw[n] !== null) return raw[n];
  return undefined;
}
const textOf = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null);

export const FIELD_ALIASES = {
  categoryCode: ['category_code', 'code', 'category', 'type_code'],
  categoryName: ['name', 'category_name', 'label', 'title', 'name_ko'],
  categoryDescription: ['description', 'category_description', 'desc', 'summary'],
  characterId: ['character_id', 'id', 'code', 'character_code'],
  ruleKey: ['rule_key', 'key', 'rule_name', 'name'],
  zodiacCode: ['zodiac_code', 'code'],
  zodiacName: ['zodiac_name', 'name', 'name_ko'],
};

export function normalizeCategoryRow(raw: Record<string, unknown>): CategoryRow | null {
  const code = textOf(pickField(raw, FIELD_ALIASES.categoryCode));
  if (!code) return null;
  return {
    category_code: code,
    name: textOf(pickField(raw, FIELD_ALIASES.categoryName)) ?? code,
    description: textOf(pickField(raw, FIELD_ALIASES.categoryDescription)) ?? '',
  };
}

export function normalizeCharacterRow(raw: Record<string, unknown>): CharacterRow | null {
  const id = textOf(pickField(raw, FIELD_ALIASES.characterId));
  const category = textOf(pickField(raw, FIELD_ALIASES.categoryCode));
  if (!id || !category) return null;
  return { ...(raw as object), character_id: /^\d+$/.test(id) ? id.padStart(2, '0') : id, category_code: category } as CharacterRow;
}

export function normalizePromptRuleRow(raw: Record<string, unknown>): PromptRuleRow {
  return {
    rule_key: textOf(pickField(raw, FIELD_ALIASES.ruleKey)) ?? '',
    output_template: raw.output_template,
    writing_rules: raw.writing_rules,
    generation_rules: raw.generation_rules,
  };
}

export function normalizeZodiacRow(raw: Record<string, unknown>): ZodiacRuleRow | null {
  const code = textOf(pickField(raw, FIELD_ALIASES.zodiacCode));
  if (!code) return null;
  return {
    zodiac_code: code,
    zodiac_name: textOf(pickField(raw, FIELD_ALIASES.zodiacName)) ?? code,
    motif_keywords: raw.motif_keywords,
    scene_seeds: raw.scene_seeds,
  };
}

// =============================================================================================
// 오류 진단: 어느 단계에서 무엇 때문에 실패했는지 서버 콘솔과 응답에 남긴다 (비밀값 없음)
// =============================================================================================
export class StepError extends Error {
  constructor(public readonly step: string, public readonly cause: unknown) {
    super(step);
    this.name = 'StepError';
  }
}

/** Supabase(PostgREST)·Gemini 오류에서 메시지·코드만 뽑는다. 키·토큰은 이 값들에 들어 있지 않다 */
export function describeError(err: unknown): { code: string | null; message: string } {
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown; status?: unknown };
    const parts = [e.message, e.details, e.hint].filter((x): x is string => typeof x === 'string' && x.length > 0);
    const code = typeof e.code === 'string' ? e.code : typeof e.status === 'number' ? String(e.status) : null;
    return { code, message: (parts.join(' / ') || String(err)).slice(0, 400) };
  }
  return { code: null, message: String(err).slice(0, 400) };
}

/** 오류 원문을 응답에 담을지: 배포(production)에서는 담지 않고 서버 로그에만 남긴다 */
export function exposeDetail(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** DB 컬럼·테이블이 코드와 다를 때 나는 오류인가 (Postgres 42703·42P01, PostgREST PGRST204·PGRST205) */
export function isSchemaMismatch(code: string | null): boolean {
  return code === '42703' || code === '42P01' || code === 'PGRST204' || code === 'PGRST205' || code === 'PGRST200';
}

/** 단계 이름을 붙여 오류를 다시 던진다 */
export async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await run();
    console.log(`[past-life/story] ⏱ ${name} ${Date.now() - t0}ms`);
    return out;
  } catch (err) {
    const ms = Date.now() - t0;
    if (err instanceof StepError || err instanceof TimeoutError) throw err;
    const info = describeError(err);
    console.error(`[past-life/story] ✖ ${name} ${ms}ms code=${info.code ?? '-'} ${info.message}`);
    throw new StepError(name, err);
  }
}

// =============================================================================================
// 허용 조각 (지도 데이터 사본)
// =============================================================================================
export interface FragmentSet extends Fragments {
  statusDetail: string;
}
let cachedFragmentSets: Record<string, FragmentSet> | null = null;

export function loadFragmentSets(rootDir: string = process.cwd()): Record<string, FragmentSet> {
  if (cachedFragmentSets && rootDir === process.cwd()) return cachedFragmentSets;
  const parsed = JSON.parse(readFileSync(join(rootDir, 'src/data/clueFragments.json'), 'utf8')) as {
    sets: Record<string, FragmentSet>;
  };
  if (rootDir === process.cwd()) cachedFragmentSets = parsed.sets;
  return parsed.sets;
}

/** 4개 조각이 허용 목록의 한 세트와 정확히 같으면 그 세트(신분 설명 포함)를 돌려준다 */
export function matchFragmentSet(fragments: Fragments, sets: Record<string, FragmentSet>): FragmentSet | null {
  return (
    Object.values(sets).find(
      (s) => s.era === fragments.era && s.status === fragments.status && s.story === fragments.story && s.item === fragments.item,
    ) ?? null
  );
}

// =============================================================================================
// 요청 검증
// =============================================================================================
/** 이름: 한글·영문·숫자·공백·가운뎃점만 남기고 12자로 자른다 (프롬프트 인젝션 방지) */
export function sanitizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    .replace(/[^\p{Script=Hangul}A-Za-z0-9 ·]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 12);
}

export type StoryRequest = { action: 'story'; name: string; zodiacCode: string | null; fragments: Fragments };
export type AssetsRequest = { action: 'assets' | 'get'; resultId: string };
export type ListRequest = { action: 'list' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRAGMENT_KEYS = ['era', 'status', 'story', 'item'] as const;

export function parseRequest(
  body: unknown,
): { ok: true; value: StoryRequest | AssetsRequest | ListRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: '요청 형식이 올바르지 않습니다.' };
  const b = body as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(b, 'birthDate')) {
    return { ok: false, error: '생년월일은 서버로 보낼 수 없습니다.' };
  }
  if (b.action === 'list') return { ok: true, value: { action: 'list' } };
  if (b.action === 'assets' || b.action === 'get') {
    if (typeof b.resultId !== 'string' || !UUID_RE.test(b.resultId)) return { ok: false, error: '결과 id 가 올바르지 않습니다.' };
    return { ok: true, value: { action: b.action, resultId: b.resultId } };
  }
  if (b.action !== 'story') return { ok: false, error: '알 수 없는 요청입니다.' };

  let zodiacCode: string | null = null;
  if (b.zodiacCode !== undefined && b.zodiacCode !== null) {
    if (typeof b.zodiacCode !== 'string' || !(ZODIAC_CODES as readonly string[]).includes(b.zodiacCode)) {
      return { ok: false, error: '허용되지 않은 띠 코드입니다.' };
    }
    zodiacCode = b.zodiacCode;
  }
  const f = b.fragments as Record<string, unknown> | undefined;
  if (!f || typeof f !== 'object' || Array.isArray(f)) return { ok: false, error: '4개 조각이 필요합니다.' };
  if (Object.keys(f).some((k) => !(FRAGMENT_KEYS as readonly string[]).includes(k))) {
    return { ok: false, error: '조각은 era, status, story, item 네 가지만 보낼 수 있습니다.' };
  }
  const fragments = {} as Fragments;
  for (const k of FRAGMENT_KEYS) {
    const v = f[k];
    if (typeof v !== 'string' || !v.trim() || v.length > 200) return { ok: false, error: `조각(${k})이 올바르지 않습니다.` };
    fragments[k] = v.trim();
  }
  return { ok: true, value: { action: 'story', name: sanitizeName(b.name) || '나그네', zodiacCode, fragments } };
}

// =============================================================================================
// 출력 검증 (output_template 구조)
// =============================================================================================
const FORBIDDEN = /띠라서|띠이기\s*때문|운세|사주팔자|타고난\s*성격|길흉/;

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null;
  const v = value.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/[ \t]+\n/g, '\n').trim();
  if (v.length < min || v.length > max || FORBIDDEN.test(v)) return null;
  return v;
}

function parseDialogueItem(item: unknown): DialogueLine | null {
  if (typeof item === 'string') {
    const t = cleanText(item, 1, 300);
    if (!t) return null;
    const m = /^([^:：]{1,10})[:：]\s*([\s\S]+)$/.exec(t);
    return m ? { speaker: m[1].trim(), line: m[2].trim() } : { speaker: '', line: t };
  }
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const o = item as Record<string, unknown>;
    const speaker = typeof o.speaker === 'string' ? o.speaker.trim().slice(0, 10) : '';
    const line = cleanText(o.line ?? o.text ?? o.content, 1, 300);
    return line ? { speaker, line } : null;
  }
  return null;
}

export function validateStoryOutput(
  raw: unknown,
): { ok: true; value: PastLifeStoryOutput } | { ok: false; error: string } {
  let data = raw;
  if (typeof raw === 'string') {
    const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: 'JSON 이 아닙니다.' };
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: '객체가 아닙니다.' };
  const d = data as Record<string, unknown>;
  const s = d.story as Record<string, unknown> | undefined;
  const r = s?.result as Record<string, unknown> | undefined;
  if (!s || typeof s !== 'object' || !r || typeof r !== 'object') return { ok: false, error: 'story/result 가 없습니다.' };

  const title = cleanText(d.title, 2, 60);
  const setting = cleanText(s.setting, 40, 2000);
  const job = cleanText(r.job, 2, 120);
  const reputation = cleanText(r.reputation, 2, 300);
  const achievement = cleanText(r.achievement, 5, 600);
  const ending = cleanText(s.ending, 40, 2000);
  const imagePrompt = cleanText(d.image_prompt, 10, 1500);
  const narration = cleanText(d.narration_text, 10, 1200);
  const bad = Object.entries({ title, setting, job, reputation, achievement, ending, image_prompt: imagePrompt, narration_text: narration })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (bad.length > 0) {
    // 어떤 필드가 왜 거부됐는지(타입·길이)를 함께 남긴다. 내용은 남기지 않는다
    const raws: Record<string, unknown> = { image_prompt: d.image_prompt, narration_text: d.narration_text };
    const why = bad.map((k) => {
      const v = k in raws ? raws[k] : undefined;
      return k in raws ? `${k}(${typeof v}${typeof v === 'string' ? `, ${v.length}자` : ''})` : k;
    });
    return { ok: false, error: `필수 필드가 없거나 길이·내용이 맞지 않습니다: ${why.join(', ')}` };
  }
  if (!title || !setting || !job || !reputation || !achievement || !ending || !imagePrompt || !narration) {
    return { ok: false, error: '필수 필드가 없습니다.' };
  }
  if (!Array.isArray(s.dialogue) || s.dialogue.length < 2 || s.dialogue.length > 20) {
    return { ok: false, error: 'dialogue 는 2~20개 배열이어야 합니다.' };
  }
  const dialogue = s.dialogue.map(parseDialogueItem);
  if (dialogue.some((x) => x === null)) return { ok: false, error: 'dialogue 항목 형식이 맞지 않습니다.' };
  return {
    ok: true,
    value: {
      title,
      story: { setting, dialogue: dialogue as DialogueLine[], result: { job, reputation, achievement }, ending },
      image_prompt: imagePrompt,
      narration_text: narration,
    },
  };
}

// =============================================================================================
// 프롬프트
// =============================================================================================
function asText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((x) => `- ${asText(x)}`).join('\n');
  return JSON.stringify(v, null, 2);
}

export function buildCategoryPrompt(fragments: Fragments, statusDetail: string, categories: CategoryRow[]): string {
  return `아래 4개 조각으로 정해진 한 인물의 삶이 다음 이야기 유형 중 어디에 가장 가까운지 하나만 고르세요.
신분(status)과 핵심 서사(story)를 가장 중요하게 봅니다. 띠·성격·운세는 고려하지 않습니다.

[4개 조각]
- 시대: ${fragments.era}
- 신분: ${fragments.status} — ${statusDetail}
- 핵심 서사: ${fragments.story}
- 소지품: ${fragments.item}

[유형]
${categories.map((c) => `- ${c.category_code}: ${c.name} — ${c.description}`).join('\n')}

JSON 으로만 답하세요: {"category_code": "<위 코드 중 하나>"}`;
}

/**
 * 전생여지도 고정 문체 — 기존 10종 캐릭터 이야기에서 뽑은 유머 코드.
 * 아래 예시는 "형식"을 보여 주는 용도다. 문장·소재·인물을 그대로 가져오지 말고 이 전생의 4개 조각에 맞게 새로 짓는다.
 */
export const HUMOR_CODE = `[전생여지도 고정 문체 — 유머 코드]
1. 사극 어투 + 현대 개념 충돌 (Deadpan Anachronism)
   - 대사는 정통 사극 어투(~하옵니다, ~하였사옵니다, ~이옵니다, ~이오이다)를 끝까지 지킨다.
   - 그 안에 현대 개념(인수합병, 퓨전, 시험 족보, 1+1 행사, 과장된 캐리커처, 대량 주문, 구독, 후기 별점 등)을 진지하고 능청스럽게 1~2곳 섞는다. 화자는 그것이 어색하다는 것을 모르는 듯이 말해야 웃긴다.
   - 현대 용어를 해설하거나 "현대로 치면" 같은 메타 표현을 쓰지 않는다.
2. 문답 티키타카 + 괄호 지문 펀치라인
   - story.dialogue 는 주변 인물(상관·가족·손님·제자·동료 등)과 주인공('나')의 짧은 문답 6~8회로 구성한다. 한 대사는 60자 안팎으로 짧게.
   - 주인공의 엉뚱하거나 능청스러운 대답 바로 다음에는 상대의 말줄임표 반응 한 줄("……." 또는 "……그, 그러하옵니까.")과, 상황을 코믹하게 압축하는 3인칭 괄호 지문 한 줄을 반드시 둔다. 괄호 지문은 speaker 를 빈 문자열로 두고 line 을 ( ) 로 감싼다.
   - 괄호 지문은 이야기 전체에서 3개 이상, 짧고 구체적인 동작으로 쓴다(예: "(상궁마마는 국자를 떨어뜨렸고, 전하는 세 번째 그릇을 내밀었다.)").
3. 4단 호흡 + 반전 여운 결말
   - setting 과 ending 은 짧은 문장으로 ~했어요 / ~했습니다 를 자연스럽게 번갈아 써서 리듬을 만든다.
   - 기(상황) → 승(엉뚱한 시도) → 전(반전) → 결(여운) 의 4단 호흡으로, 전반부는 유쾌하고 익살스럽게 전개한다.
   - ending 에서는 주인공의 고집과 재능이 따뜻한 여운으로 남게 하고, 마지막 대사(또는 마지막 문장) 한 줄로 앞의 유머를 회수한다.
4. narration_text 는 성우 연기용 낭독문
   - 건조한 3인칭 요약이 아니라, 주인공의 성격(능청스러움 / 진지한 척 장난스러움 / 묵직한 신념 / 흥겨움 등)이 목소리로 드러나는 1인칭 독백과 대표 대사 중심으로 쓴다.
   - 쉼표·말줄임표·짧은 문장으로 숨과 억양을 표시하고, 마지막은 유머를 회수하는 한 줄로 끝낸다. 1분 안에 읽을 분량(600자 안팎).

[어투 필수 — 가장 중요]
- 모든 대사(dialogue 의 speaker 가 있는 줄)는 반드시 사극 어미로 끝낸다: ~하옵니다 / ~이옵니다 / ~하였사옵니다 / ~하오이다 / ~소서 / ~하오리까. "~합니다", "~했어요", "~나요" 같은 현대 어미를 대사에 쓰지 않는다. 주인공 대사도 마찬가지다.
- 대사마다 현대 개념 유머를 억지로 넣지 말고, 전체에서 1~2곳을 진지한 얼굴로 박아 넣는다. 나머지 대사는 사극 어투의 짧은 문답이다.
- setting / ending / 괄호 지문은 서술체(~했어요 / ~했습니다)다.

[형식 예시 — 다른 소재의 축약본. 소재·문장·인물·수치를 그대로 가져오지 말 것. 모든 필드를 이 이야기에 맞게 새로 쓴다]
{"title": "나루터에서 인수합병을 외친 사공",
 "story": {
  "setting": "한강 나루터에 배가 단 두 척뿐이었어요. 나는 사공이었고, 건너편 사공과는 오랜 앙숙이었습니다. 그러던 어느 장날, 손님이 줄어 둘 다 굶게 생겼어요.",
  "dialogue": [
   {"speaker": "건너편 사공", "line": "그대는 어찌하여 내 나루에 깃발을 꽂았는가."},
   {"speaker": "나", "line": "합치면 한 배는 덤이옵니다. 우리 두 나루를 인수합병하시옵소서."},
   {"speaker": "건너편 사공", "line": "……."},
   {"speaker": "", "line": "(건너편 사공은 삿대를 떨어뜨렸고, 구경하던 나그네는 슬며시 두 번째 승선권을 샀다.)"},
   {"speaker": "나", "line": "합병 기념으로 첫 손님께는 뱃삯을 반만 받겠사옵니다."},
   {"speaker": "건너편 사공", "line": "반이라니…… 그렇다면 둘째 손님께는 어찌하려 하느냐."},
   {"speaker": "나", "line": "둘째 손님께는 1+1이옵니다. 가는 길에 한 번 더 건너시게 하겠사옵니다."},
   {"speaker": "", "line": "(나그네는 오가다 날이 저물었고, 두 사공은 처음으로 같은 밥상에 앉았다.)"}],
  "result": {"job": "한강 나루터 통합 사공", "reputation": "앙숙을 동업자로 만든 능청스러운 뱃사공", "achievement": "두 나루를 한 배로 합쳐 겨울 매상을 두 배로 올렸다"},
  "ending": "그해 겨울 나루터는 한 배로 합쳐졌어요. 두 사공은 여전히 싸웠지만 매상은 두 배가 되었습니다. 마지막으로 나는 늘 같은 말을 했어요. \"뱃삯은 반이오나, 돌아오시는 길은 덤이옵니다.\""},
 "image_prompt": "Waist-up three-quarter portrait of a sly boatman holding a bamboo pole and a bundle of fare tickets, pretend-serious look, hemp-colored work clothes", "narration_text": "에헴, 내가 이 나루의 사공이오. 앙숙과 합치자 하였더니…… 허허, 매상이 두 배가 되었사옵니다. 뱃삯은 반이오나, 돌아오시는 길은 덤이옵니다."}`;

export function buildStoryPrompt(params: {
  name: string;
  fragments: Fragments;
  statusDetail: string;
  category: CategoryRow;
  character: CharacterRow;
  rule: PromptRuleRow;
  zodiac: ZodiacRuleRow | null;
}): { system: string; user: string } {
  const { name, fragments, statusDetail, category, character, rule, zodiac } = params;
  const system = `당신은 전주 역사문화 체험 '전생여지도'의 이야기 작가입니다.

[작성 규칙 — writing_rules]
${asText(rule.writing_rules)}

[생성 규칙 — generation_rules]
${asText(rule.generation_rules)}

[우선순위 — 위 규칙과 부딪히면 이 순서를 따른다]
1. 사용자가 수집한 4개 조각(시대·신분·핵심 서사·소지품)이 이 전생의 뼈대다. 시대·신분·핵심 사건·소지품은 조각 그대로 따르고 바꾸거나 빼지 않는다.
2. 참고 캐릭터는 문체·유머·서사 호흡만 빌려 온다. 참고 캐릭터의 이름·신분·시대·소지품·고정 설정을 이 전생에 옮기지 않는다.
3. 12간지 소재는 사건 발단·배경 상징·반복 소재로만 쓰고, 성격·기질·운세 판단에 쓰지 않는다. 어색하면 생략한다.
4. 원본 이야기의 단어만 바꾼 결과를 만들지 않는다. 갈등·조력자·전개·반전·결말을 새로 짓는다.

${HUMOR_CODE}`;

  const user = `[주인공]
- 이름: ${name} (주인공을 부르는 이름으로만 쓴다)

[수집한 4개 조각 — 절대 기준]
- 시대: ${fragments.era}
- 신분: ${fragments.status} — ${statusDetail}
- 핵심 서사: ${fragments.story}
- 소지품: ${fragments.item}

[이야기 유형]
- ${category.name}: ${category.description}

[참고 캐릭터 — 문체·유머·서사 호흡 참고용. 설정을 이 전생에 옮기지 말 것]
- 정체성: ${asText(character.identity)}
- 시대: ${asText(character.era)}
- 신분·역할: ${asText(character.social_role)}
- 배경: ${asText(character.background)}
- 소지품: ${asText(character.core_items)}
- 고정 규칙: ${asText(character.fixed_rules)}
- 원본 이야기(문체 참고):
${asText(character.reference_story)}
${
  zodiac
    ? `
[12간지 소재 — 선택 사항, 이야기 소재로만]
- 띠: ${zodiac.zodiac_name} (띠 이름을 문양·사물·소리 같은 작은 소재로만 쓴다)
${asText(zodiac.motif_keywords) ? `- 소재 키워드: ${asText(zodiac.motif_keywords)}\n` : ''}${asText(zodiac.scene_seeds) ? `- 장면 씨앗: ${asText(zodiac.scene_seeds)}\n` : ''}`
    : ''
}
[출력 형식 — output_template 과 같은 구조의 JSON 하나만]
${asText(rule.output_template)}

- story.dialogue 는 {"speaker": "화자", "line": "대사"} 객체의 배열로 쓴다. 주인공은 speaker 를 "나" 로 쓴다. 문답 6~8회 + 괄호 지문(speaker 는 빈 문자열)으로 구성한다.
- setting 은 ~했어요/~했습니다 가 번갈아 나오는 짧은 4~5문장, ending 은 따뜻한 여운 + 마지막 한 줄 유머 회수.
- image_prompt 는 영어로, 이 전생의 인물 초상 한 장만 묘사한다. 반드시 포함: 반신상(waist-up) 3/4 측면 구도, 이 이야기의 유머가 드러나는 표정(능청스러운 미소·장난기 어린 눈빛·진지한 척하는 얼굴 중 하나), 수집한 조각과 이야기 핵심 소품(붓·문서·봇짐·관인·솥단지 등)을 들거나 착용한 모습, 시대에 맞는 의복. 건물·풍경 배경은 쓰지 않는다. 글자·한자·낙관·워터마크를 넣지 않는다.
- narration_text 는 주인공의 1인칭 독백과 대표 대사가 중심인 성우 연기용 낭독문(600자 안팎)으로 쓴다.`;
  return { system, user };
}

// =============================================================================================
// 호출 제한
// =============================================================================================
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}
  take(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

export const LIMITS = {
  perUser: { limit: 12, windowMs: 10 * 60_000 },
  perIp: { limit: 60, windowMs: 10 * 60_000 },
  storiesPerHour: 10,
  // Vercel maxDuration(60초) 안에 category + story 가 들어가야 한다
  timeouts: { category: 10_000, story: 45_000, image: 45_000, voice: 30_000 },
};

// =============================================================================================
// 핸들러 (외부 서비스는 주입 — 테스트는 가짜를 넣는다)
// =============================================================================================
export interface StoryDeps {
  fragmentSets: Record<string, FragmentSet>;
  /** 토큰 → 로그인 사용자 id (검증 실패·익명 사용자면 null) */
  verifyUser(token: string): Promise<string | null>;
  loadCategories(): Promise<CategoryRow[]>;
  loadCharacters(categoryCode: string): Promise<CharacterRow[]>;
  loadPromptRule(): Promise<PromptRuleRow | null>;
  loadZodiac(code: string): Promise<ZodiacRuleRow | null>;
  countRecentResults(userId: string, sinceIso: string): Promise<number>;
  insertResult(row: Omit<PastLifeResultRow, 'created_at'>): Promise<PastLifeResultRow>;
  getResult(id: string, userId: string): Promise<PastLifeResultRow | null>;
  listResults(userId: string, limit: number): Promise<PastLifeResultRow[]>;
  updateAssetPaths(id: string, userId: string, patch: { image_path?: string; voice_path?: string }): Promise<PastLifeResultRow>;
  upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<void>;
  generateJson(params: { system?: string; user: string; schema?: unknown; temperature?: number }, signal: AbortSignal): Promise<string>;
  /** 초상화. 모든 외부 생성이 실패하면 null (화면은 기존 캐릭터 초상화로 대체) */
  generateImage(imagePrompt: string, signal: AbortSignal): Promise<{ data: Buffer; mimeType: string } | null>;
  /** 낭독 음성(MP3). voiceHint 는 남/여 음성 선택에 쓰는 인물 묘사 */
  generateSpeech(text: string, signal: AbortSignal, voiceHint?: string): Promise<Buffer | null>;
  userLimiter: SlidingWindowLimiter;
  ipLimiter: SlidingWindowLimiter;
  timeouts?: Partial<typeof LIMITS.timeouts>;
  pickIndex?: (n: number) => number;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

class TimeoutError extends Error {}

/** 단계 소요 시간을 서버 콘솔에 남긴다 (실패해도 그대로 다시 던진다) */
async function timed<T>(label: string, run: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  try {
    const out = await run();
    console.log(`[past-life/story] ⏱ ${label} ${Date.now() - t0}ms`);
    return out;
  } catch (err) {
    console.error(`[past-life/story] ✖ ${label} ${Date.now() - t0}ms ${err instanceof TimeoutError ? 'timeout' : describeError(err).message}`);
    throw err;
  }
}

async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new TimeoutError('timeout')); // 먼저 시간 초과로 확정한 뒤
      controller.abort(); // 진행 중인 요청을 끊는다
    }, ms);
  });
  try {
    return await Promise.race([run(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

function extOf(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
}

export function createStoryHandler(deps: StoryDeps) {
  const t = { ...LIMITS.timeouts, ...(deps.timeouts ?? {}) };
  const pick = deps.pickIndex ?? ((n: number) => Math.floor(Math.random() * n));
  const categoryCache = new Map<string, string>();

  async function views(rows: PastLifeResultRow[]): Promise<PastLifeResultView[]> {
    const cats = await deps.loadCategories().catch(() => [] as CategoryRow[]);
    const codes = [...new Set(rows.map((r) => r.zodiac_code).filter((c): c is string => Boolean(c)))];
    const zodiacs = await Promise.all(codes.map((c) => deps.loadZodiac(c).catch(() => null)));
    return rows.map((row) => ({
      ...row,
      category_name: cats.find((c) => c.category_code === row.category_code)?.name ?? row.category_code,
      zodiac_name: zodiacs.find((z) => z?.zodiac_code === row.zodiac_code)?.zodiac_name ?? null,
    }));
  }
  const view = async (row: PastLifeResultRow) => (await views([row]))[0];

  async function handleStory(req: StoryRequest, userId: string): Promise<Response> {
    const set = matchFragmentSet(req.fragments, deps.fragmentSets);
    if (!set) return json(400, { error: '수집한 조각 정보가 올바르지 않습니다.' });

    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    if ((await step('db:count past_life_results', () => deps.countRecentResults(userId, since))) >= LIMITS.storiesPerHour) {
      return json(429, { error: '한 시간에 만들 수 있는 이야기 수를 넘었습니다. 잠시 후 다시 시도해 주세요.' });
    }

    const [categories, rule, zodiac] = await Promise.all([
      step('db:story_categories', () => deps.loadCategories()),
      step('db:story_prompt_rules', () => deps.loadPromptRule()),
      req.zodiacCode ? step('db:zodiac_story_rules', () => deps.loadZodiac(req.zodiacCode!)) : Promise.resolve(null),
    ]);
    if (!rule) return json(503, { error: '이야기 생성 기준(story_prompt_rules: default)을 찾지 못했습니다.' });
    if (categories.length === 0) return json(503, { error: '이야기 유형 기준(story_categories)을 찾지 못했습니다.' });

    // 1) 조각 → 카테고리 (같은 조각 조합은 이 함수 인스턴스 안에서 결과를 재사용)
    const codes = categories.map((c) => c.category_code);
    const cacheKey = JSON.stringify(req.fragments);
    let categoryCode = categoryCache.get(cacheKey) ?? null;
    if (!categoryCode || !codes.includes(categoryCode)) {
      const raw = await step('ai:category', () => withTimeout(
        (signal) =>
          deps.generateJson(
            {
              user: buildCategoryPrompt(req.fragments, set.statusDetail, categories),
              schema: {
                type: 'object',
                properties: { category_code: { type: 'string', enum: codes } },
                required: ['category_code'],
              },
              temperature: 0,
            },
            signal,
          ),
        t.category,
      ));
      let code: unknown = null;
      try {
        code = (JSON.parse(raw) as { category_code?: unknown }).category_code;
      } catch {
        code = null;
      }
      if (typeof code !== 'string' || !codes.includes(code)) {
        return json(502, { error: '이야기 유형을 정하지 못했습니다. 다시 시도해 주세요.' });
      }
      categoryCode = code;
      categoryCache.set(cacheKey, code);
    }
    const category = categories.find((c) => c.category_code === categoryCode)!;

    // 2) 같은 카테고리 캐릭터 중 하나를 문체 참고용으로
    const characters = await step('db:story_characters', () => deps.loadCharacters(category.category_code));
    if (characters.length === 0) return json(503, { error: '참고 캐릭터(story_characters)를 찾지 못했습니다.' });
    const character = characters[Math.min(characters.length - 1, Math.max(0, pick(characters.length)))];

    // 3) 스토리 생성 → 검증 → 저장
    const prompt = buildStoryPrompt({ name: req.name, fragments: req.fragments, statusDetail: set.statusDetail, category, character, rule, zodiac });
    const raw = await step('ai:story', () => withTimeout(
      (signal) => deps.generateJson({ system: prompt.system, user: prompt.user, temperature: 1 }, signal),
      t.story,
    ));
    const checked = validateStoryOutput(raw);
    if (!checked.ok) {
      console.error('[past-life/story] step=validate:story', checked.error);
      return json(502, {
        error: '생성된 이야기 형식이 올바르지 않아 저장하지 않았습니다. 다시 시도해 주세요.',
        step: 'validate:story',
        ...(exposeDetail() ? { detail: checked.error } : {}),
      });
    }

    const saved = await step('db:insert past_life_results', () => deps.insertResult({
      id: randomUUID(),
      user_id: userId,
      user_name: req.name,
      character_id: character.character_id,
      category_code: category.category_code,
      zodiac_code: zodiac ? zodiac.zodiac_code : null, // DB 기준표에 없는 띠는 저장하지 않는다
      fragments: req.fragments,
      story: checked.value,
      image_path: null,
      voice_path: null,
    }));
    return json(200, { result: { ...saved, category_name: category.name, zodiac_name: zodiac?.zodiac_name ?? null } });
  }

  async function handleAssets(req: AssetsRequest, userId: string): Promise<Response> {
    const row = await step('db:get past_life_results', () => deps.getResult(req.resultId, userId));
    if (!row) return json(404, { error: '결과를 찾을 수 없습니다.' });

    const needImage = !row.image_path;
    const needVoice = !row.voice_path;
    const [image, voice] = await Promise.allSettled([
      needImage ? timed('ai:image', () => withTimeout((sig) => deps.generateImage(row.story.image_prompt, sig), t.image)) : Promise.resolve(null),
      needVoice
        ? timed('ai:voice', () => withTimeout((sig) => deps.generateSpeech(row.story.narration_text, sig, row.story.image_prompt), t.voice))
        : Promise.resolve(null),
    ]);

    // 실패해도 이야기는 남긴다. 원인만 서버 콘솔에 남긴다
    if (image.status === 'rejected') console.error('[past-life/story] step=ai:image', describeError(image.reason));
    else if (needImage && !image.value) console.warn('[past-life/story] step=ai:image 외부 생성 실패 → 기존 캐릭터 초상화로 대체');
    if (voice.status === 'rejected') console.error('[past-life/story] step=ai:voice', describeError(voice.reason));
    else if (needVoice && !voice.value) console.error('[past-life/story] step=ai:voice', '음성 데이터가 비어 있습니다.');

    const status: Record<'image' | 'voice', 'ok' | 'failed' | 'skipped'> = {
      image: needImage ? 'failed' : 'skipped',
      voice: needVoice ? 'failed' : 'skipped',
    };
    const patch: { image_path?: string; voice_path?: string } = {};
    const uploads: Promise<void>[] = [];
    if (needImage && image.status === 'fulfilled' && image.value) {
      const path = `${userId}/${row.id}.${extOf(image.value.mimeType)}`;
      uploads.push(
        timed('storage:portrait', () => deps.upload(BUCKETS.portrait, path, image.value!.data, image.value!.mimeType)).then(() => {
          patch.image_path = path;
          status.image = 'ok';
        }),
      );
    }
    if (needVoice && voice.status === 'fulfilled' && voice.value) {
      const path = `${userId}/${row.id}.mp3`;
      uploads.push(
        timed('storage:voice', () => deps.upload(BUCKETS.voice, path, voice.value!, 'audio/mpeg')).then(() => {
          patch.voice_path = path;
          status.voice = 'ok';
        }),
      );
    }
    for (const r of await Promise.allSettled(uploads)) {
      if (r.status === 'rejected') console.error('[past-life/story] step=storage:upload', describeError(r.reason));
    }
    const updated =
      Object.keys(patch).length > 0 ? await step('db:update past_life_results', () => deps.updateAssetPaths(row.id, userId, patch)) : row;
    return json(200, { result: await view(updated), assets: status });
  }

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json(405, { error: '허용되지 않은 메서드입니다.' });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: '요청 형식이 올바르지 않습니다.' });
    }
    // 생년월일 거부·형식 검사를 가장 먼저 (본문을 어디에도 넘기지 않는다)
    const parsed = parseRequest(body);
    if (!parsed.ok) return json(400, { error: parsed.error });

    const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') ?? '')?.[1]?.trim() ?? '';
    if (!token) return json(401, { error: 'Google 로그인이 필요합니다.' });
    let userId: string | null = null;
    try {
      userId = await deps.verifyUser(token);
    } catch {
      userId = null;
    }
    if (!userId) return json(401, { error: '로그인 정보를 확인할 수 없습니다. 다시 로그인해 주세요.' });

    const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
    const usesAi = parsed.value.action === 'story' || parsed.value.action === 'assets';
    if (usesAi && (!deps.ipLimiter.take(ip) || !deps.userLimiter.take(userId))) {
      return json(429, { error: '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.' });
    }

    try {
      const req = parsed.value;
      if (req.action === 'story') return await handleStory(req, userId);
      if (req.action === 'assets') return await handleAssets(req, userId);
      if (req.action === 'list') {
        return json(200, { results: await views(await step('db:list past_life_results', () => deps.listResults(userId, 20))) });
      }
      const row = await step('db:get past_life_results', () => deps.getResult(req.resultId, userId));
      return row ? json(200, { result: await view(row) }) : json(404, { error: '결과를 찾을 수 없습니다.' });
    } catch (err) {
      const where = err instanceof StepError ? err.step : 'unknown';
      const cause = err instanceof StepError ? err.cause : err;
      if (cause instanceof TimeoutError) {
        console.error(`[past-life/story] action=${parsed.value.action} step=${where} timeout`);
        return json(504, { error: '생성 시간이 초과되었습니다. 다시 시도해 주세요.', step: where });
      }
      const info = describeError(cause);
      console.error(`[past-life/story] action=${parsed.value.action} step=${where} code=${info.code ?? '-'} ${info.message}`);
      if (where.startsWith('db:') && isSchemaMismatch(info.code)) {
        return json(503, {
          error: 'DB 테이블 구조가 코드와 다릅니다. supabase/migrations 의 SQL 을 적용했는지 확인해 주세요.',
          step: where,
          code: info.code,
          ...(exposeDetail() ? { detail: info.message } : {}),
        });
      }
      return json(502, {
        error: where.startsWith('ai:')
          ? 'AI 생성 요청이 실패했습니다. 다시 시도해 주세요.'
          : '처리 중 문제가 생겼습니다. 다시 시도해 주세요.',
        step: where,
        code: info.code,
        ...(exposeDetail() ? { detail: info.message } : {}),
      });
    }
  };
}

// =============================================================================================
// 실제 의존성. 환경변수: VITE_SUPABASE_URL(또는 SUPABASE_URL), SUPABASE_SECRET_KEY,
//                       ANTHROPIC_API_KEY, ANTHROPIC_MODEL (이야기·유형 분류 = Claude)
//                       (선택) GEMINI_API_KEY, GEMINI_IMAGE_MODEL (초상화 1순위: gemini-2.5-flash-image 무료 티어. 실패하면 Pollinations, 그것도 실패하면 기존 캐릭터 초상화)
//                       낭독 음성은 msedge-tts (키 불필요)
// =============================================================================================
export function missingServerEnv(): string[] {
  const missing: string[] = [];
  if (!(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)) missing.push('VITE_SUPABASE_URL');
  if (!process.env.SUPABASE_SECRET_KEY) missing.push('SUPABASE_SECRET_KEY');
  if (!getAnthropicApiKey()) missing.push('ANTHROPIC_API_KEY');
  return missing;
}


// =============================================================================================
// 로컬 개발 전용 시연 로그인 매핑 (운영에서는 항상 꺼짐)
// =============================================================================================
export const DEV_DEMO_TOKEN = 'dev-demo:jeonju';
const DEV_DEMO_EMAIL = 'jeonju-demo@local.test';

/** NODE_ENV=production 이거나 Vercel 에서 실행 중이면 false → Google 로그인 토큰만 허용 */
export function isDevDemoAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.NODE_ENV !== 'production' && !env.VERCEL;
}
export function isDevDemoToken(token: string): boolean {
  return token === DEV_DEMO_TOKEN && isDevDemoAllowed();
}

let devDemoUserId: string | null = null;
async function ensureDevDemoUser(admin: {
  auth: { admin: { createUser(a: object): Promise<{ data: { user: { id: string } | null }; error: unknown }>; listUsers(a: object): Promise<{ data: { users: Array<{ id: string; email?: string }> } }> } };
}): Promise<string | null> {
  if (devDemoUserId) return devDemoUserId;
  const created = await admin.auth.admin.createUser({ email: DEV_DEMO_EMAIL, email_confirm: true, user_metadata: { demo: true } });
  if (created.data.user) return (devDemoUserId = created.data.user.id);
  for (let page = 1; page <= 10; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const found = data.users.find((u) => u.email === DEV_DEMO_EMAIL);
    if (found) return (devDemoUserId = found.id);
    if (data.users.length < 200) break;
  }
  return null;
}

let realHandler: ((request: Request) => Promise<Response>) | null = null;

async function getRealHandler(): Promise<((request: Request) => Promise<Response>) | null> {
  if (realHandler) return realHandler;
  if (missingServerEnv().length > 0) return null;
  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const secretKey = (process.env.SUPABASE_SECRET_KEY || '').trim();
  const anthropicKey = getAnthropicApiKey() ?? '';
  const claudeModel = getClaudeModel();
  const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
  const geminiImageModel = (process.env.GEMINI_IMAGE_MODEL || '').trim() || 'gemini-2.5-flash-image';

  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const ROW_COLUMNS =
    'id, user_id, user_name, character_id, category_code, zodiac_code, fragments, story, image_path, voice_path, created_at';

  realHandler = createStoryHandler({
    fragmentSets: loadFragmentSets(),
    async verifyUser(token) {
      // 로컬 개발 전용: 시연 계정(jeonju/1234) 세션을 테스트용 Supabase 사용자에 매핑한다. 운영(NODE_ENV=production·Vercel)에서는 절대 열리지 않는다
      if (isDevDemoToken(token)) return ensureDevDemoUser(admin);
      const { data, error } = await admin.auth.getUser(token);
      if (error || !data.user || data.user.is_anonymous) return null;
      return data.user.id;
    },
    async loadCategories() {
      const { data, error } = await admin.from('story_categories').select('*');
      if (error) throw error;
      return (data ?? [])
        .map((r) => normalizeCategoryRow(r as Record<string, unknown>))
        .filter((r): r is CategoryRow => r !== null);
    },
    async loadCharacters(categoryCode) {
      // 10행뿐이라 전부 읽고 코드에서 거른다 (유형 컬럼 이름이 달라도 동작)
      const { data, error } = await admin.from('story_characters').select('*');
      if (error) throw error;
      return (data ?? [])
        .map((r) => normalizeCharacterRow(r as Record<string, unknown>))
        .filter((r): r is CharacterRow => r !== null && r.category_code === categoryCode)
        .sort((a, b) => a.character_id.localeCompare(b.character_id));
    },
    async loadPromptRule() {
      const { data, error } = await admin.from('story_prompt_rules').select('*');
      if (error) throw error;
      const rules = (data ?? []).map((r) => normalizePromptRuleRow(r as Record<string, unknown>));
      return rules.find((r) => r.rule_key === 'default') ?? (rules.length === 1 ? rules[0] : null);
    },
    async loadZodiac(code) {
      const { data, error } = await admin.from('zodiac_story_rules').select('*');
      if (error) throw error;
      return (
        (data ?? [])
          .map((r) => normalizeZodiacRow(r as Record<string, unknown>))
          .find((r) => r !== null && r.zodiac_code === code) ?? null
      );
    },
    async countRecentResults(userId, sinceIso) {
      const { count, error } = await admin
        .from('past_life_results')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', sinceIso);
      if (error) throw error;
      return count ?? 0;
    },
    async insertResult(row) {
      const { data, error } = await admin.from('past_life_results').insert(row).select(ROW_COLUMNS).single();
      if (error || !data) throw error ?? new Error('insert failed');
      return data as unknown as PastLifeResultRow;
    },
    async getResult(id, userId) {
      const { data, error } = await admin.from('past_life_results').select(ROW_COLUMNS).eq('id', id).eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return (data as unknown as PastLifeResultRow | null) ?? null;
    },
    async listResults(userId, limit) {
      const { data, error } = await admin
        .from('past_life_results')
        .select(ROW_COLUMNS)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as PastLifeResultRow[];
    },
    async updateAssetPaths(id, userId, patch) {
      const { data, error } = await admin
        .from('past_life_results')
        .update(patch)
        .eq('id', id)
        .eq('user_id', userId)
        .select(ROW_COLUMNS)
        .single();
      if (error || !data) throw error ?? new Error('update failed');
      return data as unknown as PastLifeResultRow;
    },
    async upload(bucket, path, data, contentType) {
      const { error } = await admin.storage.from(bucket).upload(path, data, { contentType, upsert: true });
      if (error) throw error;
    },
    async generateJson({ system, user, schema, temperature }, signal) {
      const label = schema ? 'ai:category' : 'ai:story';
      const t0 = Date.now();
      return generateClaudeJson({
        apiKey: anthropicKey,
        model: claudeModel,
        system,
        user,
        schema,
        temperature,
        maxTokens: 8192,
        signal,
        onUsage: (u) =>
          console.log(
            `[past-life/story] ${label} claude model=${u.model} input_tokens=${u.inputTokens ?? '-'} output_tokens=${u.outputTokens ?? '-'} stop=${u.stopReason ?? '-'} ${Date.now() - t0}ms`,
          ),
      });
    },
    // 초상화: Gemini(gemini-2.5-flash-image, 무료 티어) → Pollinations → null(기존 캐릭터 초상화로 대체)
    async generateImage(imagePrompt, signal) {
      return generatePortrait(imagePrompt, { geminiKey, geminiModel: geminiImageModel, signal, log: (m) => console.log(`[past-life/story] ${m}`) });
    },
    // 낭독: msedge-tts (키·결제 불필요). 인물 묘사로 남/여 음성을 고른다
    async generateSpeech(text, signal, voiceHint) {
      const voice = pickVoice(voiceHint ?? '', text);
      console.log(`[past-life/story] voice=${voice}`);
      return synthesizeSpeech(text, voice, signal);
    },
    userLimiter: new SlidingWindowLimiter(LIMITS.perUser.limit, LIMITS.perUser.windowMs),
    ipLimiter: new SlidingWindowLimiter(LIMITS.perIp.limit, LIMITS.perIp.windowMs),
  });
  return realHandler;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const handler = await getRealHandler();
    if (!handler) {
      return json(503, { error: '이야기 생성 서버 설정이 아직 완료되지 않았습니다.', missingEnv: missingServerEnv() });
    }
    return await handler(request);
  } catch {
    return json(500, { error: '서버 오류가 발생했습니다.' });
  }
}

export function GET(): Response {
  return json(405, { error: '허용되지 않은 메서드입니다.' });
}
