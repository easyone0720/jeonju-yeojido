import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { AlertCircle, CheckCircle2, Info, Ticket, X } from 'lucide-react';
import type { CouponRecord } from '../types/jeonju';
import { CouponCategoryBadge } from './CouponCategoryBadge';
import {
  formatCouponExpiryDate,
  getCouponStatusLabel,
  isDemoBarcodeNumber,
  resolveCouponBaseStatus,
  type CouponDisplayStatus,
} from '../utils/couponBarcode';

interface CouponBarcodeModalProps {
  coupon: CouponRecord | null;
  spotName: string;
  redeeming?: boolean;
  redeemError?: string | null;
  onConfirmDemoUse?: (couponId: string) => Promise<void>;
  onClose: () => void;
}

export function CouponBarcodeModal({
  coupon,
  spotName,
  redeeming = false,
  redeemError = null,
  onConfirmDemoUse,
  onClose,
}: CouponBarcodeModalProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastRenderedCodeRef = useRef<string | null>(null);
  const [barcodeRenderError, setBarcodeRenderError] = useState<string | null>(null);

  const open = Boolean(coupon);
  const barcodeValue = coupon?.barcodeNumber ?? '';
  const isDemo = Boolean(
    coupon && (coupon.isDemoCoupon || isDemoBarcodeNumber(barcodeValue))
  );
  const baseStatus = coupon ? resolveCouponBaseStatus(coupon) : 'locked';

  let displayStatus: CouponDisplayStatus = baseStatus;
  if (redeemError || barcodeRenderError) {
    displayStatus = 'verification_failed';
  } else if (baseStatus === 'available' && barcodeValue) {
    displayStatus = 'barcode_visible';
  }

  useEffect(() => {
    if (!open) {
      lastRenderedCodeRef.current = null;
      setBarcodeRenderError(null);
      return;
    }

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => closeButtonRef.current?.focus());

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

  useEffect(() => {
    if (!open || !svgRef.current) return;

    if (!barcodeValue) {
      svgRef.current.innerHTML = '';
      lastRenderedCodeRef.current = null;
      setBarcodeRenderError('발급된 바코드 번호가 없습니다. 새로고침 후 다시 확인해 주세요.');
      return;
    }

    if (lastRenderedCodeRef.current === barcodeValue && svgRef.current.childNodes.length > 0) {
      return;
    }

    try {
      svgRef.current.innerHTML = '';
      JsBarcode(svgRef.current, barcodeValue, {
        format: 'CODE128',
        displayValue: false,
        lineColor: '#1C1917',
        background: '#FFFFFF',
        width: 2,
        height: 76,
        margin: 8,
      });
      lastRenderedCodeRef.current = barcodeValue;
      setBarcodeRenderError(null);
    } catch {
      lastRenderedCodeRef.current = null;
      setBarcodeRenderError('바코드 이미지 생성 중 오류가 발생했습니다.');
    }
  }, [barcodeValue, open]);

  if (!open || !coupon) return null;

  const statusLabel = getCouponStatusLabel(displayStatus);
  const expiryText = formatCouponExpiryDate(coupon.expiresAt, coupon.expiresLabel);

  return (
    <div
      className="fixed inset-0 z-50 bg-[#26201B]/45 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !redeeming) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coupon-barcode-modal-title"
        className="w-[calc(100vw-2rem)] max-w-[430px] rounded-2xl border-2 border-[#A35139] bg-[#FBF8F1] ring-1 ring-inset ring-[#E6DEC8] shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col"
      >
        {/* Pure #A35139 Key Color Modal Header */}
        <div
          className="px-5 py-4 text-white flex items-center justify-between gap-3 shrink-0"
          style={{ backgroundColor: 'var(--coupon-primary)' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Ticket className="w-5 h-5 shrink-0 text-white" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white/95 truncate">
                <CouponCategoryBadge category={coupon.category} className="mr-1.5 align-middle" />
                {spotName}
              </p>
              <h2
                id="coupon-barcode-modal-title"
                className="text-base font-bold text-white truncate"
              >
                쿠폰 바코드 제시
              </h2>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            disabled={redeeming}
            onClick={onClose}
            aria-label="바코드 창 닫기"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-black/15 shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="space-y-1.5 text-center">
            <span
              className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-bold text-white"
              style={{
                backgroundColor:
                  displayStatus === 'used'
                    ? '#44403C'
                    : displayStatus === 'expired' || displayStatus === 'verification_failed'
                      ? '#B91C1C'
                      : 'var(--coupon-primary)',
              }}
            >
              상태: {statusLabel}
            </span>
            <h3 className="section-heading text-lg font-bold text-[#1C1917] pt-1">
              {coupon.title}
            </h3>
            <p className="text-sm font-semibold" style={{ color: 'var(--coupon-primary)' }}>
              {coupon.benefit}
            </p>
            <p className="text-xs text-[#44403C]">
              {coupon.partnerArea} · 유효기간: {expiryText}
            </p>
          </div>

          {/* CODE128 Barcode Card */}
          <div className="rounded-2xl border-2 border-[#A35139] bg-white p-4 text-center space-y-2.5 shadow-xs">
            {barcodeRenderError ? (
              <div
                role="alert"
                className="py-6 px-3 flex flex-col items-center gap-2 text-xs font-medium text-[#B91C1C]"
              >
                <AlertCircle className="w-6 h-6" aria-hidden="true" />
                <span>{barcodeRenderError}</span>
              </div>
            ) : (
              <>
                <div className="w-full overflow-hidden flex items-center justify-center">
                  <svg
                    ref={svgRef}
                    role="img"
                    aria-label={`쿠폰 바코드 ${barcodeValue}`}
                    className="w-full max-w-[300px] h-auto block mx-auto"
                  />
                </div>
                <p className="font-mono-tabular text-sm font-bold tracking-wider text-[#1C1917] select-all break-all">
                  {barcodeValue}
                </p>
              </>
            )}
          </div>

          {/* Demo vs Production Honest Usage Notice */}
          {isDemo ? (
            <div className="rounded-xl border border-[#D6CBB9] bg-[#FBF8F1] p-3.5 flex items-start gap-2.5 text-xs text-[#44403C] leading-relaxed">
              <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#A35139]" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-[#A35139]">
                  시연용 가상 바코드 (DEMO — 실제 매장 사용 불가)
                </p>
                <p>
                  이 바코드는 서비스 시연 확인을 위한 가상 바코드이며, 실제 전주 제휴 매장에서는 사용할 수 없습니다.
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-[#D6CBB9] bg-[#FBF8F1] p-3.5 flex items-start gap-2.5 text-xs text-[#44403C] leading-relaxed">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#A35139]" aria-hidden="true" />
              <div className="space-y-1">
                <p className="font-bold text-[#1C1917]">제휴 매장 확인 안내</p>
                <p>
                  계산 시 매장 직원에게 위 바코드를 제시해 주세요. 매장·운영자 바코드 검증 완료 시 즉시 사용 확정 처리되며 중복 사용이 차단됩니다.
                </p>
              </div>
            </div>
          )}

          {redeemError && (
            <div
              role="alert"
              className="rounded-xl border border-[#B91C1C] bg-[#FEF2F2] px-3.5 py-2.5 text-xs font-semibold text-[#B91C1C]"
            >
              {redeemError}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-[#E5DDD0] bg-[#F7F1E4] flex flex-col gap-2 shrink-0">
          {isDemo && baseStatus === 'available' && onConfirmDemoUse && (
            <button
              type="button"
              disabled={redeeming || Boolean(barcodeRenderError)}
              onClick={() => void onConfirmDemoUse(coupon.id)}
              className="w-full min-h-[48px] px-5 py-2.5 rounded-xl text-white font-semibold text-sm transition-opacity hover:opacity-95 disabled:opacity-60"
              style={{ backgroundColor: 'var(--coupon-primary)' }}
            >
              {redeeming ? '시연 사용 처리 중...' : '시연 사용 완료 처리하기'}
            </button>
          )}
          <button
            type="button"
            disabled={redeeming}
            onClick={onClose}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl border border-[#C4B8A3] bg-[#FBF8F1] text-sm font-semibold text-[#26201B] hover:bg-[#F3ECE0]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
