import { FormEvent, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  AuthResult,
  LoginMethod,
  SocialProvider,
  loginAsGuest,
  loginWithPassword,
  loginWithSocial,
} from '../utils/authHandlers';

interface LoginModalProps {
  open: boolean;
  onClose: () => void;
  /** 로그인(또는 게스트 진입) 성공 시 호출. 기존 '시작하기'와 동일한 다음 단계로 이어주세요. */
  onSuccess: (method: LoginMethod) => void;
}

const SOCIAL_BUTTONS: {
  provider: SocialProvider;
  label: string;
  letter: string;
  className: string;
  letterClassName: string;
}[] = [
  {
    provider: 'google',
    label: 'Google 로그인',
    letter: 'G',
    className: 'bg-white border border-[#D6CEBE] hover:bg-[#F5EFE6]',
    letterClassName: 'text-[#4285F4]',
  },
  {
    provider: 'kakao',
    label: 'Kakao 로그인',
    letter: 'K',
    className: 'bg-[#FEE500] hover:brightness-95',
    letterClassName: 'text-[#191919]',
  },
  {
    provider: 'naver',
    label: 'Naver 로그인',
    letter: 'N',
    className: 'bg-[#03C75A] hover:brightness-95',
    letterClassName: 'text-white',
  },
];

const INPUT_CLASS =
  'w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#D6CEBE] bg-white text-base text-[#1C1917] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#9A3412] focus:ring-2 focus:ring-[#9A3412]/20 disabled:opacity-60';

export function LoginModal({ open, onClose, onSuccess }: LoginModalProps) {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<HTMLInputElement | null>(null);

  // 열릴 때마다 입력값/에러 초기화
  useEffect(() => {
    if (!open) return;
    setId('');
    setPassword('');
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

  if (!open) return null;

  // 모든 로그인 방식이 공유하는 실행 래퍼: 중복 클릭 방지 + 에러 표시 + 성공 시 콜백
  const run = async (attempt: () => Promise<AuthResult>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await attempt();
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

  const handlePasswordLogin = (e: FormEvent) => {
    e.preventDefault();
    void run(() => loginWithPassword({ id, password }));
  };
  const handleSocialLogin = (provider: SocialProvider) => void run(() => loginWithSocial(provider));
  const handleGuestLogin = () => void run(() => loginAsGuest());

  return (
    // 오버레이는 화면 전체를 덮되, 카드는 모바일 프레임(max-w-[430px]) 중앙에 뜬다.
    <div
      className="fixed inset-0 z-50 bg-[#1C1917]/55 backdrop-blur-xs flex justify-center"
      role="presentation"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <div className="relative w-full max-w-[430px] mx-auto flex items-center justify-center p-4 pointer-events-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="pointer-events-auto relative w-full rounded-2xl border-2 border-[#C7B596] bg-[#FBF8F2] p-6 shadow-2xl space-y-5"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full text-[#78716C] hover:text-[#1C1917] hover:bg-[#F5EFE6] transition-colors"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className="text-center space-y-1 pt-1">
          <h2 id="login-modal-title" className="font-serif-kr text-xl font-bold text-[#1C1917]">
            로그인
          </h2>
          <p className="text-xs text-[#78716C]">전생의 여정을 시작하기 전, 신원을 밝혀 주시게.</p>
        </div>

        <form onSubmit={handlePasswordLogin} className="space-y-3" noValidate>
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
            autoComplete="current-password"
            disabled={busy}
            className={INPUT_CLASS}
          />

          {error && (
            <p role="alert" className="text-xs text-[#B91C1C] leading-relaxed">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="hover-scale w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] active:scale-[0.99] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy ? '확인 중…' : '로그인'}
          </button>
        </form>

        <div className="space-y-3">
          <div className="flex items-center gap-3 text-[11px] text-[#A8A29E]" aria-hidden="true">
            <span className="flex-1 h-px bg-[#E5DDD0]" />
            <span>간편 로그인</span>
            <span className="flex-1 h-px bg-[#E5DDD0]" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            {SOCIAL_BUTTONS.map(({ provider, label, letter, className, letterClassName }) => (
              <button
                key={provider}
                type="button"
                aria-label={label}
                title={label}
                disabled={busy}
                onClick={() => handleSocialLogin(provider)}
                className={`aspect-square w-full max-h-[64px] rounded-xl flex items-center justify-center shadow-sm transition active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
              >
                <span aria-hidden="true" className={`text-2xl font-extrabold leading-none ${letterClassName}`}>
                  {letter}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={busy}
            className="min-h-[40px] px-2 text-sm font-medium text-[#57534E] hover:text-[#9A3412] underline underline-offset-4 transition-colors disabled:opacity-60"
          >
            게스트 로그인
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
