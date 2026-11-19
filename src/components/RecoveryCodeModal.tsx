import { useState } from 'react';
import { Check, Copy, KeyRound, ShieldCheck } from 'lucide-react';

interface RecoveryCodeModalProps {
  open: boolean;
  recoveryCode: string | null;
  visitorName: string;
  onConfirmStart: () => void;
}

export function RecoveryCodeModal({
  open,
  recoveryCode,
  visitorName,
  onConfirmStart,
}: RecoveryCodeModalProps) {
  const [copied, setCopied] = useState(false);

  if (!open || !recoveryCode) return null;

  const displayName = visitorName.trim() || '전주의 나그네';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback selection copy
      const el = document.getElementById('recovery-code-display');
      if (el && window.getSelection) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#26201B]/45 backdrop-blur-sm flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-modal-title"
        className="w-[calc(100vw-2rem)] max-w-[430px] rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] p-6 shadow-2xl space-y-5"
      >
        <div className="space-y-2 text-center">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#8E3524]/10 text-[#8E3524] mx-auto">
            <KeyRound className="w-6 h-6" aria-hidden="true" />
          </span>
          <h2
            id="recovery-modal-title"
            className="font-serif-kr text-xl font-bold text-[#26201B]"
          >
            {displayName}님의 기록 복구 코드
          </h2>
          <p className="text-xs sm:text-sm text-[#5C5349] leading-relaxed">
            이 코드를 보관하면 다른 기기에서도 전생의 기록을 다시 불러올 수 있습니다.
          </p>
        </div>

        <div className="rounded-xl border-2 border-[#D6CBB9] bg-[#F3ECE0] p-4 text-center space-y-3">
          <p
            id="recovery-code-display"
            className="font-mono-tabular text-lg sm:text-xl font-bold tracking-wider text-[#8E3524] select-all"
          >
            {recoveryCode}
          </p>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-4 py-2 rounded-lg border border-[#C4B8A3] bg-[#FBF8F1] hover:bg-[#F3ECE0] text-xs font-semibold text-[#26201B] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-[#16A34A]" aria-hidden="true" />
                <span className="text-[#14532D]">복구 코드가 복사되었습니다</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                <span>복구 코드 복사하기</span>
              </>
            )}
          </button>
        </div>

        <div className="rounded-xl border border-[#D6CBB9] bg-[#F7F1E4]/70 p-3 flex items-start gap-2 text-xs text-[#5C5349] leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-[#8E3524] shrink-0 mt-0.5" aria-hidden="true" />
          <span>
            보안을 위해 복구 코드는 암호화되어 저장되며 지금 한 번만 표시됩니다. 화면을 닫기 전에 메모하거나 복사해 두세요.
          </span>
        </div>

        <button
          type="button"
          onClick={onConfirmStart}
          className="w-full min-h-[50px] px-6 py-3 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] transition-colors"
        >
          코드 확인 및 탐험 시작
        </button>
      </div>
    </div>
  );
}
