import { FormEvent, useState } from 'react';
import { ArrowLeft, CheckSquare, KeyRound, Square, UserPlus } from 'lucide-react';
import { AppMode, CompanionType } from '../types/jeonju';
import { validateBirthDate } from '../utils/pastLifeEngine';

interface SceneInputConsentProps {
  mode: AppMode;
  initialVisitorName: string;
  initialBirthDate: string;
  initialCompanion: CompanionType;
  initialPermissions: { location: boolean; camera: boolean };
  onBack: () => void;
  onSubmit: (data: {
    visitorName: string;
    birthDate: string;
    companion: CompanionType;
    permissionsAcknowledged: { location: boolean; camera: boolean };
  }) => Promise<void>;
  onRecover: (data: {
    visitorName: string;
    birthDate: string;
    recoveryCode: string;
  }) => Promise<void>;
}

export function SceneInputConsent({
  mode,
  initialVisitorName,
  initialBirthDate,
  initialCompanion,
  initialPermissions,
  onBack,
  onSubmit,
  onRecover,
}: SceneInputConsentProps) {
  const [panelMode, setPanelMode] = useState<'register' | 'recover'>('register');

  // Register state
  const [visitorName, setVisitorName] = useState(initialVisitorName);
  const [birthDate, setBirthDate] = useState(
    initialBirthDate || (mode === 'demo' ? '1998-05-15' : '')
  );
  const [locationAck, setLocationAck] = useState(initialPermissions.location);
  const [cameraAck, setCameraAck] = useState(initialPermissions.camera);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Recover state
  const [recoverName, setRecoverName] = useState('');
  const [recoverBirthDate, setRecoverBirthDate] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  const handleRegisterSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const dateCheck = validateBirthDate(birthDate);
    if (!dateCheck.valid) {
      setErrorMsg(dateCheck.error ?? '생년월일을 확인해 주세요.');
      return;
    }
    if (!locationAck || !cameraAck) {
      setErrorMsg('위치와 카메라 권한 허용 안내에 모두 체크해 주세요.');
      return;
    }

    setErrorMsg(null);
    setSubmitting(true);
    try {
      await onSubmit({
        visitorName: visitorName.trim(),
        birthDate,
        companion: initialCompanion || 'alone',
        permissionsAcknowledged: {
          location: locationAck,
          camera: cameraAck,
        },
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : '체험 시작 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecoverSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const dateCheck = validateBirthDate(recoverBirthDate);
    if (!dateCheck.valid) {
      setRecoverError(dateCheck.error ?? '생년월일을 확인해 주세요.');
      return;
    }
    if (!recoveryCode.trim()) {
      setRecoverError('발급받은 복구 코드를 입력해 주세요.');
      return;
    }

    setRecoverError(null);
    setRecovering(true);
    try {
      await onRecover({
        visitorName: recoverName.trim(),
        birthDate: recoverBirthDate,
        recoveryCode: recoveryCode.trim(),
      });
    } catch (err) {
      setRecoverError(
        err instanceof Error
          ? err.message
          : '기존 기록을 불러오지 못했습니다. 입력 정보를 다시 확인해 주세요.'
      );
    } finally {
      setRecovering(false);
    }
  };

  const todayIso = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-app hanji-texture flex flex-col">
      <header className="w-full px-4 h-12 flex items-center justify-between max-w-md sm:max-w-lg mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
          aria-label="시작 화면으로 돌아가기"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>이전</span>
        </button>
        <span className="text-xs font-medium text-[#9A3412]">
          {mode === 'demo' ? '시연 모드' : '현장 체험'}
        </span>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-5 py-4 sm:py-8 flex flex-col">
        {panelMode === 'register' ? (
          <form
            onSubmit={handleRegisterSubmit}
            noValidate
            className="flex-1 bg-white border border-[#E5DDD0] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between gap-6"
          >
            <div className="space-y-6">
              {/* 1. 이름 / 별칭 (맨 위) */}
              <div className="space-y-2">
                <label
                  htmlFor="jeonsaeng-name"
                  className="block font-serif-kr text-lg font-bold text-[#1C1917]"
                >
                  이름 또는 별칭
                </label>
                <input
                  id="jeonsaeng-name"
                  type="text"
                  maxLength={16}
                  placeholder="예: 홍길동 (비워 두면 전주 나그네로 표시)"
                  value={visitorName}
                  onChange={(e) => setVisitorName(e.target.value)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base text-[#1C1917] focus:border-[#9A3412] focus:bg-white transition-colors"
                />
              </div>

              {/* 2. 생년월일 (이름 다음) */}
              <div className="space-y-2.5">
                <label
                  htmlFor="jeonsaeng-birthdate"
                  className="block font-serif-kr text-lg font-bold text-[#1C1917]"
                >
                  생년월일
                </label>
                <input
                  id="jeonsaeng-birthdate"
                  type="date"
                  required
                  min="1910-01-01"
                  max={todayIso}
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  aria-describedby="birthdate-hint"
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base text-[#1C1917] font-mono-tabular focus:border-[#9A3412] focus:bg-white transition-colors"
                />
                <p id="birthdate-hint" className="text-xs text-[#78716C]">
                  연도 - 월 - 일 (전생 조합 및 기록 복구 확인에 활용됩니다)
                </p>
              </div>

              {/* Horizontal Divider */}
              <hr className="border-[#E5DDD0]" />

              {/* 3. 권한 허용 (위치 / 카메라) */}
              <fieldset className="space-y-3">
                <legend className="flex items-baseline gap-2 pb-1">
                  <span className="font-serif-kr text-lg font-bold text-[#1C1917]">
                    권한 허용
                  </span>
                  <span className="font-sans-kr text-xs font-medium text-red-600">
                    *필수*
                  </span>
                </legend>

                <button
                  type="button"
                  role="checkbox"
                  aria-checked={locationAck}
                  onClick={() => {
                    setLocationAck((prev) => !prev);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[#FBF8F2] transition-colors flex items-start gap-3 min-h-[44px]"
                >
                  {locationAck ? (
                    <CheckSquare className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <Square className="w-5 h-5 text-[#78716C] shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <span className="text-sm font-semibold text-[#1C1917]">위치</span>
                    <p className="text-xs text-[#57534E] mt-0.5">
                      장소 도착 인증 시 현재 좌표를 확인합니다.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  role="checkbox"
                  aria-checked={cameraAck}
                  onClick={() => {
                    setCameraAck((prev) => !prev);
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-[#FBF8F2] transition-colors flex items-start gap-3 min-h-[44px]"
                >
                  {cameraAck ? (
                    <CheckSquare className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" aria-hidden="true" />
                  ) : (
                    <Square className="w-5 h-5 text-[#78716C] shrink-0 mt-0.5" aria-hidden="true" />
                  )}
                  <div>
                    <span className="text-sm font-semibold text-[#1C1917]">카메라</span>
                    <p className="text-xs text-[#57534E] mt-0.5">
                      현장 QR 스캔과 박물관 초상화 촬영 시 사용합니다.
                    </p>
                  </div>
                </button>
              </fieldset>
            </div>

            <div className="space-y-3 pt-2">
              {errorMsg && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 px-4 py-2.5 text-xs font-medium text-[#7C2D12]"
                >
                  {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] disabled:opacity-60 active:scale-[0.99] transition-all"
              >
                {submitting ? '기록 생성 중...' : '다음'}
              </button>

              {mode === 'experience' && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setRecoverError(null);
                    setPanelMode('recover');
                  }}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-xs sm:text-sm font-semibold text-[#1C1917] hover:bg-[#EFE8DC] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                  <span>이전 기록 불러오기</span>
                </button>
              )}
            </div>
          </form>
        ) : (
          <form
            onSubmit={handleRecoverSubmit}
            noValidate
            className="flex-1 bg-white border border-[#E5DDD0] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between gap-6"
          >
            <div className="space-y-5">
              <div className="space-y-1.5">
                <h1 className="font-serif-kr text-xl font-bold text-[#1C1917]">
                  이전 기록 불러오기
                </h1>
                <p className="text-xs sm:text-sm text-[#57534E] leading-relaxed">
                  다른 기기에서 이어서 진행하거나 세션이 만료된 경우, 기존에 입력한 이름(별칭), 생년월일과 발급받은 복구 코드를 입력해 주세요.
                </p>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recover-name"
                  className="block font-serif-kr text-base font-bold text-[#1C1917]"
                >
                  이름 또는 별칭
                </label>
                <input
                  id="recover-name"
                  type="text"
                  maxLength={16}
                  placeholder="예: 홍길동 (입력하지 않고 시작했다면 비워 두세요)"
                  value={recoverName}
                  onChange={(e) => {
                    setRecoverName(e.target.value);
                    if (recoverError) setRecoverError(null);
                  }}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base text-[#1C1917] focus:border-[#9A3412] focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recover-birthdate"
                  className="block font-serif-kr text-base font-bold text-[#1C1917]"
                >
                  생년월일
                </label>
                <input
                  id="recover-birthdate"
                  type="date"
                  required
                  min="1910-01-01"
                  max={todayIso}
                  value={recoverBirthDate}
                  onChange={(e) => {
                    setRecoverBirthDate(e.target.value);
                    if (recoverError) setRecoverError(null);
                  }}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base text-[#1C1917] font-mono-tabular focus:border-[#9A3412] focus:bg-white transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="recover-code"
                  className="block font-serif-kr text-base font-bold text-[#1C1917]"
                >
                  복구 코드
                </label>
                <input
                  id="recover-code"
                  type="text"
                  required
                  placeholder="예: JSYJ-XXXX-XXXX-XXXX"
                  value={recoveryCode}
                  onChange={(e) => {
                    setRecoveryCode(e.target.value);
                    if (recoverError) setRecoverError(null);
                  }}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base font-mono-tabular uppercase tracking-wider text-[#1C1917] focus:border-[#9A3412] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {recoverError && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 px-4 py-2.5 text-xs font-medium text-[#7C2D12]"
                >
                  {recoverError}
                </div>
              )}

              <button
                type="submit"
                disabled={recovering}
                className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] disabled:opacity-60 transition-all"
              >
                {recovering ? '기록 확인 중...' : '기록 불러오기'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRecoverError(null);
                  setPanelMode('register');
                }}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-xs sm:text-sm font-semibold text-[#1C1917] hover:bg-[#EFE8DC] flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserPlus className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
                <span>새 체험 시작하기로 돌아가기</span>
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
