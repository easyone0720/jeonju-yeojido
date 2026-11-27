import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loginIdToEmail } from '../../src/services/supabase/edge.ts';

describe('간편 회원가입 로그인 이메일 규칙', () => {
  it('아이디(대소문자·한글 포함)를 소문자 UTF-8 16진수로 바꿔 내부 이메일로 쓴다', () => {
    assert.equal(loginIdToEmail('Hong'), 'id-686f6e67@id.jeonju-yeojido.app');
    assert.equal(loginIdToEmail(' hong '), loginIdToEmail('HONG'));
    assert.match(loginIdToEmail('홍길동'), /^id-[0-9a-f]+@id\.jeonju-yeojido\.app$/);
  });

  it('Edge Function(Deno)의 규칙과 같다', async () => {
    const src = await readFile('supabase/functions/_shared/common.ts', 'utf8');
    assert.ok(src.includes("toString(16).padStart(2, '0')") && src.includes('@id.jeonju-yeojido.app'));
  });
});
