import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANTHROPIC_MESSAGES_URL,
  ANTHROPIC_VERSION,
  ClaudeApiError,
  DEFAULT_CLAUDE_MODEL,
  extractJsonText,
  generateClaudeJson,
  getAnthropicApiKey,
  getClaudeModel,
} from './claudeClient.ts';

test('API 키: 비었거나 예시값이면 null, 실제 값이면 그대로', () => {
  assert.equal(getAnthropicApiKey({}), null);
  assert.equal(getAnthropicApiKey({ ANTHROPIC_API_KEY: '  ' }), null);
  assert.equal(getAnthropicApiKey({ ANTHROPIC_API_KEY: 'MY_ANTHROPIC_API_KEY' }), null);
  assert.equal(getAnthropicApiKey({ ANTHROPIC_API_KEY: 'sk-ant-real' }), 'sk-ant-real');
  // 브라우저용 VITE_ 키는 서버에서 읽지 않는다 (키가 번들에 실리는 것을 막는다)
  assert.equal(getAnthropicApiKey({ VITE_ANTHROPIC_API_KEY: 'sk-ant-real' }), null);
});

test('모델: ANTHROPIC_MODEL 이 없으면 기본값', () => {
  assert.equal(getClaudeModel({}), DEFAULT_CLAUDE_MODEL);
  assert.equal(getClaudeModel({ ANTHROPIC_MODEL: 'claude-haiku-5-5' }), 'claude-haiku-5-5');
});

test('extractJsonText: 코드 울타리·앞뒤 설명 제거', () => {
  assert.equal(extractJsonText('```json\n{"a":1}\n```'), '{"a":1}');
  assert.equal(extractJsonText('답변입니다. {"a":{"b":2}} 끝'), '{"a":{"b":2}}');
  assert.equal(extractJsonText('JSON 없음'), 'JSON 없음');
});

test('generateClaudeJson: Messages API 형식으로 요청하고 text 블록을 이어 붙인다', async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
    seen = { url: String(url), init: init ?? {} };
    return new Response(
      JSON.stringify({ content: [{ type: 'text', text: '{"category_code":' }, { type: 'text', text: '"heritage"}' }] }),
      { status: 200 },
    );
  }) as typeof fetch;
  const out = await generateClaudeJson({
    apiKey: 'sk-ant-secret', model: 'm', system: 'sys', user: 'hello',
    schema: { type: 'object' }, temperature: 5, fetchImpl,
  });
  assert.equal(out, '{"category_code":"heritage"}');
  assert.equal(seen!.url, ANTHROPIC_MESSAGES_URL);
  const headers = seen!.init.headers as Record<string, string>;
  assert.equal(headers['x-api-key'], 'sk-ant-secret');
  assert.equal(headers['anthropic-version'], ANTHROPIC_VERSION);
  const body = JSON.parse(String(seen!.init.body));
  assert.equal(body.model, 'm');
  assert.deepEqual(body.messages, [{ role: 'user', content: 'hello' }]);
  assert.match(body.system, /^sys/);
  assert.match(body.system, /JSON Schema/);
  assert.equal(body.temperature, undefined); // 최신 모델은 temperature 를 거부하므로 보내지 않는다
});

test('generateClaudeJson: 오류 메시지에 API 키가 들어가지 않는다', async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: 'invalid x-api-key' } }), { status: 401 })) as typeof fetch;
  await assert.rejects(
    generateClaudeJson({ apiKey: 'sk-ant-secret', user: 'x', fetchImpl }),
    (err: unknown) => {
      assert.ok(err instanceof ClaudeApiError);
      assert.equal(err.status, 401);
      assert.doesNotMatch(err.message, /sk-ant-secret/);
      return true;
    },
  );
});
