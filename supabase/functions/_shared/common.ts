// 공용 유틸 (Supabase Edge Function / Deno)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

/** service_role 키는 Edge Function 런타임이 SUPABASE_SERVICE_ROLE_KEY 로 자동 주입한다. 브라우저로 나가지 않는다. */
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 아이디 → 로그인용 이메일. 클라이언트(src/services/supabase/edge.ts)와 같은 규칙이어야 한다 */
export function loginIdToEmail(id: string): string {
  const hex = Array.from(new TextEncoder().encode(id.trim().toLowerCase()), (b) => b.toString(16).padStart(2, '0')).join('');
  return `id-${hex}@id.jeonju-yeojido.app`;
}

/** 인스턴스 안에서의 간단한 호출 제한(콜드 스타트 시 초기화됨). 남용 방지용 1차 방어선 */
const hits = new Map<string, number[]>();
export function rateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function clientIp(req: Request): string {
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown';
}

export function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
