/**
 * Claude(Anthropic Messages API) 호출 헬퍼 — 서버 전용.
 *
 * - 엔드포인트: https://api.anthropic.com/v1/messages (SDK 없이 fetch 만 사용)
 * - API 키는 서버 환경변수 ANTHROPIC_API_KEY 에서만 읽는다. 코드에 쓰지 않고, 브라우저(VITE_*)로도 내보내지 않는다.
 * - 키·요청 헤더는 오류 메시지·로그에 절대 넣지 않는다.
 * - 이 모듈은 Node 내장 API 와 전역 fetch 만 쓴다 (server.ts 와 Vercel 함수 api/past-life/story.ts 가 함께 쓴다).
 */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';
/** ANTHROPIC_MODEL 이 비어 있을 때 쓰는 기본 모델 */
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS = 8192; // 한국어 대사가 많은 스토리 JSON 이 2048 에서 잘려 파싱 실패하던 문제(502 validate:story)

/** 예시값(.env.example 의 자리표시자)은 "키 없음" 으로 본다 */
const PLACEHOLDER_KEY = /^(MY_|YOUR_|your[-_]|<|sk-ant-\.\.\.|changeme)/i;

export function getAnthropicApiKey(env: Record<string, string | undefined> = process.env): string | null {
  const key = (env.ANTHROPIC_API_KEY ?? '').trim();
  if (!key || PLACEHOLDER_KEY.test(key)) return null;
  return key;
}

export function getClaudeModel(env: Record<string, string | undefined> = process.env): string {
  return (env.ANTHROPIC_MODEL ?? '').trim() || DEFAULT_CLAUDE_MODEL;
}

/** 모델이 ```json 울타리나 앞뒤 설명을 붙여도 JSON 본문만 꺼낸다. JSON 이 없으면 원문을 그대로 돌려준다 */
export function extractJsonText(text: string): string {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
}

export interface ClaudeJsonParams {
  apiKey: string;
  model?: string;
  system?: string;
  user: string;
  /** JSON Schema. 주어지면 시스템 지시문에 덧붙여 "이 스키마의 JSON 한 개만" 답하게 한다 */
  schema?: unknown;
  /** 0~1 (Claude 범위로 맞춰 보낸다) */
  temperature?: number;
  maxTokens?: number;
  /** 응답의 토큰 사용량(input_tokens/output_tokens)과 stop_reason 을 받아 로그에 남기는 콜백 */
  onUsage?: (usage: { inputTokens: number | null; outputTokens: number | null; stopReason: string | null; model: string }) => void;
  signal?: AbortSignal;
  /** 테스트용 주입 */
  fetchImpl?: typeof fetch;
}

/** Claude 호출 실패. status 는 HTTP 상태(없으면 undefined). 메시지에는 키가 들어가지 않는다 */
export class ClaudeApiError extends Error {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
  }
}

/**
 * Messages API 로 JSON 응답을 받는다. 반환값은 JSON 문자열(울타리 제거됨) — 기존 Gemini 의
 * `responseMimeType: application/json` 결과(`res.text`)와 같은 계약이라 호출 측 파서를 바꿀 필요가 없다.
 */
export async function generateClaudeJson(params: ClaudeJsonParams): Promise<string> {
  const jsonRule = params.schema
    ? `\n\n반드시 아래 JSON Schema 를 만족하는 JSON 객체 하나만 출력하세요. 마크다운 코드 울타리나 설명 문장은 붙이지 마세요.\n${JSON.stringify(params.schema)}`
    : '\n\n반드시 유효한 JSON 객체 하나만 출력하세요. 마크다운 코드 울타리나 설명 문장은 붙이지 마세요.';
  const body: Record<string, unknown> & { model: string } = {
    model: params.model || DEFAULT_CLAUDE_MODEL,
    max_tokens: params.maxTokens ?? DEFAULT_MAX_TOKENS,
    system: `${params.system ?? ''}${jsonRule}`.trim(),
    messages: [{ role: 'user', content: params.user }],
  };
  // temperature(0~1)는 지원하는 모델(haiku-4-5 등)에서만 보낸다. 최신 모델이 400 으로 거부하면 아래에서 빼고 한 번 다시 보낸다.
  if (params.temperature !== undefined) body.temperature = Math.min(1, Math.max(0, params.temperature));

  type Payload = {
    content?: Array<{ type?: string; text?: string }>;
    stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number };
    error?: { type?: string; message?: string };
  };
  const doFetch = params.fetchImpl ?? fetch;
  async function send(): Promise<{ res: Response; payload: Payload }> {
    let res: Response;
    try {
      res = await doFetch(ANTHROPIC_MESSAGES_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': params.apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: params.signal,
      });
    } catch (err) {
      if (params.signal?.aborted) throw err; // 취소는 호출 측이 구분할 수 있게 그대로 올린다
      throw new ClaudeApiError(`Claude 요청 실패: ${err instanceof Error ? err.message : 'network error'}`);
    }
    let payload: Payload = {};
    try {
      payload = (await res.json()) as Payload;
    } catch {
      // JSON 이 아닌 응답은 아래에서 상태 코드로 처리
    }
    return { res, payload };
  }

  let { res, payload } = await send();
  if (!res.ok && res.status === 400 && body.temperature !== undefined && /temperature/i.test(payload.error?.message ?? '')) {
    delete body.temperature;
    ({ res, payload } = await send());
  }
  if (!res.ok) {
    const detail = payload.error?.message ? `: ${payload.error.message}` : '';
    throw new ClaudeApiError(`Claude API ${res.status}${detail}`.slice(0, 300), res.status);
  }
  const text = (payload.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('');
  params.onUsage?.({
    inputTokens: payload.usage?.input_tokens ?? null,
    outputTokens: payload.usage?.output_tokens ?? null,
    stopReason: payload.stop_reason ?? null,
    model: body.model,
  });
  if (payload.stop_reason === 'max_tokens') {
    throw new ClaudeApiError('Claude 응답이 max_tokens 에서 잘렸습니다 (JSON 불완전)');
  }
  return extractJsonText(text);
}
