import { useState } from 'react';
import {
  Map as MapIcon,
  ScrollText,
  Ticket,
  QrCode,
  ExternalLink,
  Lock,
  CheckCircle2,
  Navigation,
  Sparkles,
  RotateCcw,
  UserCircle2,
  Tv,
  X,
} from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { SPOT_IMAGES, TRADITIONAL_MAP_IMAGE } from '../data/spotImages';
import {
  ClueCategory,
  ClueSpotId,
  HomeTab,
  SpotDefinition,
  SpotId,
  UserSessionState,
} from '../types/jeonju';
import {
  formatCouponExpiryDate,
  getCouponStatusLabel,
  resolveCouponBaseStatus,
} from '../utils/couponBarcode';
import {
  getCollectedClueCount,
  isMuseumUnlocked,
  isSpotClueOrPastLifeCompleted,
  isSpotVisitVerified,
} from '../utils/pastLifeEngine';
import { BottomNav, type NavTab } from './BottomNav';
import { CouponCategoryBadge } from './CouponCategoryBadge';
import { ENABLE_QUICK_COMPLETE_BUTTON } from '../config/features';
import { CompleteSealStamp } from './CompleteSealStamp';
import { CouponBarcodeModal } from './CouponBarcodeModal';
import { TangramClueBoard, type ClueGridMeta } from './TangramClueBoard';

export interface QrCompletionBanner {
  spotId: SpotId;
  spotName: string;
  message: string;
  isMuseum: boolean;
  clueCategory?: ClueCategory;
}

interface HomeWorkspaceProps {
  session: UserSessionState;
  activeTab: HomeTab;
  selectedSpotId: SpotId;
  justStampedSpotId?: SpotId | null;
  qrBanner?: QrCompletionBanner | null;
  onDismissQrBanner?: () => void;
  onOpenClueScroll?: (spotId: ClueSpotId) => void;
  onChangeTab: (tab: NavTab) => void;
  /** 도장 4개 미만이면 하단 바 '기념품' 탭에 자물쇠 배지 표시 */
  goodsLocked?: boolean;
  onSelectSpot: (spotId: SpotId) => void;
  onOpenQrScan: (spotId: SpotId) => void;
  onContinueSpotVerify: (spotId: SpotId) => void;
  onOpenMuseumFace: () => void;
  onViewPastLifeResult: () => void;
  onUseDemoCoupon: (couponId: string) => Promise<void>;
  onNavigateRoute: (path: '/wall' | '/admin') => void;
  /** 박물관 미디어월 영상 화면을 연다 (X 로 닫으면 지도 탭으로 이동) */
  onOpenMediaWall: () => void;
  onGoHome: () => void;
  /** [시연·검수용] 4개 거점 인증·조각·쿠폰을 한 번에 완료 처리 (ENABLE_QUICK_COMPLETE_BUTTON) */
  onCompleteAllStamps?: () => Promise<void>;
  saveError?: string | null;
  onRetrySync?: () => void;
}

/** 추천 관람 순서 (참고용 — 실제 인증 순서는 자유) */
const RECOMMENDED_ORDER: SpotId[] = [
  'wanpanbon',
  'gyeonggijeon',
  'nambu_market',
  'jeollagamyeong',
  'jeonju_museum',
];
const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤'];

const CLUE_GRID: ClueGridMeta[] = [
  { category: 'era', spotId: 'gyeonggijeon', question: '당신의 시대는', spotName: '경기전' },
  { category: 'status', spotId: 'jeollagamyeong', question: '당신의 신분은', spotName: '전라감영' },
  { category: 'story', spotId: 'wanpanbon', question: '당신의 이야기는', spotName: '완판본문화관' },
  { category: 'item', spotId: 'nambu_market', question: '당신의 소지품은', spotName: '남부시장' },
];

export function HomeWorkspace({
  session,
  activeTab,
  selectedSpotId,
  justStampedSpotId = null,
  qrBanner = null,
  onDismissQrBanner,
  onOpenClueScroll,
  onChangeTab,
  goodsLocked,
  onSelectSpot,
  onOpenQrScan,
  onContinueSpotVerify,
  onOpenMuseumFace,
  onViewPastLifeResult,
  onUseDemoCoupon,
  onNavigateRoute,
  onOpenMediaWall,
  onGoHome,
  onCompleteAllStamps,
  saveError,
  onRetrySync,
}: HomeWorkspaceProps) {
  const [spotImgErrors, setSpotImgErrors] = useState<Record<string, boolean>>({});
  const [inspectedClue, setInspectedClue] = useState<ClueCategory | null>(null);
  const [spotSheetOpen, setSpotSheetOpen] = useState<boolean>(false);

  // Barcode Modal State
  const [barcodeCouponId, setBarcodeCouponId] = useState<string | null>(null);
  const [redeemingCoupon, setRedeemingCoupon] = useState<boolean>(false);
  const [redeemCouponError, setRedeemCouponError] = useState<string | null>(null);
  const [quickCompleting, setQuickCompleting] = useState<boolean>(false);
  const [quickCompleteError, setQuickCompleteError] = useState<string | null>(null);

  const clueCount = getCollectedClueCount(session);
  const museumReady = isMuseumUnlocked(session);
  const museumVisitVerified = isSpotVisitVerified(session, 'jeonju_museum');
  const selectedSpot =
    JEONJU_SPOTS.find((s) => s.id === selectedSpotId) ?? JEONJU_SPOTS[0];
  const unlockedCouponsCount = session.coupons.filter((c) => c.unlocked).length;

  const isSpotVisited = (spot: SpotDefinition): boolean => {
    return isSpotVisitVerified(session, spot.id);
  };

  const isSpotStage2Complete = (spot: SpotDefinition): boolean => {
    return isSpotClueOrPastLifeCompleted(session, spot.id);
  };

  const buildExternalMapUrl = (spot: SpotDefinition, provider: 'naver' | 'kakao' | 'google') => {
    const encodedName = encodeURIComponent(`전주 ${spot.name}`);
    if (provider === 'naver') {
      return `https://map.naver.com/v5/search/${encodedName}`;
    }
    if (provider === 'kakao') {
      return `https://map.kakao.com/link/to/${encodedName},${spot.coordinates.lat},${spot.coordinates.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${spot.coordinates.lat},${spot.coordinates.lng}`;
  };

  const handlePinClick = (spotId: SpotId) => {
    onSelectSpot(spotId);
    setSpotSheetOpen(true);
  };

  const renderSpotDetailContent = (spot: SpotDefinition) => {
    const isMuseumLocked = spot.id === 'jeonju_museum' && !museumReady;
    const visitVerified = isSpotVisited(spot);
    const stage2Done = isSpotStage2Complete(spot);
    const shouldAnimateStamp = justStampedSpotId === spot.id;

    return (
      <div className="space-y-4">
        <div className="relative aspect-video w-full rounded-xl bg-[#EFE8DC] overflow-hidden border border-[#E5DDD0]">
          {isMuseumLocked ? (
            <div
              className="w-full h-full bg-gradient-to-br from-[#EAE1D0] via-[#DFD4BE] to-[#D2C4AA] flex flex-col items-center justify-center p-5 text-center gap-2.5"
              aria-label={`국립전주박물관 사진 잠김 (${clueCount} / 4 완료 시 해금)`}
            >
              <span className="w-12 h-12 rounded-full bg-[#FBF8F2]/90 border border-[#B8AD99] flex items-center justify-center text-[#57534E] shadow-xs">
                <Lock className="w-5 h-5" aria-hidden="true" />
              </span>
              <div className="space-y-1">
                <p className="font-serif-kr text-sm sm:text-base font-bold text-[#1C1917]">
                  박물관 전경 잠김
                </p>
                <p className="text-xs text-[#57534E]">
                  장소 1~4의 전생 조각을 모두 모으면 해금됩니다 ({clueCount} / 4)
                </p>
              </div>
            </div>
          ) : !spotImgErrors[spot.id] ? (
            <img
              src={SPOT_IMAGES[spot.id]}
              alt={`${spot.name} 전경`}
              className="w-full h-full object-cover object-top block"
              referrerPolicy="no-referrer"
              onError={() => setSpotImgErrors((prev) => ({ ...prev, [spot.id]: true }))}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[#57534E]">
              <MapIcon className="w-8 h-8" aria-hidden="true" />
            </div>
          )}
        </div>

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#57534E]">
            <span>
              {spot.id === 'jeonju_museum'
                ? '최종 전생 완성지'
                : `장소 ${spot.orderNumber} · ${spot.clueQuestion ?? ''}`}
            </span>
          </div>
          <h2 className="font-serif-kr text-xl font-bold text-[#1C1917]">
            {spot.name}{' '}
            <span className="text-sm font-normal text-[#78716C]">{spot.hanjaName}</span>
          </h2>
          <p className="text-xs text-[#78716C]">{spot.address}</p>
        </div>

        {visitVerified && (
          <CompleteSealStamp
            animate={shouldAnimateStamp}
            size="md"
            label={`${spot.name} 방문 인증 완료 도장 (完)`}
          />
        )}
      </div>

      {/* Explicit 2-stage progression indicator */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-[#E5DDD0] bg-[#FBF8F2] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-1">
          <span className="text-[#78716C] whitespace-nowrap">방문 인증</span>
          <span
            className={`font-bold whitespace-nowrap ${
              visitVerified ? 'text-[#9A3412]' : 'text-[#57534E]'
            }`}
          >
            {visitVerified ? '완료' : '미완료'}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-1 border-l border-[#E5DDD0] pl-2">
          <span className="text-[#78716C] whitespace-nowrap">
            {spot.id === 'jeonju_museum' ? '전생 완성' : '전생 조각'}
          </span>
          <span
            className={`font-bold ${
              stage2Done
                ? 'text-[#16A34A]'
                : visitVerified
                  ? 'text-[#9A3412]'
                  : 'text-[#57534E]'
            }`}
          >
            {spot.id === 'jeonju_museum'
              ? stage2Done
                ? '완료'
                : !museumReady
                  ? '잠금 (4/4 필요)'
                  : visitVerified
                    ? '결과 확인 가능'
                    : '결과 확인 대기'
              : stage2Done
                ? '획득 완료'
                : visitVerified
                  ? '획득 진행 중'
                  : '미획득'}
          </span>
        </div>
      </div>

      <p className="text-sm text-[#44403C] leading-relaxed">
        {spot.historicalSummary}. {spot.shortSubtitle}.
      </p>

      <div className="space-y-1.5 pt-1 border-t border-[#F0EAE0]">
        <span className="text-xs font-medium text-[#57534E] inline-flex items-center gap-1">
          <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
          <span>길찾기</span>
        </span>
        <div className="grid grid-cols-3 gap-2">
          <a
            href={buildExternalMapUrl(spot, 'naver')}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-2 py-1.5 rounded-lg border border-[#E5DDD0] bg-[#FBF8F2] text-xs font-medium text-[#1C1917] hover:bg-[#F2ECE1] flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <span>네이버</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href={buildExternalMapUrl(spot, 'kakao')}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-2 py-1.5 rounded-lg border border-[#E5DDD0] bg-[#FBF8F2] text-xs font-medium text-[#1C1917] hover:bg-[#F2ECE1] flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <span>카카오</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
          <a
            href={buildExternalMapUrl(spot, 'google')}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[40px] px-2 py-1.5 rounded-lg border border-[#E5DDD0] bg-[#FBF8F2] text-xs font-medium text-[#1C1917] hover:bg-[#F2ECE1] flex items-center justify-center gap-1 whitespace-nowrap"
          >
            <span>구글</span>
            <ExternalLink className="w-3 h-3" aria-hidden="true" />
          </a>
        </div>
      </div>

      {spot.id === 'jeonju_museum' && (
        <button
          type="button"
          onClick={() => {
            setSpotSheetOpen(false);
            onOpenMediaWall();
          }}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-[#1C1917] font-semibold text-sm hover:bg-[#F2ECE1] flex items-center justify-center gap-2"
        >
          <Tv className="w-4 h-4" aria-hidden="true" />
          <span>박물관 미디어월 보기</span>
        </button>
      )}

      {spot.id === 'jeonju_museum' ? (
        session.pastLifeResult ? (
          <button
            type="button"
            onClick={onViewPastLifeResult}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#1C1917] text-white font-semibold text-sm hover:bg-[#292524]"
          >
            완성된 내 전생 결과 보기
          </button>
        ) : !museumReady ? (
          <div className="rounded-xl border border-[#E5DDD0] bg-[#FBF8F2] p-3 text-xs text-[#57534E]">
            조각 4개를 모두 모아야 박물관 체험이 열립니다. (현재 {clueCount} / 4)
          </div>
        ) : visitVerified ? (
          <button
            type="button"
            onClick={() => {
              setSpotSheetOpen(false);
              onOpenMuseumFace();
            }}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#9A3412] text-white font-semibold text-sm hover:bg-[#7C2D12] flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" aria-hidden="true" />
            <span>내 전생 결과 확인하기</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setSpotSheetOpen(false);
              onOpenQrScan('jeonju_museum');
            }}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#9A3412] text-white font-semibold text-sm hover:bg-[#7C2D12] flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" aria-hidden="true" />
            <span>박물관 현장 QR 스캔하기</span>
          </button>
        )
      ) : stage2Done ? (
        <button
          type="button"
          onClick={() => {
            setSpotSheetOpen(false);
            onChangeTab('clues');
            if (spot.clueCategory) setInspectedClue(spot.clueCategory);
          }}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl border border-[#16A34A]/50 bg-[#F0FDF4] text-[#14532D] font-semibold text-sm hover:bg-[#DCFCE7] flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          <span>획득한 조각 확인하기</span>
        </button>
      ) : visitVerified ? (
        <button
          type="button"
          onClick={() => {
            setSpotSheetOpen(false);
            onContinueSpotVerify(spot.id);
          }}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#9A3412] text-white font-semibold text-sm hover:bg-[#7C2D12] flex items-center justify-center gap-2"
        >
          <ScrollText className="w-4 h-4" aria-hidden="true" />
          <span>전생 조각 이어받기</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            setSpotSheetOpen(false);
            onOpenQrScan(spot.id);
          }}
          className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-[#9A3412] text-white font-semibold text-sm hover:bg-[#7C2D12] flex items-center justify-center gap-2"
        >
          <QrCode className="w-4 h-4" aria-hidden="true" />
          <span>현장 QR 스캔하기</span>
        </button>
      )}
      </div>
    );
  };

  const inspectedClueData = inspectedClue ? session.clues[inspectedClue] : null;
  const inspectedClueMeta = inspectedClue
    ? CLUE_GRID.find((c) => c.category === inspectedClue)
    : null;

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-24">
      {/* Wireframe Top Profile + Progress Header: [Profile Icon] 0 / 4 */}
      <header className="sticky top-0 z-30 border-b border-[#E5DDD0] bg-[#FBF8F2]/95 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-3 sm:px-6 min-h-14 py-1.5 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-[#1C1917] shrink-0">
              <UserCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-[#57534E]" aria-hidden="true" />
              <span
                className="font-mono-tabular text-lg font-bold tracking-tight whitespace-nowrap"
                aria-label={`전생 조각 진행도 ${clueCount} / 4`}
              >
                {clueCount} / 4
              </span>
            </div>
            {session.visitorName && (
              <span className="text-xs text-[#57534E] hidden sm:inline truncate max-w-[140px]">
                · {session.visitorName}
              </span>
            )}
            <span className="text-xs text-[#9A3412] font-medium whitespace-nowrap">
              · 현장 체험
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onOpenMediaWall}
              className="section-heading text-xs font-bold text-[#1C1917] hover:text-[#9A3412] min-h-[44px] px-2 whitespace-nowrap"
            >
              미디어월
            </button>
            {/* [QUICK-COMPLETE] 시연자용 초소형 skip — 4개 거점 인증·쿠폰 발급·박물관 단계로 한 번에 이동.
                ENABLE_QUICK_COMPLETE_BUTTON 을 false 로 바꾸면 사라진다. */}
            {ENABLE_QUICK_COMPLETE_BUTTON && onCompleteAllStamps && clueCount < 4 && (
              <button
                type="button"
                disabled={quickCompleting}
                onClick={async () => {
                  setQuickCompleting(true);
                  setQuickCompleteError(null);
                  try {
                    await onCompleteAllStamps();
                  } catch (err) {
                    setQuickCompleteError(
                      err instanceof Error ? err.message : '스탬프 일괄 완료에 실패했습니다.'
                    );
                  } finally {
                    setQuickCompleting(false);
                  }
                }}
                aria-label="스탬프 4개 완료로 이동"
                className="px-1.5 min-h-[32px] bg-transparent text-[11px] text-[#2C3B4D]/45 hover:text-[#1B2632] disabled:opacity-50 transition-colors"
              >
                {quickCompleting ? '…' : 'skip'}
              </button>
            )}
            <button
              type="button"
              onClick={onGoHome}
              title="처음 화면으로 (기록은 안전하게 보관됩니다)"
              aria-label="처음으로 돌아가기"
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#57534E] hover:bg-[#EFE8DC] hover:text-[#1C1917]"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-4 sm:py-6 flex flex-col gap-4">
        {quickCompleteError && (
          <p role="alert" className="text-[11px] text-[#7C2D12] text-right">
            {quickCompleteError}
          </p>
        )}

        {saveError && (
          <div
            role="alert"
            className="rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 px-4 py-2.5 flex items-center justify-between gap-3 text-xs text-[#7C2D12]"
          >
            <span>{saveError}</span>
            {onRetrySync && (
              <button
                type="button"
                onClick={onRetrySync}
                className="min-h-[34px] px-3 rounded-lg bg-[#9A3412] text-white font-semibold whitespace-nowrap shrink-0"
              >
                다시 저장 시도
              </button>
            )}
          </div>
        )}

        {qrBanner && activeTab === 'map' && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-xl border border-[#16A34A]/40 bg-[#F0FDF4] px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <CheckCircle2
                className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-xs sm:text-sm font-semibold text-[#14532D] leading-relaxed">
                {qrBanner.message}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {qrBanner.isMuseum ? (
                <button
                  type="button"
                  onClick={() => {
                    onDismissQrBanner?.();
                    onOpenMuseumFace();
                  }}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#9A3412] text-white text-xs font-semibold hover:bg-[#7C2D12] whitespace-nowrap"
                >
                  내 전생 결과 확인
                </button>
              ) : (
                onOpenClueScroll && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetId = qrBanner.spotId as ClueSpotId;
                      onDismissQrBanner?.();
                      onOpenClueScroll(targetId);
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#9A3412] text-white text-xs font-semibold hover:bg-[#7C2D12] whitespace-nowrap"
                  >
                    획득 조각 · 쿠폰 보기
                  </button>
                )
              )}
              {onDismissQrBanner && (
                <button
                  type="button"
                  onClick={onDismissQrBanner}
                  aria-label="안내 닫기"
                  className="min-w-[34px] min-h-[34px] flex items-center justify-center rounded-lg text-[#14532D]/70 hover:bg-[#DCFCE7]"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        )}
        {/* Completion Ready Banner */}
        {museumReady && (
          <div className="rounded-xl border border-[#9A3412]/30 bg-white px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <p className="text-sm font-semibold text-[#1C1917]">
              {session.pastLifeResult
                ? `전생 완성: ${session.pastLifeResult.title}${session.pastLifeResult.hanjaTitle ? ` (${session.pastLifeResult.hanjaTitle})` : ''}`
                : museumVisitVerified
                  ? '박물관 방문 인증 완료! 결과 확인으로 전생을 완성하세요.'
                  : '네 조각을 모두 모았습니다! 국립전주박물관 현장 QR을 스캔해 주세요.'}
            </p>
            <button
              type="button"
              onClick={
                session.pastLifeResult
                  ? onViewPastLifeResult
                  : museumVisitVerified
                    ? onOpenMuseumFace
                    : () => onOpenQrScan('jeonju_museum')
              }
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#9A3412] text-white text-xs font-semibold hover:bg-[#7C2D12] whitespace-nowrap shrink-0"
            >
              {session.pastLifeResult
                ? '내 전생 결과 보기'
                : museumVisitVerified
                  ? '내 전생 결과 확인'
                  : '박물관 QR 스캔'}
            </button>
          </div>
        )}

        {/* SCENE 3: 홈① 지도 — 전통 여지도 */}
        {activeTab === 'map' && (
          <section aria-labelledby="map-section-title" className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            <div className="lg:col-span-7 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 id="map-section-title" className="section-heading text-lg font-bold text-[#1C1917]">
                  지도
                </h1>
              </div>

              {/* 추천 관람 순서 안내 (참고용) */}
              <div className="space-y-1">
                <ol
                  aria-label="추천 관람 순서"
                  className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-[#E5DDD0] bg-white/80 px-3 py-2 text-xs sm:text-sm font-medium text-[#1C1917]"
                >
                  {RECOMMENDED_ORDER.map((id, i) => (
                    <li key={id} className="inline-flex items-center gap-1.5">
                      <span className="whitespace-nowrap">
                        {CIRCLED_NUMBERS[i]} {JEONJU_SPOTS.find((s) => s.id === id)?.name}
                      </span>
                      {i < RECOMMENDED_ORDER.length - 1 && (
                        <span aria-hidden="true" className="text-[#78716C]">
                          →
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
                <p className="text-[11px] leading-snug text-[#78716C]">
                  ※ 위 동선은 추천 관람 순서이며, 참고사항입니다. 어느 장소부터 방문하셔도 자유롭게
                  스탬프를 모을 수 있습니다.
                </p>
              </div>

              {/* Large Traditional Joseon Map Container matching Scene 3 */}
              <div className="relative w-full aspect-[4/3] min-h-[340px] max-h-[580px] rounded-2xl border-2 border-[#A8967A] bg-[#EFE4CE] overflow-hidden shadow-md">
                <img
                  src={TRADITIONAL_MAP_IMAGE}
                  alt="전주 전통 여지도 고지도 배경"
                  className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
                />
                {/* Soft inner parchment frame & subtle contrast veil so pins stay crisp */}
                <div
                  className="absolute inset-0 bg-[#FBF6EB]/10 pointer-events-none ring-1 ring-inset ring-[#6B5439]/30 rounded-2xl"
                  aria-hidden="true"
                />
                {/* Percentage-aligned exploration path lines connecting 1->2->3->4->Museum (완판본→경기전→남부시장→전라감영→박물관) */}
                <svg
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                >
                  <path
                    d="M 80 68 L 56 54 L 40 74 L 46 33 L 24 18"
                    fill="none"
                    stroke="#FBF8F2"
                    strokeWidth="1.2"
                    strokeDasharray="1.8 1.5"
                    opacity="0.85"
                  />
                  <path
                    d="M 80 68 L 56 54 L 40 74 L 46 33 L 24 18"
                    fill="none"
                    stroke="#9A3412"
                    strokeWidth="0.65"
                    strokeDasharray="1.8 1.5"
                    opacity="0.75"
                  />
                </svg>

                {/* Museum Rectangular Node & Numbered Circular Spot Nodes with red '完' stamp overlay */}
                {JEONJU_SPOTS.map((spot) => {
                  const visited = isSpotVisited(spot);
                  const stage2Done = isSpotStage2Complete(spot);
                  const isMuseum = spot.id === 'jeonju_museum';
                  const locked = isMuseum && !museumReady;
                  const isSelected = spot.id === selectedSpot.id;
                  const shouldAnimatePinStamp = justStampedSpotId === spot.id;

                  if (isMuseum) {
                    return (
                      <div
                        key={spot.id}
                        style={{
                          left: `${spot.mapPositionPercent.x}%`,
                          top: `${spot.mapPositionPercent.y}%`,
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 hover:z-30 ${
                          isSelected ? 'z-20' : 'z-10'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handlePinClick(spot.id)}
                          aria-label={`국립전주박물관 ${
                            locked
                              ? '잠김'
                              : visited
                                ? '방문 인증 완료'
                                : '방문 가능'
                          }`}
                          aria-pressed={isSelected}
                          className={`relative hover-scale min-h-[44px] px-3.5 py-2 rounded-xl border-2 flex items-center gap-1.5 shadow-md ring-2 ring-[#FBF8F2]/90 ${
                            isSelected
                              ? 'bg-[#1C1917] text-white border-[#1C1917]'
                              : locked
                                ? 'bg-[#F5EFE6]/95 text-[#44403C] border-[#78716C]'
                                : 'bg-white text-[#9A3412] border-[#9A3412]'
                          }`}
                        >
                          {locked ? (
                            <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                          ) : (
                            <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
                          )}
                          <span className="text-xs font-bold whitespace-nowrap">
                            박물관
                          </span>
                          {visited && (
                            <CompleteSealStamp
                              animate={shouldAnimatePinStamp}
                              size="xs"
                              label="국립전주박물관 방문 인증 도장 (完)"
                              className="absolute -top-3.5 -right-3 z-20"
                            />
                          )}
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={spot.id}
                      style={{
                        left: `${spot.mapPositionPercent.x}%`,
                        top: `${spot.mapPositionPercent.y}%`,
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 hover:z-30 ${
                        isSelected ? 'z-20' : 'z-10'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handlePinClick(spot.id)}
                        aria-label={`${spot.name} ${
                          visited ? '방문 인증 완료' : '방문 가능'
                        }`}
                        aria-pressed={isSelected}
                        className="relative hover-scale flex flex-col items-center gap-1"
                      >
                        <span
                          className={`relative w-11 h-11 rounded-full border-2 flex items-center justify-center font-mono-tabular text-sm font-bold shadow-md ring-2 ring-[#FBF8F2]/95 ${
                            isSelected
                              ? 'bg-[#9A3412] text-white border-[#FBF8F2]'
                              : stage2Done
                                ? 'bg-[#F0FDF4] text-[#14532D] border-[#16A34A]'
                                : visited
                                  ? 'bg-[#FFF7ED] text-[#9A3412] border-[#9A3412]'
                                  : 'bg-white text-[#1C1917] border-[#1C1917]'
                          }`}
                        >
                          {stage2Done ? (
                            <CheckCircle2 className="w-5 h-5 text-[#16A34A]" aria-hidden="true" />
                          ) : (
                            spot.orderNumber
                          )}
                          {visited && (
                            <CompleteSealStamp
                              animate={shouldAnimatePinStamp}
                              size="xs"
                              label={`${spot.name} 방문 인증 도장 (完)`}
                              className="absolute -top-3 -right-3.5 z-20"
                            />
                          )}
                        </span>
                        <span className="px-2 py-0.5 leading-tight rounded-md bg-[#FBF8F2]/95 border border-[#8C7A62]/70 text-xs font-bold text-[#1C1917] whitespace-nowrap shadow-sm">
                          {spot.name}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Mobile Quick Access Strip for the selected spot */}
              <div className="lg:hidden rounded-xl border border-[#E5DDD0] bg-white p-3.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  {isSpotVisited(selectedSpot) && (
                    <CompleteSealStamp
                      animate={justStampedSpotId === selectedSpot.id}
                      size="sm"
                      label={`${selectedSpot.name} 방문 인증 완료 도장 (完)`}
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-[#9A3412] font-semibold">
                      {selectedSpot.id === 'jeonju_museum'
                        ? '최종 목적지'
                        : `장소 ${selectedSpot.orderNumber} 선택됨`}
                      {isSpotVisited(selectedSpot) ? ' · 방문 인증 완료' : ''}
                    </p>
                    <p className="font-serif-kr text-base font-bold text-[#1C1917] truncate">
                      {selectedSpot.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    type="button"
                    onClick={() => setSpotSheetOpen(true)}
                    className="min-h-[44px] px-3 py-2 rounded-lg border border-[#D6CEBE] bg-[#FBF8F2] text-xs font-semibold text-[#1C1917] whitespace-nowrap"
                  >
                    상세 보기
                  </button>
                  {selectedSpot.id === 'jeonju_museum' ? (
                    museumReady && !session.pastLifeResult && (
                      <button
                        type="button"
                        onClick={() =>
                          museumVisitVerified
                            ? onOpenMuseumFace()
                            : onOpenQrScan('jeonju_museum')
                        }
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#9A3412] text-white text-xs font-semibold"
                      >
                        {museumVisitVerified ? '결과 확인' : 'QR 스캔'}
                      </button>
                    )
                  ) : !isSpotVisited(selectedSpot) ? (
                    <button
                      type="button"
                      onClick={() => onOpenQrScan(selectedSpot.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#9A3412] text-white text-xs font-semibold"
                    >
                      QR 스캔
                    </button>
                  ) : (
                    !isSpotStage2Complete(selectedSpot) && (
                      <button
                        type="button"
                        onClick={() => onContinueSpotVerify(selectedSpot.id)}
                        className="min-h-[44px] px-3.5 py-2 rounded-lg bg-[#9A3412] text-white text-xs font-semibold"
                      >
                        조각 받기
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Side Detail Panel */}
            <aside className="hidden lg:block lg:col-span-5 bg-white border border-[#E5DDD0] rounded-2xl p-5 shadow-sm">
              {renderSpotDetailContent(selectedSpot)}
            </aside>
          </section>
        )}

        {/* Mobile Spot Detail Modal Sheet */}
        {activeTab === 'map' && spotSheetOpen && (
          <div
            className="lg:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedSpot.name} 상세 정보`}
          >
            <div className="w-full max-w-lg rounded-t-3xl bg-white p-5 pb-8 max-h-[85dvh] overflow-y-auto shadow-xl space-y-3">
              <div className="flex items-center justify-between pb-1">
                <span className="text-xs font-semibold text-[#78716C]">장소 상세</span>
                <button
                  type="button"
                  onClick={() => setSpotSheetOpen(false)}
                  aria-label="닫기"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-[#F5EFE6]"
                >
                  <X className="w-5 h-5" aria-hidden="true" />
                </button>
              </div>
              {renderSpotDetailContent(selectedSpot)}
            </div>
          </div>
        )}

        {/* SCENE 4: 홈② 내 조각 — Korean Tangram (칠교놀이) 2x2 board */}
        {activeTab === 'clues' && (
          <section aria-labelledby="clues-section-title" className="space-y-4">
            <h1 id="clues-section-title" className="sr-only">
              내 조각
            </h1>

            <TangramClueBoard
              clueGrid={CLUE_GRID}
              clues={session.clues}
              onInspectClue={(category) => setInspectedClue(category)}
              onGoToSpot={(spotId) => {
                onSelectSpot(spotId);
                onChangeTab('map');
              }}
            />

            {inspectedClueData && inspectedClueMeta && (
              <div
                role="dialog"
                aria-modal="true"
                aria-label={`${inspectedClueMeta.spotName} 조각 상세`}
                className="rounded-2xl border border-[#D6CEBE] bg-white p-5 space-y-2 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#9A3412]">
                    {inspectedClueMeta.spotName} · {inspectedClueData.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setInspectedClue(null)}
                    className="min-h-[36px] px-2 text-xs text-[#57534E] hover:text-[#1C1917]"
                  >
                    닫기
                  </button>
                </div>
                <p className="font-serif-kr text-base font-bold text-[#1C1917]">
                  {inspectedClueData.value}
                </p>
                <p className="text-sm text-[#44403C] leading-relaxed">
                  {inspectedClueData.detail}
                </p>
                <p className="text-xs text-[#78716C]">
                  역사 배경: {inspectedClueData.historicalNote}
                </p>
              </div>
            )}
          </section>
        )}

        {/* SCENE 5: 홈③ 쿠폰 — Pure #A35139 Key Color + CODE128 Barcode Issuance */}
        {activeTab === 'coupons' && (
          <section aria-labelledby="coupons-section-title" className="mx-auto w-full max-w-2xl space-y-4">
            {/* Top Coupon Issuance Banner Box using exact pure #A35139 (zero opacity/gradient) */}
            <div
              className="rounded-2xl border-2 bg-white overflow-hidden shadow-sm"
              style={{ borderColor: 'var(--coupon-primary)' }}
            >
              <div
                className="px-5 py-3.5 text-white flex flex-wrap items-center justify-between gap-2"
                style={{ backgroundColor: 'var(--coupon-primary)' }}
              >
                <div className="flex items-center gap-2">
                  <Ticket className="w-5 h-5 shrink-0 text-white" aria-hidden="true" />
                  <h1 id="coupons-section-title" className="section-heading text-lg font-bold text-white">
                    전주 제휴 쿠폰 발급함
                  </h1>
                </div>
                <span className="font-mono-tabular text-sm font-extrabold text-white whitespace-nowrap">
                  {unlockedCouponsCount} / 4 보유
                </span>
              </div>
              <div className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#44403C]">
                <span>장소 QR 인증 시 카페·식당·숙박권·전주 지역 상품권 중 1종이 무작위로 발급됩니다.</span>
                <span
                  className="font-bold whitespace-nowrap"
                  style={{ color: 'var(--coupon-primary)' }}
                >
                  현장 검증 쿠폰
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3.5">
              {session.coupons.map((coupon) => {
                const spotName =
                  JEONJU_SPOTS.find((s) => s.id === coupon.spotId)?.name ?? '';
                const baseStatus = resolveCouponBaseStatus(coupon);
                const statusLabel = getCouponStatusLabel(baseStatus);
                const expiryText = formatCouponExpiryDate(
                  coupon.expiresAt,
                  coupon.expiresLabel
                );

                return (
                  <article
                    key={coupon.id}
                    className={`w-full rounded-2xl border-2 px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      coupon.unlocked
                        ? 'bg-white shadow-sm'
                        : 'bg-[#F5EFE6] border-dashed border-[#C7BDA9]'
                    }`}
                    style={
                      coupon.unlocked
                        ? { borderColor: 'var(--coupon-primary)' }
                        : undefined
                    }
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {coupon.unlocked ? (
                          <CouponCategoryBadge category={coupon.category} />
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-[#C7BDA9] bg-white text-[11px] font-bold text-[#78716C]">
                            랜덤 쿠폰
                          </span>
                        )}
                        <span className="text-[#44403C] font-medium">· {spotName}</span>
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-md font-bold text-white"
                          style={{
                            backgroundColor:
                              baseStatus === 'used'
                                ? '#44403C'
                                : baseStatus === 'expired'
                                  ? '#B91C1C'
                                  : baseStatus === 'available'
                                    ? 'var(--coupon-primary)'
                                    : '#78716C',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>
                      <h2 className="section-heading text-base font-bold text-[#1C1917]">
                        {coupon.unlocked ? coupon.title : '방문하면 랜덤 제휴 쿠폰이 발급돼요'}
                      </h2>
                      <p
                        className="text-sm font-semibold"
                        style={{ color: 'var(--coupon-primary)' }}
                      >
                        {coupon.unlocked
                          ? coupon.benefit
                          : '카페 · 식당 · 숙박권 · 전주 지역 상품권 중 1종'}
                      </p>
                      <p className="text-xs text-[#44403C]">
                        {coupon.unlocked
                          ? `${coupon.locationHint ?? coupon.partnerArea} · ${expiryText}`
                          : '제휴 예정 모델 · 시연용 가상 쿠폰'}
                      </p>
                    </div>

                    <div className="shrink-0 flex flex-col sm:items-end gap-1.5">
                      {!coupon.unlocked ? (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectSpot(coupon.spotId);
                            onChangeTab('map');
                          }}
                          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border-2 bg-white text-xs font-bold hover:bg-[#F5EFE6] whitespace-nowrap"
                          style={{
                            borderColor: 'var(--coupon-primary)',
                            color: 'var(--coupon-primary)',
                          }}
                        >
                          {spotName} 방문하기
                        </button>
                      ) : baseStatus === 'available' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setRedeemCouponError(null);
                            setBarcodeCouponId(coupon.id);
                          }}
                          className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl text-white text-xs font-bold hover:opacity-95 whitespace-nowrap"
                          style={{ backgroundColor: 'var(--coupon-primary)' }}
                        >
                          사용하기
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRedeemCouponError(null);
                            setBarcodeCouponId(coupon.id);
                          }}
                          className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-[#C7BDA9] bg-[#FBF8F2] text-xs font-semibold text-[#44403C] hover:bg-[#EFE8DC] whitespace-nowrap"
                        >
                          {baseStatus === 'used' ? '사용 내역 · 바코드 보기' : '만료 내역 보기'}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <BottomNav activeTab={activeTab} onChangeTab={onChangeTab} goodsLocked={goodsLocked} />

      {/* Coupon CODE128 Barcode Modal */}
      {(() => {
        const activeCoupon =
          session.coupons.find((c) => c.id === barcodeCouponId) ?? null;
        const activeSpotName = activeCoupon
          ? JEONJU_SPOTS.find((s) => s.id === activeCoupon.spotId)?.name ?? ''
          : '';
        return (
          <CouponBarcodeModal
            coupon={activeCoupon}
            spotName={activeSpotName}
            redeeming={redeemingCoupon}
            redeemError={redeemCouponError}
            onConfirmDemoUse={async (couponId) => {
              setRedeemingCoupon(true);
              setRedeemCouponError(null);
              try {
                await onUseDemoCoupon(couponId);
              } catch (err) {
                setRedeemCouponError(
                  err instanceof Error
                    ? err.message
                    : '쿠폰 사용 처리 중 오류가 발생했습니다.'
                );
              } finally {
                setRedeemingCoupon(false);
              }
            }}
            onClose={() => {
              if (!redeemingCoupon) {
                setBarcodeCouponId(null);
                setRedeemCouponError(null);
              }
            }}
          />
        );
      })()}
    </div>
  );
}
