import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle2, Copy, Download, Ticket } from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { apiFetch } from '../utils/localApi';
import { Modal } from './admin/ui';

interface AdminOpsToolsProps {
  /** 쿠폰 바코드 검증(서버 API)은 서버 모드에서만 제공한다 */
  showCouponRedeem: boolean;
  passcode: string;
}

/** 스마트폰 카메라로 스캔되도록 큰 해상도로 만든다. 화면에서는 CSS 로 줄여 보여 준다. */
const QR_PIXELS = 1024;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** 현장 운영 도구: 거점 QR 코드 발급(복사·확대·저장) + 제휴 매장 쿠폰 바코드 검증 */
export function AdminOpsTools({ showCouponRedeem, passcode }: AdminOpsToolsProps) {
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const copyTimer = useRef<number | undefined>(undefined);

  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponRedeeming, setCouponRedeeming] = useState(false);
  const [couponRedeemResult, setCouponRedeemResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const generateQrs = async () => {
      const map: Record<string, string> = {};
      for (const spot of JEONJU_SPOTS) {
        map[spot.id] = await QRCode.toDataURL(spot.qrCodeValue, {
          width: QR_PIXELS,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: { dark: '#1D2A3A', light: '#FFFFFF' },
        });
      }
      if (!cancelled) setQrImages(map);
    };
    void generateQrs();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => () => window.clearTimeout(copyTimer.current), []);

  const handleCopy = useCallback(async (id: string, url: string) => {
    const ok = await copyText(url);
    if (!ok) return;
    setCopiedId(id);
    window.clearTimeout(copyTimer.current);
    copyTimer.current = window.setTimeout(() => setCopiedId(null), 1800);
  }, []);

  const handleRedeemCouponCode = async (e: FormEvent) => {
    e.preventDefault();
    const code = couponCodeInput.trim();
    if (!code) {
      setCouponRedeemResult({ ok: false, message: '쿠폰 바코드 번호를 입력해 주세요.' });
      return;
    }
    setCouponRedeeming(true);
    setCouponRedeemResult(null);
    try {
      const res = await apiFetch('/api/admin/coupons/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: (passcode || '전주2026').trim(), issueCode: code }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        couponTitle?: string;
        visitorName?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setCouponRedeemResult({ ok: false, message: data.error || '쿠폰 바코드 검증에 실패했습니다.' });
        return;
      }
      setCouponRedeemResult({
        ok: true,
        message: `사용 확정 완료: ${data.visitorName ?? '여행자'} 님 · ${data.couponTitle ?? code}`,
      });
      setCouponCodeInput('');
    } catch {
      setCouponRedeemResult({ ok: false, message: '네트워크 오류로 바코드를 검증하지 못했습니다.' });
    } finally {
      setCouponRedeeming(false);
    }
  };

  const previewSpot = JEONJU_SPOTS.find((s) => s.id === previewId) ?? null;

  const renderCopy = (id: string, url: string) => (
    <button
      type="button"
      onClick={() => void handleCopy(id, url)}
      aria-label={`${url} 주소 복사`}
      className="group inline-flex max-w-full items-start gap-1 rounded-md px-1 py-0.5 text-left text-[10px] leading-snug text-[#2E4057] hover:bg-[#EAE2D0]"
    >
      <span className="[overflow-wrap:anywhere] underline decoration-dotted underline-offset-2">{url}</span>
      {copiedId === id ? (
        <span className="inline-flex shrink-0 items-center gap-0.5 font-bold text-[#1F8F52]" role="status">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          복사됨
        </span>
      ) : (
        <Copy className="mt-0.5 h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" aria-hidden="true" />
      )}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="@container">
        <p className="mb-2 text-[13px] font-bold text-[#172638]">현장 안내판 설치용 장소 QR코드</p>
        <ul className="grid grid-cols-2 gap-2.5 @[360px]:grid-cols-3 @[470px]:grid-cols-5">
          {JEONJU_SPOTS.map((spot) => (
            <li
              key={spot.id}
              className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl border border-[#D1C8B8] bg-white p-2.5 text-center"
            >
              {qrImages[spot.id] ? (
                <button
                  type="button"
                  onClick={() => setPreviewId(spot.id)}
                  aria-label={`${spot.name} QR코드 크게 보기`}
                  className="rounded-lg border border-[#D1C8B8] bg-white p-1 hover:border-[#F28C18] focus-visible:outline-2 focus-visible:outline-[#F28C18]"
                >
                  <img src={qrImages[spot.id]} alt={`${spot.name} 공식 QR코드`} className="aspect-square w-full max-w-[104px]" />
                </button>
              ) : (
                <div className="aspect-square w-full max-w-[104px] animate-pulse rounded-lg bg-[#EAE2D0]" aria-hidden="true" />
              )}
              <p className="min-h-[2.4em] break-keep text-[13px] font-bold leading-tight text-[#172638]">{spot.name}</p>
              {renderCopy(spot.id, spot.qrCodeValue)}
              {qrImages[spot.id] && (
                <a
                  href={qrImages[spot.id]}
                  download={`${spot.name}_QR.png`}
                  className="mt-auto inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#D1C8B8] bg-[#F4F0E8] px-3 text-xs font-bold text-[#172638] hover:bg-[#EAE2D0]"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  저장
                </a>
              )}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-[#6B7C93]">QR을 누르면 크게 볼 수 있고, 주소를 누르면 복사됩니다. 저장 파일은 {QR_PIXELS}px PNG입니다.</p>
      </div>

      {showCouponRedeem && (
        <section className="space-y-3 rounded-xl border-2 border-[#F28C18] bg-[#FFF8EE] p-4">
          <div className="flex items-center gap-2">
            <Ticket className="h-4 w-4 text-[#F28C18]" aria-hidden="true" />
            <h3 className="text-sm font-bold text-[#172638]">제휴 매장 · 운영자 쿠폰 바코드 검증 및 사용 확정</h3>
          </div>
          <p className="text-xs text-[#2E4057]">
            발급된 쿠폰 바코드(JSYJ-LV-...)를 검증하여 중복 사용 없이 단 1회만 사용 확정 처리합니다. 시연용(DEMO) 바코드는 실제 매장 사용이 차단됩니다.
          </p>
          <form onSubmit={handleRedeemCouponCode} className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value)}
              placeholder="예: JSYJ-LV-GJ-XXXXXXXX-XXXX"
              aria-label="쿠폰 바코드 번호 입력"
              className="min-h-[46px] flex-1 rounded-xl border border-[#D1C8B8] bg-white px-4 py-2 text-sm uppercase tabular-nums text-[#172638]"
            />
            <button
              type="submit"
              disabled={couponRedeeming}
              className="min-h-[46px] whitespace-nowrap rounded-xl bg-[#1D2A3A] px-5 py-2 text-sm font-bold text-white hover:bg-[#2E4057] disabled:opacity-60"
            >
              {couponRedeeming ? '검증 중...' : '바코드 검증 · 사용 확정'}
            </button>
          </form>
          {couponRedeemResult && (
            <div
              role="status"
              className={`flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-semibold ${
                couponRedeemResult.ok ? 'border-[#39B86C] text-[#172638]' : 'border-[#C0392B] text-[#C0392B]'
              }`}
            >
              {couponRedeemResult.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span>{couponRedeemResult.message}</span>
            </div>
          )}
        </section>
      )}

      {previewSpot && qrImages[previewSpot.id] && (
        <Modal title={`${previewSpot.name} QR코드`} onClose={() => setPreviewId(null)} widthClass="max-w-sm">
          <div className="flex flex-col items-center gap-3">
            <img
              src={qrImages[previewSpot.id]}
              alt={`${previewSpot.name} 공식 QR코드 확대`}
              className="aspect-square w-full max-w-[300px] rounded-xl border border-[#D1C8B8] bg-white p-2"
            />
            {renderCopy(`preview-${previewSpot.id}`, previewSpot.qrCodeValue)}
            <a
              href={qrImages[previewSpot.id]}
              download={`${previewSpot.name}_QR.png`}
              className="inline-flex min-h-[42px] items-center gap-1.5 rounded-lg bg-[#1D2A3A] px-4 text-sm font-bold text-white hover:bg-[#2E4057]"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {previewSpot.name}_QR.png 저장
            </a>
          </div>
        </Modal>
      )}
    </div>
  );
}
