import { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';
import { ArrowLeft, CheckCircle2, CreditCard, Minus, Plus, X } from 'lucide-react';
import { formatWon, type GoodsItem } from '../data/goods';

type Delivery = 'pickup' | 'parcel';
type PayMethod = 'kakaopay' | 'naverpay' | 'tosspay' | 'card';
type Stage = 'form' | 'processing' | 'done';

interface GoodsCheckoutPageProps {
  item: GoodsItem;
  /** `← 굿즈 목록으로` */
  onBackToList: () => void;
  /** 우측 상단 X: 결과 화면으로 돌아간다 */
  onClose: () => void;
  /** 주문 완료 화면의 `결과 화면으로 돌아가기` */
  onFinish: () => void;
  /** 하단 내비게이션 위에 표시되는 경우: 결제 바를 내비게이션 위로 올리고 여백을 둔다 */
  withBottomNav?: boolean;
}

const MAX_QTY = 10;
const PROCESSING_MS = 1600;

const DELIVERY_OPTIONS: { id: Delivery; label: string }[] = [
  { id: 'pickup', label: '현장 수령 (국립전주박물관 굿즈샵)' },
  { id: 'parcel', label: '택배 배송' },
];

const PAY_OPTIONS: { id: PayMethod; label: string }[] = [
  { id: 'kakaopay', label: '카카오페이' },
  { id: 'naverpay', label: '네이버페이' },
  { id: 'tosspay', label: '토스페이' },
  { id: 'card', label: '신용·체크카드' },
];

function createOrderNumber(): string {
  const d = new Date();
  const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `JSYJ-GD-${ymd}-${rand}`;
}

export function GoodsCheckoutPage({
  item,
  onBackToList,
  onClose,
  onFinish,
  withBottomNav = false,
}: GoodsCheckoutPageProps) {
  const [qty, setQty] = useState(1);
  const [delivery, setDelivery] = useState<Delivery>('pickup');
  const [payMethod, setPayMethod] = useState<PayMethod>('kakaopay');
  const [stage, setStage] = useState<Stage>('form');
  const [orderNumber, setOrderNumber] = useState('');
  const svgRef = useRef<SVGSVGElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const total = item.price * qty;
  const payLabel = PAY_OPTIONS.find((p) => p.id === payMethod)?.label ?? '';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [stage]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    []
  );

  useEffect(() => {
    if (stage !== 'done' || !svgRef.current || !orderNumber) return;
    try {
      JsBarcode(svgRef.current, orderNumber, {
        format: 'CODE128',
        width: 1.6,
        height: 56,
        displayValue: false,
        margin: 0,
      });
    } catch {
      svgRef.current.innerHTML = '';
    }
  }, [stage, orderNumber]);

  const handlePay = () => {
    if (stage !== 'form') return;
    setStage('processing');
    timerRef.current = window.setTimeout(() => {
      setOrderNumber(createOrderNumber());
      setStage('done');
    }, PROCESSING_MS);
  };

  if (stage === 'done') {
    return (
      <div className="min-h-app hanji-texture">
        <div className={`w-full max-w-5xl mx-auto min-h-app flex flex-col px-4 sm:px-6 py-6 safe-pb ${withBottomNav ? 'pb-[calc(7rem+env(safe-area-inset-bottom))]' : 'pb-10'}`}>
          <div className="text-center space-y-2 pt-2">
            <CheckCircle2 className="w-12 h-12 mx-auto text-[#14532D]" aria-hidden="true" />
            <h1 className="font-serif-kr text-xl font-bold text-[#14532D]">
              결제 완료 및 굿즈 교환권
            </h1>
            <p className="text-xs text-[#5C5349]">시연용 결제입니다. 실제 결제·청구는 이루어지지 않았습니다.</p>
          </div>

          <section
            aria-label="굿즈 교환권"
            className="mt-5 rounded-2xl border-2 border-dashed border-[#C7B596] bg-white p-4 space-y-4"
          >
            <div className="flex gap-3">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-24 aspect-video rounded-lg object-cover border border-[#D8CEBE] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#26201B] leading-snug">{item.name}</p>
                <p className="mt-0.5 text-xs text-[#5C5349]">
                  수량 {qty}개 · {formatWon(total)}
                </p>
                <p className="text-xs text-[#5C5349]">결제수단 {payLabel}</p>
              </div>
            </div>

            <div className="rounded-xl bg-[#FBF8F1] border border-[#D8CEBE] p-3 text-center">
              <p className="text-[11px] text-[#5C5349]">주문번호</p>
              <p
                className="mt-0.5 font-mono-tabular text-sm font-bold text-[#26201B] break-all"
                data-testid="order-number"
              >
                {orderNumber}
              </p>
              <div className="mt-3 flex justify-center bg-white rounded-lg p-2">
                <svg ref={svgRef} role="img" aria-label="굿즈 교환권 시연 바코드" className="max-w-full" />
              </div>
              <p className="mt-2 text-[11px] text-[#8E3524] font-medium">시연용 바코드 (DEMO)</p>
            </div>

            <div className="text-xs text-[#44403C] leading-relaxed space-y-1">
              {delivery === 'pickup' ? (
                <>
                  <p className="font-semibold text-[#26201B]">현장 수령 안내</p>
                  <p>국립전주박물관 굿즈샵에서 이 화면의 주문번호 또는 바코드를 보여 주세요.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-[#26201B]">택배 배송 안내</p>
                  <p>배송 접수 후 안내가 발송되는 흐름을 시연한 화면입니다. 실제 배송은 진행되지 않습니다.</p>
                </>
              )}
              <p className="text-[#5C5349]">본 굿즈 스토어는 시연용이며, 실제 상품 판매·배송은 이루어지지 않습니다.</p>
            </div>
          </section>

          <button
            type="button"
            onClick={onFinish}
            className="mt-6 w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C]"
          >
            결과 화면으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const busy = stage === 'processing';

  return (
    <div className="min-h-app hanji-texture">
      <div className="w-full min-h-app flex flex-col">
        <main className={`flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 grid grid-cols-1 lg:grid-cols-2 gap-5 content-start ${withBottomNav ? 'pb-[calc(10.5rem+env(safe-area-inset-bottom))]' : 'pb-32'}`}>
          {/* 서브 헤더: 공통 상단 배너 바로 아래 */}
          <div className="lg:col-span-2 flex items-center justify-between gap-3 rounded-2xl border border-[#D8CEBE] bg-[#FBF8F1]/95 px-4 py-1.5">
            <button
              type="button"
              onClick={onBackToList}
              disabled={busy}
              className="inline-flex items-center gap-1 text-sm font-medium text-[#5C5349] hover:text-[#26201B] min-h-[44px] disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>굿즈 목록으로</span>
            </button>
            <h1 className="font-serif-kr text-[clamp(1rem,2.4vw,1.25rem)] font-bold text-[#26201B]">주문 · 결제</h1>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label="결제창 닫기"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#5C5349] hover:bg-[#F3ECE0] disabled:opacity-50"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>

          <section aria-label="주문 상품" className="rounded-2xl border border-[#D6CBB9] bg-[#FBF8F1] p-3.5 space-y-3">
            <div className="flex gap-3">
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-28 aspect-video rounded-lg object-cover border border-[#D8CEBE] shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold text-[#26201B] leading-snug">{item.name}</p>
                <p className="mt-1 text-xs text-[#5C5349]">
                  단가 <span className="font-mono-tabular">{formatWon(item.price)}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#D8CEBE] pt-3">
              <span className="text-sm font-medium text-[#26201B]">수량</span>
              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  aria-label="수량 줄이기"
                  disabled={busy || qty <= 1}
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-11 h-11 rounded-lg border border-[#D6CBB9] bg-white flex items-center justify-center disabled:opacity-40"
                >
                  <Minus className="w-4 h-4" aria-hidden="true" />
                </button>
                <span
                  className="w-10 text-center font-mono-tabular text-base font-bold"
                  aria-live="polite"
                  data-testid="qty"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="수량 늘리기"
                  disabled={busy || qty >= MAX_QTY}
                  onClick={() => setQty((q) => Math.min(MAX_QTY, q + 1))}
                  className="w-11 h-11 rounded-lg border border-[#D6CBB9] bg-white flex items-center justify-center disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-[#D8CEBE] pt-3">
              <span className="text-sm font-medium text-[#26201B]">총 결제 금액</span>
              <span className="text-lg font-bold text-[#8E3524] font-mono-tabular" data-testid="total">
                {formatWon(total)}
              </span>
            </div>
          </section>

          <section aria-label="수령 방식" className="space-y-2">
            <h2 className="text-sm font-bold text-[#26201B]">수령 방식</h2>
            <div role="radiogroup" aria-label="수령 방식 선택" className="grid gap-2">
              {DELIVERY_OPTIONS.map((opt) => {
                const active = delivery === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={busy}
                    onClick={() => setDelivery(opt.id)}
                    className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                      active
                        ? 'border-[#8E3524] bg-[#FFF7ED] text-[#8E3524] font-bold'
                        : 'border-[#D6CBB9] bg-white text-[#26201B]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {delivery === 'parcel' && (
              <p className="text-[11px] text-[#5C5349]">
                시연에서는 배송지 입력 없이 진행됩니다. 실제 배송은 이루어지지 않습니다.
              </p>
            )}
          </section>

          <section aria-label="결제 수단" className="space-y-2">
            <h2 className="text-sm font-bold text-[#26201B]">결제 수단</h2>
            <div role="radiogroup" aria-label="결제 수단 선택" className="grid grid-cols-2 gap-2">
              {PAY_OPTIONS.map((opt) => {
                const active = payMethod === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={busy}
                    onClick={() => setPayMethod(opt.id)}
                    className={`min-h-[48px] px-3 py-2 rounded-xl border text-sm font-medium inline-flex items-center justify-center gap-1.5 transition-colors ${
                      active
                        ? 'border-[#8E3524] bg-[#FFF7ED] text-[#8E3524] font-bold'
                        : 'border-[#D6CBB9] bg-white text-[#26201B]'
                    }`}
                  >
                    {opt.id === 'card' && <CreditCard className="w-4 h-4" aria-hidden="true" />}
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-[#5C5349]">
              시연용 결제입니다. 외부 결제 서버와 연결되지 않으며 실제 청구는 이루어지지 않습니다.
            </p>
          </section>
        </main>

        <div
          className={`fixed left-0 right-0 z-40 border-t border-[#D8CEBE] bg-[#FBF8F1]/95 backdrop-blur-md py-3 safe-pb ${
            withBottomNav ? 'bottom-[58px]' : 'bottom-0'
          }`}
        >
          <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <button
            type="button"
            onClick={handlePay}
            disabled={busy}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] disabled:opacity-70"
          >
            {busy ? '결제 진행 중...' : `${formatWon(total)} 바로 결제하기`}
          </button>
          </div>
        </div>

        {busy && (
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-50 bg-[#26201B]/55 backdrop-blur-xs flex items-center justify-center"
          >
            <div className="rounded-2xl bg-[#FBF8F1] px-8 py-6 text-center shadow-2xl space-y-3">
              <div
                className="w-9 h-9 mx-auto rounded-full border-4 border-[#D8CEBE] border-t-[#8E3524] animate-spin"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold text-[#26201B]">{payLabel}로 결제 진행 중...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
