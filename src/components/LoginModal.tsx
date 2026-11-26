import { FormEvent, ReactNode, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { isSupabaseConfigured } from '../services/supabase/client';
import {
  AuthResult,
  DEFAULT_DEMO_ACCOUNT,
  LoginMethod,
  SocialProvider,
  loginAsGuest,
  getGoogleClientId,
  loadGoogleIdentity,
  loginWithGoogleCredential,
  loginWithSupabaseGoogle,
  loginWithPassword,
  loginWithSocial,
  registerWithPassword,
} from '../utils/authHandlers';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** 로그인(또는 게스트 진입) 성공 시 호출. 기존 '시작하기'와 동일한 다음 단계로 이어주세요. */
  onSuccess: (method: LoginMethod) => void;
}

type AuthTab = 'login' | 'signup';

/** 공식 브랜드 컬러의 원형 로고 버튼 정의 */
const SOCIAL_BUTTONS: {
  provider: SocialProvider;
  label: string;
  className: string;
  icon: ReactNode;
}[] = [
  {
    provider: 'google',
    label: 'Google 로그인',
    className: 'bg-white border border-[#D6D3D1] shadow-sm hover:bg-[#FAFAF9]',
    icon: (
      <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true">
        <path
          fill="#EA4335"
          d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        />
        <path
          fill="#4285F4"
          d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        />
        <path
          fill="#FBBC05"
          d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        />
        <path
          fill="#34A853"
          d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        />
      </svg>
    ),
  },
  {
    provider: 'kakao',
    label: 'Kakao 로그인',
    className: 'bg-[#FEE500] shadow-sm hover:brightness-95',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          fill="#3C1E1E"
          d="M12 3C6.48 3 2 6.58 2 11c0 2.84 1.87 5.33 4.69 6.75l-.95 3.5c-.08.3.26.54.52.37l4.15-2.74c.52.07 1.05.12 1.59.12 5.52 0 10-3.58 10-8S17.52 3 12 3z"
        />
      </svg>
    ),
  },
  {
    provider: 'naver',
    label: 'Naver 로그인',
    className: 'bg-[#03C75A] shadow-sm hover:brightness-95',
    icon: (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path fill="#FFFFFF" d="M16.273 12.845 7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z" />
      </svg>
    ),
  },
];

const INPUT_CLASS =
  'w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#D6CBB9] bg-[#F3ECE0] text-base text-[#26201B] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#8E3524] focus:ring-2 focus:ring-[#8E3524]/20 disabled:opacity-60';

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [tab, setTab] = useState<AuthTab>('login');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<HTMLInputElement | null>(null);
  const googleSlotRef = useRef<HTMLDivElement | null>(null);
  const [googleReady, setGoogleReady] = useState(false);
  const runRef = useRef<(attempt: () => Promise<AuthResult>) => Promise<void>>(async () => {});

  // 열릴 때마다 입력값/에러 초기화
  useEffect(() => {
    if (!open) return;
    setTab('login');
    setId('');
    setPassword('');
    setName('');
    setError(null);
    setBusy(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => idRef.current?.focus());

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Google Identity Services: 클라이언트 ID 가 있으면 공식 버튼(투명)을 구글 원형 버튼 위에 얹어
  // 클릭 시 실제 구글 계정 로그인 팝업이 열리게 한다. 없거나 로드에 실패하면 체험자 계정으로 폴백한다.
  useEffect(() => {
    if (!open) return;
    const clientId = getGoogleClientId();
    setGoogleReady(false);
    // Supabase 가 설정돼 있으면 Google 로그인은 Supabase Auth(OAuth 이동)로만 처리한다
    if (!clientId || isSupabaseConfigured()) return;
    let cancelled = false;
    void loadGoogleIdentity().then((gsi) => {
      if (cancelled) return;
      const slot = googleSlotRef.current;
      if (!gsi || !slot) {
        console.info('[로그인] Google 스크립트를 불러오지 못해 "Google 체험자" 폴백을 사용합니다.');
        return;
      }
      gsi.initialize({
        client_id: clientId,
        ux_mode: 'popup',
        auto_select: false,
        callback: (response) => {
          if (response.credential) {
            void runRef.current(() => loginWithGoogleCredential(response.credential as string));
          }
        },
      });
      slot.innerHTML = '';
      gsi.renderButton(slot, { type: 'icon', shape: 'circle', size: 'large', theme: 'outline' });
      setGoogleReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  // 모든 로그인 방식이 공유하는 실행 래퍼: 중복 클릭 방지 + 에러 표시 + 성공 시 콜백
  const run = async (attempt: () => Promise<AuthResult>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await attempt();
      if (result.ok && result.redirecting) {
        return; // Google 로그인 화면으로 이동 중 — 돌아오면 SceneStart 가 이어서 진행한다
      }
      if (result.ok) {
        onSuccess(result.method);
      } else {
        setError(result.message);
      }
    } catch {
      setError('로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  };

  runRef.current = run;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (tab === 'signup') void run(() => registerWithPassword({ id, password, name }));
    else void run(() => loginWithPassword({ id, password }));
  };
  const handleSocialLogin = (provider: SocialProvider) =>
    void run(() =>
      provider === 'google' && isSupabaseConfigured() ? loginWithSupabaseGoogle() : loginWithSocial(provider),
    );
  const handleGuestLogin = () => void run(() => loginAsGuest());
  const switchTab = (next: AuthTab) => {
    if (busy) return;
    setTab(next);
    setError(null);
  };

  const tabClass = (active: boolean) =>
    `flex-1 min-h-[40px] rounded-lg text-sm font-semibold transition-colors disabled:opacity-60 ${
      active ? 'bg-[#8E3524] text-[#FBF8F1] shadow-sm' : 'text-[#5C5349] hover:bg-[#F5EFE6]'
    }`;

  return (
    // 오버레이는 화면 전체를 덮되, 카드는 모바일 프레임(max-w-[430px]) 중앙에 뜬다.
    <div
      className="fixed inset-0 z-50 bg-[#26201B]/45 backdrop-blur-sm flex justify-center"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div className="relative w-full max-w-[430px] mx-auto flex items-center justify-center px-4 py-4 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="login-modal-title"
          onClick={(e) => e.stopPropagation()}
          className="pointer-events-auto relative w-[calc(100vw-2rem)] max-w-[430px] max-h-full overflow-y-auto rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] p-6 shadow-2xl space-y-5"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-[#5C5349] hover:text-[#26201B] hover:bg-[#F5EFE6] transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="text-center space-y-1 pt-1">
            <h2 id="login-modal-title" className="font-serif-kr text-[clamp(1rem,2.4vw,1.25rem)] font-bold text-[#26201B]">
              {tab === 'login' ? '로그인' : '간편 회원가입'}
            </h2>
            <p className="text-xs text-[#5C5349]">전생의 여정을 시작하기 전, 신원을 밝혀 주시게.</p>
          </div>

          <div role="tablist" aria-label="로그인 방식" className="flex gap-1 rounded-xl bg-[#F0EAE0] p-1">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'login'}
              disabled={busy}
              onClick={() => switchTab('login')}
              className={tabClass(tab === 'login')}
            >
              로그인
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'signup'}
              disabled={busy}
              onClick={() => switchTab('signup')}
              className={tabClass(tab === 'signup')}
            >
              간편 회원가입
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <input
              ref={idRef}
              type="text"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="아이디 또는 이메일"
              aria-label="ID"
              autoComplete="username"
              disabled={busy}
              className={INPUT_CLASS}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              aria-label="비밀번호"
              autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              disabled={busy}
              className={INPUT_CLASS}
            />
            {tab === 'signup' && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름 (선택, 비우면 아이디로 표시)"
                aria-label="이름"
                maxLength={16}
                autoComplete="name"
                disabled={busy}
                className={INPUT_CLASS}
              />
            )}

            {error && (
              <p role="alert" className="text-xs text-[#B91C1C] leading-relaxed">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="hover-scale w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] active:scale-[0.99] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy ? '확인 중…' : tab === 'signup' ? '가입하고 시작하기' : '로그인'}
            </button>
            {tab === 'login' && (
              <p className="text-center text-[11px] text-[#5C5349]">
                시연 계정: {DEFAULT_DEMO_ACCOUNT.id} / {DEFAULT_DEMO_ACCOUNT.password}
              </p>
            )}
          </form>

          <div className="space-y-3">
            <div className="flex items-center gap-3 text-[11px] text-[#A8A29E]" aria-hidden="true">
              <span className="flex-1 h-px bg-[#E5DDD0]" />
              <span>간편 로그인</span>
              <span className="flex-1 h-px bg-[#E5DDD0]" />
            </div>

            <div className="flex items-center justify-center gap-5">
              {SOCIAL_BUTTONS.map(({ provider, label, className, icon }) => (
                <div key={provider} className="relative w-12 h-12">
                  <button
                    type="button"
                    aria-label={label}
                    title={label}
                    disabled={busy}
                    onClick={() => handleSocialLogin(provider)}
                    className={`rounded-full w-12 h-12 flex items-center justify-center transition active:scale-[0.96] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
                  >
                    {icon}
                  </button>
                  {provider === 'google' && (
                    // 공식 Google 버튼(투명)이 위에 덮여 실제 클릭을 받는다. 준비 전에는 아래 버튼(폴백)이 동작한다.
                    <div
                      aria-hidden="true"
                      className={`absolute inset-0 rounded-full overflow-hidden opacity-[0.01] ${
                        googleReady && !busy ? '' : 'pointer-events-none'
                      }`}
                    >
                      <div
                        ref={googleSlotRef}
                        className="w-full h-full flex items-center justify-center"
                        style={{ transform: 'scale(1.3)', transformOrigin: 'center' }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={handleGuestLogin}
              disabled={busy}
              className="min-h-[40px] px-2 text-sm font-medium text-[#5C5349] hover:text-[#8E3524] underline underline-offset-4 transition-colors disabled:opacity-60"
            >
              게스트 로그인
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
