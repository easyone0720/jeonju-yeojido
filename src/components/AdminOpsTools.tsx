import { FormEvent, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { AlertCircle, CheckCircle2, Download, QrCode, Ticket } from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { apiFetch } from '../utils/localApi';

interface AdminOpsToolsProps {
  /** 쿠폰 바코드 검증(서버 API)은 서버 모드에서만 제공한다 */
  showCouponRedeem: boolean;
  passcode: string;
}

/** 현장 운영 도구: 거점 QR 코드 발급 + 제휴 매장 쿠폰 바코드 검증 (대시보드 하단) */
export function AdminOpsTools({ showCouponRedeem, passcode }: AdminOpsToolsProps) {
  const [qrImages, setQrImages] = useState<Record<string, string>>({});
  const [couponCodeInput, setCouponCodeInput] = useState('');
  const [couponRedeeming, setCouponRedeeming] = useState(false);
  const [couponRedeemResult, setCouponRedeemResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const generateQrs = async () => {
      const map: Record<string, string> = {};
      for (const spot of JEONJU_SPOTS) {
        map[spot.id] = await QRCode.toDataURL(spot.qrCodeValue, {
          width: 220,
          margin: 2,
          color: { dark: '#1C1917', light: '#FBF8F2' },
        });
      }
      if (!cancelled) setQrImages(map);
    };
    void generateQrs();
    return () => {
      cancelled = true;
    };
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

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[#E5DDD0] bg-white p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-[#F0EAE0] pb-3">
          <QrCode className="w-4 h-4 text-[#9A3412]" aria-hidden="true" />
          <h2 className="font-serif-kr text-lg font-bold text-[#1C1917]">현장 안내판 설치용 장소 QR코드</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {JEONJU_SPOTS.map((spot) => (
            <div
              key={spot.id}
              className="rounded-xl border border-[#E5DDD0] bg-[#FBF8F2] p-3 flex flex-col items-center text-center space-y-2"
            >
              {qrImages[spot.id] && (
                <img
                  src={qrImages[spot.id]}
                  alt={`${spot.name} 공식 QR코드`}
                  className="w-32 h-32 rounded-lg border border-[#E5DDD0]"
                />
              )}
              <div>
                <p className="text-sm font-bold text-[#1C1917]">{spot.name}</p>
                <p className="text-xs font-mono-tabular text-[#57534E] break-all">{spot.qrCodeValue}</p>
              </div>
              {qrImages[spot.id] && (
                <a
                  href={qrImages[spot.id]}
                  download={`QR_${spot.name}.png`}
                  className="min-h-[36px] px-3 py-1 rounded-lg border border-[#D6CEBE] bg-white text-xs font-medium text-[#1C1917] hover:bg-[#F2ECE1] inline-flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>저장</span>
                </a>
              )}
            </div>
          ))}
        </div>
      </section>

      {showCouponRedeem && (
        <section className="rounded-2xl border-2 bg-white p-5 space-y-4" style={{ borderColor: 'var(--coupon-primary)' }}>
          <div className="flex items-center gap-2 border-b border-[#F0EAE0] pb-3">
            <Ticket className="w-4 h-4 text-[#A35139]" aria-hidden="true" />
            <h2 className="section-heading text-lg font-bold text-[#1C1917]">
              제휴 매장 · 운영자 쿠폰 바코드 검증 및 사용 확정
            </h2>
          </div>
          <p className="text-xs text-[#44403C]">
            발급된 쿠폰 바코드(JSYJ-LV-...)를 검증하여 중복 사용 없이 단 1회만 사용 확정 처리합니다. 시연용(DEMO) 바코드는 실제 매장 사용이 차단됩니다.
          </p>
          <form onSubmit={handleRedeemCouponCode} className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value)}
              placeholder="예: JSYJ-LV-GJ-XXXXXXXX-XXXX"
              aria-label="쿠폰 바코드 번호 입력"
              className="flex-1 min-h-[48px] px-4 py-2 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-sm font-mono-tabular uppercase text-[#1C1917]"
            />
            <button
              type="submit"
              disabled={couponRedeeming}
              className="min-h-[48px] px-5 py-2 rounded-xl text-white text-sm font-bold whitespace-nowrap disabled:opacity-60"
              style={{ backgroundColor: 'var(--coupon-primary)' }}
            >
              {couponRedeeming ? '검증 중...' : '바코드 검증 · 사용 확정'}
            </button>
          </form>
          {couponRedeemResult && (
            <div
              role="status"
              className={`rounded-xl border px-4 py-3 flex items-center gap-2 text-xs font-semibold ${
                couponRedeemResult.ok
                  ? 'border-[#16A34A] bg-[#F0FDF4] text-[#14532D]'
                  : 'border-[#B91C1C] bg-[#FEF2F2] text-[#B91C1C]'
              }`}
            >
              {couponRedeemResult.ok ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              )}
              <span>{couponRedeemResult.message}</span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
