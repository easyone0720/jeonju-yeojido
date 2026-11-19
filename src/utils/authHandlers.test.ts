import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

/** 브라우저 저장소 대역 (authHandlers 는 window.localStorage / sessionStorage 를 쓴다) */
function makeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    raw: m,
  };
}
const g = globalThis as unknown as { window: { localStorage: ReturnType<typeof makeStorage>; sessionStorage: ReturnType<typeof makeStorage> } };
g.window = { localStorage: makeStorage(), sessionStorage: makeStorage() };

const auth = await import('./authHandlers');

describe('로컬 회원·로그인 (authHandlers)', () => {
  beforeEach(() => {
    g.window.localStorage = makeStorage();
    g.window.sessionStorage = makeStorage();
  });

  it('앱 초기화 시 기본 계정이 localStorage 에 시드된다', async () => {
    await auth.ensureDefaultAccount();
    const users = JSON.parse(g.window.localStorage.getItem(auth.AUTH_USERS_KEY) ?? '[]') as { id: string; name: string }[];
    assert.deepEqual(users.map((u) => [u.id, u.name]), [['jeonju', '전주여행자']]);
    await auth.ensureDefaultAccount(); // 중복 시드 없음
    assert.equal(JSON.parse(g.window.localStorage.getItem(auth.AUTH_USERS_KEY) ?? '[]').length, 1);
  });

  it('기본 시연 계정 jeonju / 1234 로 로그인되고 이름은 전주여행자', async () => {
    const r = await auth.loginWithPassword({ id: 'jeonju', password: '1234' });
    assert.equal(r.ok, true);
    const info = auth.getLocalAuth();
    assert.equal(info?.displayName, '전주여행자');
    assert.equal(info?.method, 'password');
    assert.ok(g.window.localStorage.getItem(auth.AUTH_USERS_KEY), '회원 목록이 localStorage 에 저장돼야 함');
  });

  it('틀린 비밀번호는 안내 문구와 함께 거부되고 세션이 저장되지 않는다', async () => {
    const r = await auth.loginWithPassword({ id: 'jeonju', password: '9999' });
    assert.deepEqual(r, { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    assert.equal(auth.getLocalAuth(), null);
  });

  it('빈 값 안내 / 미등록 아이디는 로그인되지 않는다', async () => {
    assert.equal((await auth.loginWithPassword({ id: '', password: 'x' })).ok, false);
    assert.equal((await auth.loginWithPassword({ id: 'jeonju', password: '' })).ok, false);
    const r = await auth.loginWithPassword({ id: 'nobody', password: '1234' });
    assert.deepEqual(r, { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    assert.equal(auth.getLocalAuth(), null);
  });

  it('가입 → 저장 → 다음번에도 그 비밀번호로만 로그인된다', async () => {
    const reg = await auth.registerWithPassword({ id: 'Hong', password: 'abcd', name: '홍길동' });
    assert.equal(reg.ok, true);
    assert.equal(auth.getLocalAuth()?.displayName, '홍길동');
    g.window.sessionStorage = makeStorage(); // 로그아웃(새 탭) 가정

    assert.equal((await auth.loginWithPassword({ id: 'hong', password: 'abcd' })).ok, true);
    assert.equal(auth.getLocalAuth()?.displayName, '홍길동');
    g.window.sessionStorage = makeStorage();
    const bad = await auth.loginWithPassword({ id: 'hong', password: '1234' });
    assert.deepEqual(bad, { ok: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
  });

  it('중복 아이디 가입과 너무 짧은 값은 거부된다', async () => {
    assert.deepEqual(await auth.registerWithPassword({ id: 'jeonju', password: 'zzzz' }), {
      ok: false,
      message: '이미 사용 중인 아이디입니다.',
    });
    assert.equal((await auth.registerWithPassword({ id: 'a', password: 'zzzz' })).ok, false);
    assert.equal((await auth.registerWithPassword({ id: 'newid', password: '12' })).ok, false);
  });

  it('비밀번호 원문은 localStorage 에 저장되지 않는다', async () => {
    await auth.registerWithPassword({ id: 'secret', password: 'my-password-777' });
    const raw = g.window.localStorage.getItem(auth.AUTH_USERS_KEY) ?? '';
    assert.ok(!raw.includes('my-password-777'));
    assert.ok(!raw.includes('"1234"'));
  });

  it('소셜·게스트는 각 프로필 이름으로 세션이 저장된다', async () => {
    await auth.loginWithSocial('google');
    assert.equal(auth.getLocalAuth()?.displayName, 'Google 체험자');
    await auth.loginWithSocial('kakao');
    assert.equal(auth.getLocalAuth()?.displayName, 'Kakao 체험자');
    await auth.loginWithSocial('naver');
    assert.equal(auth.getLocalAuth()?.displayName, 'Naver 체험자');
    await auth.loginAsGuest();
    assert.equal(auth.getLocalAuth()?.displayName, '게스트 체험자');
    assert.equal(auth.getLocalAuth()?.method, 'guest');
  });
});
