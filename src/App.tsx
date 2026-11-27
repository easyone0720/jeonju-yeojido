import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BottomNav, type NavTab } from './components/BottomNav';
import { MediaWallVideo } from './components/MediaWallVideo';
import { SharedResultPage } from './components/SharedResultPage';
import { overlayAiResult, useLatestAiResult } from './services/aiPastLife/latest';
import { readSharedResultId } from './services/aiPastLife/api';
import { GoodsCheckoutPage } from './components/GoodsCheckoutPage';
import { GoodsStorePage } from './components/GoodsStorePage';
import { TopExperienceHeader } from './components/TopExperienceHeader';
import type { GoodsItem } from './data/goods';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { HomeWorkspace, type QrCompletionBanner } from './components/HomeWorkspace';
import { RecoveryCodeModal } from './components/RecoveryCodeModal';
import { RestoreSessionModal } from './components/RestoreSessionModal';
import { SceneArriveVerify } from './components/SceneArriveVerify';
import { SceneClueReveal } from './components/SceneClueReveal';
import { SceneInputConsent } from './components/SceneInputConsent';
import { SceneMediaConsent } from './components/SceneMediaConsent';
import { SceneMuseumFace } from './components/SceneMuseumFace';
import { SceneQrScan } from './components/SceneQrScan';
import { SceneResult } from './components/SceneResult';
import { SceneStart } from './components/SceneStart';
import { TutorialModal } from './components/TutorialModal';
import { JEONJU_SPOTS } from './data/jeonjuSpots';
import {
  ClueRecord,
  ClueSpotId,
  CompanionType,
  GeoCoordinates,
  HomeTab,
  PastLifeResult,
  SceneId,
  SpotId,
  UserSessionState,
} from './types/jeonju';
import {
  createInitialSession,
  getCollectedClueCount,
  getResumeNavigationState,
  isSpotClueOrPastLifeCompleted,
  isSpotVisitVerified,
} from './utils/pastLifeEngine';
import {
  clearMemoryAuthToken,
  getAuthHeaders,
  scrubLegacySensitiveStorage,
  setMemoryAuthToken,
} from './utils/storage';
import {
  hideTutorialForToday,
  shouldShowTutorial,
} from './utils/tutorialStorage';
import { apiFetch } from './utils/localApi';
import { getZodiacCode } from './utils/zodiacMotif';
import { ENABLE_QUICK_COMPLETE_BUTTON } from './config/features';

type RoutePath = '/' | '/wall' | '/admin';

function readRouteFromLocation(): RoutePath {
  const path = window.location.pathname;
  if (path === '/wall') return '/wall';
  if (path === '/admin') return '/admin';
  return '/';
}

export default function App() {
  const [route, setRoute] = useState<RoutePath>(() => readRouteFromLocation());
  const [session, setSession] = useState<UserSessionState>(() =>
    createInitialSession({ sessionId: '' })
  );
  const [scene, setScene] = useState<SceneId>(1);

  const [homeTab, setHomeTab] = useState<HomeTab>('map');
  // 굿즈 스토어/결제 화면 (진행 단계(scene)와 별개의 오버레이 화면, 저장하지 않는다)
  const [mediaVideoOpen, setMediaVideoOpen] = useState(false);
  // AI 로 만든 최신 전생 결과(제목·한 줄·초상화)를 앱 전체에 같은 값으로 보여 주기 위한 덮어쓰기
  const latestAi = useLatestAiResult(session.sessionId);
  const viewResult = useMemo(() => overlayAiResult(session.pastLifeResult, latestAi), [session.pastLifeResult, latestAi]);
  const viewSession = useMemo(() => (viewResult === session.pastLifeResult ? session : { ...session, pastLifeResult: viewResult }), [session, viewResult]);
  const [goodsView, setGoodsView] = useState<{ page: 'store' } | { page: 'checkout'; item: GoodsItem } | null>(null);
  const [selectedSpotId, setSelectedSpotId] = useState<SpotId>('wanpanbon');
  const [activeClaimSpotId, setActiveClaimSpotId] = useState<SpotId>('wanpanbon');
  const [lastVerifiedQrCode, setLastVerifiedQrCode] = useState<string | null>(null);
  const [justStampedSpotId, setJustStampedSpotId] = useState<SpotId | null>(null);
  const [qrCompletionBanner, setQrCompletionBanner] = useState<QrCompletionBanner | null>(null);
  const [revealedClue, setRevealedClue] = useState<ClueRecord | null>(null);
  const [revealedAlreadyClaimed, setRevealedAlreadyClaimed] = useState(false);

  // Unified Onboarding & Restoration Modals
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [restoreModalSession, setRestoreModalSession] = useState<UserSessionState | null>(null);
  const [issuedRecoveryCode, setIssuedRecoveryCode] = useState<string | null>(null);
  const [issuedVisitorName, setIssuedVisitorName] = useState<string>('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingRetryPayload, setPendingRetryPayload] = useState<UserSessionState | null>(null);

  // Scrub any legacy localStorage PII/secrets and wire popstate + ?autostart=1
  useEffect(() => {
    scrubLegacySensitiveStorage();

    const onPopState = () => {
      setRoute(readRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);

    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateRoute = useCallback((nextPath: RoutePath) => {
    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setRoute(nextPath);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const persistProgressMilestone = useCallback(async (next: UserSessionState) => {
    setSession(next);
    if (!next.sessionId) return;
    try {
      const res = await apiFetch(`/api/session/${encodeURIComponent(next.sessionId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(next.mode),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          currentScene: next.currentScene,
          currentSpotId: next.currentSpotId,
          lastCompletedStep: next.lastCompletedStep,
          companion: next.companion,
          facePrivacyConsent: next.facePrivacyConsent,
        }),
      });
      if (!res.ok) {
        throw new Error('서버 저장 응답이 올바르지 않습니다.');
      }
      const data = (await res.json()) as { session?: UserSessionState };
      if (data.session) {
        setSession(data.session);
      }
      setSaveError(null);
      setPendingRetryPayload(null);
    } catch {
      setPendingRetryPayload(next);
      setSaveError('진행 상태를 서버에 저장하지 못했습니다. 네트워크 상태를 확인 후 다시 시도해 주세요.');
    }
  }, []);

  const applyRestoredSession = useCallback((restored: UserSessionState) => {
    const target = getResumeNavigationState(restored);
    setSession(restored);
    setHomeTab(target.homeTab);
    setSelectedSpotId(target.selectedSpotId);
    setJustStampedSpotId(null);
    setQrCompletionBanner(null);
    setRevealedClue(null);
    setSaveError(null);
    setRestoreModalSession(null);
    setScene(target.scene);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const checkExistingAuthOrGoToInput = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/auth/me?mode=experience`, {
        headers: getAuthHeaders('experience'),
        credentials: 'same-origin',
      });
      if (res.ok) {
        const data = (await res.json()) as {
          authenticated?: boolean;
          session?: UserSessionState | null;
        };
        if (data.authenticated && data.session) {
          setRestoreModalSession(data.session);
          return;
        }
      }
    } catch {
      // Fallback safely to new registration/recovery view if auth check fails transiently
    }

    setSession(createInitialSession({ sessionId: '', mode: 'experience' }));
    setScene(2);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Scene 1 CTA clicks
  const handleStartClick = () => {
    if (shouldShowTutorial(new Date())) {
      setTutorialOpen(true);
      return;
    }
    void checkExistingAuthOrGoToInput();
  };

  const handleCloseTutorialWithoutHide = () => {
    setTutorialOpen(false);
    void checkExistingAuthOrGoToInput();
  };

  const handleHideTutorialTodayAndProceed = () => {
    hideTutorialForToday(new Date());
    setTutorialOpen(false);
    void checkExistingAuthOrGoToInput();
  };

  // Scene 2: Register new non-member experience user
  const handleSubmitInputConsent = async (data: {
    visitorName: string;
    birthDate: string;
    companion: CompanionType;
    permissionsAcknowledged: { location: boolean; camera: boolean };
  }) => {
    // 생년월일은 이 함수 안(브라우저 메모리)에서 12간지 코드로만 바꾸고 버린다.
    // 저장소·요청 본문·로그 어디에도 원문을 넣지 않는다. 띠 계산에 실패하면 띠 없이 진행한다.
    const zodiacCode = getZodiacCode(data.birthDate);
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        mode: 'experience',
        visitorName: data.visitorName,
        zodiacCode,
        companion: data.companion,
        permissionsAcknowledged: data.permissionsAcknowledged,
      }),
    });

    const payload = (await res.json()) as {
      session?: UserSessionState;
      recoveryCode?: string | null;
      authToken?: string;
      error?: string;
    };

    if (!res.ok || !payload.session) {
      throw new Error(payload.error || '체험 기록 생성에 실패했습니다. 다시 시도해 주세요.');
    }

    if (payload.authToken) {
      setMemoryAuthToken(payload.session.mode, payload.authToken);
    }
    setSession(payload.session);
    setSaveError(null);
    setSelectedSpotId('wanpanbon');
    setHomeTab('map');

    if (payload.recoveryCode) {
      setIssuedVisitorName(payload.session.visitorName);
      setIssuedRecoveryCode(payload.recoveryCode);
    } else {
      setScene(3);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  };

  // Scene 2: Recover existing experience record via nickname + birthDate + recoveryCode
  const handleRecoverSession = async (data: {
    visitorName: string;
    birthDate: string;
    recoveryCode: string;
  }) => {
    const res = await apiFetch('/api/auth/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      // 생년월일은 보내지 않는다 (로컬 모드는 복구 기능이 없고, 서버 모드는 현재 사용하지 않음)
      body: JSON.stringify({ visitorName: data.visitorName, recoveryCode: data.recoveryCode }),
    });

    const payload = (await res.json()) as {
      session?: UserSessionState;
      authToken?: string;
      error?: string;
    };

    if (!res.ok || !payload.session) {
      throw new Error(
        payload.error || '입력하신 정보와 일치하는 기록을 찾을 수 없습니다.'
      );
    }

    if (payload.authToken) {
      setMemoryAuthToken(payload.session.mode, payload.authToken);
    }
    applyRestoredSession(payload.session);
  };

  // Scene 6 -> Atomic QR Verification + Auto Clue/Coupon Save (GPS-free)
  const handleQrVerified = async (
    recognizedSpotId: SpotId,
    qrCodeValue: string
  ) => {
    const res = await apiFetch(
      `/api/session/${encodeURIComponent(session.sessionId)}/verify-qr`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(session.mode),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          spotId: recognizedSpotId,
          qrCodeValue,
        }),
      }
    );

    const data = (await res.json().catch(() => ({}))) as {
      session?: UserSessionState;
      claimedClue?: ClueRecord;
      alreadyVerified?: boolean;
      error?: string;
    };

    if (res.status === 401) {
      throw new Error(
        data.error ||
          '로그인 상태를 확인할 수 없습니다. 이전 기록을 복원한 후 다시 시도해 주세요.'
      );
    }

    if (res.status === 409 || data.alreadyVerified) {
      if (data.session) {
        setSession(data.session);
      }
      throw new Error(data.error || '이미 방문 인증을 완료한 장소입니다.');
    }

    if (!res.ok || !data.session) {
      throw new Error(
        data.error || '인증 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
      );
    }

    setSession(data.session);
    setSaveError(null);
    setSelectedSpotId(recognizedSpotId);
    setLastVerifiedQrCode(qrCodeValue || null);
    setJustStampedSpotId(recognizedSpotId);

    if (recognizedSpotId === 'jeonju_museum') {
      setQrCompletionBanner({
        spotId: 'jeonju_museum',
        spotName: '국립전주박물관',
        message:
          '국립전주박물관 QR 방문 인증이 완료되었습니다! 이제 내 전생 결과를 확인하세요.',
        isMuseum: true,
      });
    } else {
      const spotName =
        JEONJU_SPOTS.find((s) => s.id === recognizedSpotId)?.name ?? '';
      const clueSummary = data.claimedClue
        ? `${data.claimedClue.label} · 제휴 쿠폰`
        : '전생 조각 · 제휴 쿠폰';
      if (data.claimedClue) {
        setRevealedClue(data.claimedClue);
        setRevealedAlreadyClaimed(false);
      }
      setQrCompletionBanner({
        spotId: recognizedSpotId,
        spotName,
        message: `${spotName} QR 방문 인증이 완료되어 ${clueSummary}이(가) 자동 지급되었습니다.`,
        isMuseum: false,
        clueCategory: data.claimedClue?.category,
      });
    }

    setHomeTab('map');
    setScene(3);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Scene 7 -> Scene 8 (Claim Clue & Coupon fallback if continuing manually)
  const handleClaimClueAndCoupon = async (params: {
    spotId: ClueSpotId;
    coords: GeoCoordinates | null;
    spotPhotoCaptured: boolean;
    qrCodeValue?: string | null;
  }) => {
    const res = await apiFetch(
      `/api/session/${encodeURIComponent(session.sessionId)}/claim`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(session.mode),
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          spotId: params.spotId,
          coords: params.coords,
          spotPhotoCaptured: params.spotPhotoCaptured,
          qrCodeValue: params.qrCodeValue ?? lastVerifiedQrCode,
        }),
      }
    );

    const data = (await res.json()) as {
      session?: UserSessionState;
      claimedClue?: ClueRecord;
      alreadyClaimed?: boolean;
      error?: string;
    };

    if (res.status === 401) {
      throw new Error(
        data.error ||
          '로그인 상태를 확인할 수 없습니다. 이전 기록을 복원한 후 다시 시도해 주세요.'
      );
    }

    if (!res.ok || !data.session || !data.claimedClue) {
      throw new Error(data.error || '장소 인증 및 조각 수령에 실패했습니다.');
    }

    setSession(data.session);
    setSaveError(null);
    setRevealedClue(data.claimedClue);
    setRevealedAlreadyClaimed(Boolean(data.alreadyClaimed));
    setScene(8);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleUseDemoCoupon = async (couponId: string) => {
    const res = await apiFetch(
      `/api/session/${encodeURIComponent(session.sessionId)}/coupons/${encodeURIComponent(couponId)}/use`,
      {
        method: 'POST',
        headers: getAuthHeaders(session.mode),
        credentials: 'same-origin',
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      session?: UserSessionState;
      error?: string;
    };
    if (!res.ok) {
      const msg = data.error || '쿠폰 사용 처리 중 오류가 발생했습니다.';
      setSaveError(msg);
      throw new Error(msg);
    }
    if (data.session) {
      setSession(data.session);
    }
    setSaveError(null);
  };

  // Scene 9 -> Scene 10
  const handlePastLifeGenerated = (
    nextSession: UserSessionState,
    _result: PastLifeResult
  ) => {
    setSession(nextSession);
    setSaveError(null);
    setScene(10);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // [QUICK-COMPLETE] 4개 거점 인증·조각·쿠폰을 한 번에 완료하고 박물관 단계로 이동 (시연·검수용)
  const handleCompleteAllStamps = async () => {
    const res = await apiFetch(
      `/api/session/${encodeURIComponent(session.sessionId)}/complete-all-stamps`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders(session.mode) },
        credentials: 'same-origin',
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      session?: UserSessionState;
      error?: string;
    };
    if (!res.ok || !data.session) {
      throw new Error(data.error || '스탬프 일괄 완료에 실패했습니다.');
    }
    setSession(data.session);
    setSaveError(null);
    setJustStampedSpotId(null);
    setQrCompletionBanner(null);
    setSelectedSpotId('jeonju_museum');
    setHomeTab('map');
    setScene(3);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Scene 11 Consent Submit
  const handleMediaConsentSubmit = async (consent: 'accepted' | 'declined') => {
    const res = await apiFetch('/api/wall/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(session.mode),
      },
      credentials: 'same-origin',
      body: JSON.stringify({
        sessionId: session.sessionId,
        consent,
      }),
    });
    const data = (await res.json()) as {
      session?: UserSessionState;
      error?: string;
    };
    if (!res.ok || !data.session) {
      throw new Error(data.error || '전시 동의 처리에 실패했습니다.');
    }
    setSession(data.session);
    setSaveError(null);
  };

  // Non-destructive Return to Main Home (preserves DB record & auth cookie!)
  const handleGoHomePreservingRecord = () => {
    setScene(1);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // 하단 내비게이션(지도/내 조각/쿠폰): 어느 체험 화면에서든 즉시 해당 탭으로 이동한다.
  // 결과 캐릭터는 sessionStorage에 고정되어 있고 진행 상태는 session에 있으므로 이동 후 돌아와도 유지된다.
  const handleNavTab = (tab: NavTab) => {
    setMediaVideoOpen(false);
    if (tab === 'goods') {
      // 기념품 탭: 14종 굿즈 스토어를 바로 연다 (결과 화면이 없어도 열람 가능)
      setJustStampedSpotId(null);
      setQrCompletionBanner(null);
      setGoodsView({ page: 'store' });
      window.scrollTo({ top: 0, behavior: 'auto' });
      return;
    }
    setGoodsView(null);
    const nextScene: SceneId = tab === 'map' ? 3 : tab === 'clues' ? 4 : 5;
    setJustStampedSpotId(null);
    setQrCompletionBanner(null);
    setHomeTab(tab);
    setScene(nextScene);
    window.scrollTo({ top: 0, behavior: 'auto' });
    void persistProgressMilestone({
      ...session,
      currentScene: nextScene,
      currentSpotId: selectedSpotId,
    });
  };

  // 기념품 잠금: 4개 거점(박물관 제외) 방문 도장이 모두 모여야 열린다
  const stampCount = JEONJU_SPOTS.filter(
    (s) => s.id !== 'jeonju_museum' && isSpotVisitVerified(session, s.id)
  ).length;
  const goodsLocked = stampCount < 4;

  const withNav = (node: ReactNode, activeTab: NavTab | null, withHeader = false) => (
    <>
      {withHeader && (
        <TopExperienceHeader
          clueCount={getCollectedClueCount(session)}
          visitorName={session.visitorName}
          onOpenMediaWall={openMediaWall}
          onGoHome={handleGoHomePreservingRecord}
          onCompleteAllStamps={ENABLE_QUICK_COMPLETE_BUTTON ? handleCompleteAllStamps : undefined}
        />
      )}
      {node}
      <BottomNav activeTab={activeTab} onChangeTab={handleNavTab} goodsLocked={goodsLocked} />
      {mediaVideoOpen && <MediaWallVideo onClose={closeMediaWall} />}
    </>
  );

  // 미디어월: 초상화 갤러리 대신 영상 화면을 쓴다. (/wall 로 직접 들어와도 영상, X → '/' 지도 탭)
  // 모든 '미디어월' 버튼(시작 화면·지도 헤더·박물관 상세·미디어월 동의 완료 화면)이 이 하나의 함수를 쓴다
  const openMediaWall = () => setMediaVideoOpen(true);
  const openRoute = (p: RoutePath) => {
    if (p === '/wall') openMediaWall();
    else navigateRoute(p);
  };
  const closeMediaWall = () => {
    setMediaVideoOpen(false);
    if (route === '/wall') navigateRoute('/');
    // 체험이 시작된 상태면 지도 탭으로, 시작 화면이면 시작 화면으로 돌아간다
    if (scene !== 1) handleNavTab('map');
  };

  // 공유 링크(?sharedResult=…)로 들어오면 그 결과를 바로 보여 준다
  const sharedResultId = readSharedResultId();
  if (sharedResultId && route === '/') {
    return (
      <SharedResultPage
        resultId={sharedResultId}
        onStart={() => window.location.replace('/')}
      />
    );
  }

  if (route === '/wall') {
    return <MediaWallVideo onClose={closeMediaWall} />;
  }

  if (route === '/admin') {
    return <AdminDashboardPage onBackToApp={() => navigateRoute('/')} />;
  }

  // 굿즈 스토어/결제창의 X·완료: 전생 결과가 있으면 결과 화면으로, 없으면 지도 탭으로 돌아간다
  const closeGoodsToResult = () => {
    if (!session.pastLifeResult) {
      handleNavTab('map');
      return;
    }
    setGoodsView(null);
    setScene(10);
    window.scrollTo({ top: 0, behavior: 'auto' });
    void persistProgressMilestone({ ...session, currentScene: 10 });
  };

  if (goodsView) {
    return withNav(
      goodsView.page === 'checkout' ? (
        <GoodsCheckoutPage
          key={goodsView.item.id}
          item={goodsView.item}
          withBottomNav
          onBackToList={() => setGoodsView({ page: 'store' })}
          onClose={closeGoodsToResult}
          onFinish={closeGoodsToResult}
        />
      ) : (
        <GoodsStorePage
          withBottomNav
          locked={goodsLocked}
          visitedCount={stampCount}
          onGoToMap={() => handleNavTab('map')}
          onClose={() => handleNavTab('map')}
          onSelectGoods={(item) => {
            setGoodsView({ page: 'checkout', item });
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      ),
      'goods',
      true,
    );
  }

  const clueCount = getCollectedClueCount(session);
  const restoreSummary = restoreModalSession
    ? getResumeNavigationState(restoreModalSession).stepSummary
    : '';

  if (scene === 1) {
    return (
      <>
        <SceneStart
          onStart={handleStartClick}
          onNavigateRoute={openRoute}
        />
        {mediaVideoOpen && <MediaWallVideo onClose={closeMediaWall} />}
        <TutorialModal
          open={tutorialOpen}
          onCloseWithoutHide={handleCloseTutorialWithoutHide}
          onHideTodayAndProceed={handleHideTutorialTodayAndProceed}
        />
        <RestoreSessionModal
          open={Boolean(restoreModalSession)}
          session={restoreModalSession}
          stepSummary={restoreSummary}
          onResume={() => {
            if (restoreModalSession) {
              applyRestoredSession(restoreModalSession);
            }
          }}
          onGoHome={() => {
            setRestoreModalSession(null);
            setScene(1);
          }}
          onStartDifferent={async () => {
            const modeToClear = restoreModalSession?.mode ?? 'experience';
            setRestoreModalSession(null);
            try {
              await apiFetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...getAuthHeaders(modeToClear),
                },
                credentials: 'same-origin',
                body: JSON.stringify({ mode: modeToClear }),
              });
            } catch {
              // Ignore transient logout issue; UI still proceeds safely to new/recover form
            }
            clearMemoryAuthToken(modeToClear);
            setSession(createInitialSession({ sessionId: '', mode: modeToClear }));
            setScene(2);
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      </>
    );
  }

  if (scene === 2) {
    return (
      <>
        <SceneInputConsent
          initialVisitorName={session.visitorName}
          initialBirthDate=""
          initialCompanion={session.companion}
          initialPermissions={session.permissionsAcknowledged}
          onBack={() => setScene(1)}
          onSubmit={handleSubmitInputConsent}
          onRecover={handleRecoverSession}
        />
        <RecoveryCodeModal
          open={Boolean(issuedRecoveryCode)}
          recoveryCode={issuedRecoveryCode}
          visitorName={issuedVisitorName}
          onConfirmStart={() => {
            setIssuedRecoveryCode(null);
            setScene(3);
            window.scrollTo({ top: 0, behavior: 'auto' });
          }}
        />
      </>
    );
  }

  if (scene === 6) {
    return withNav(
      <SceneQrScan
        expectedSpotId={selectedSpotId}
        alreadyVerified={isSpotVisitVerified(session, selectedSpotId)}
        collectedClueCount={clueCount}
        onBack={() => {
          setHomeTab('map');
          setScene(3);
          void persistProgressMilestone({
            ...session,
            currentScene: 3,
            currentSpotId: selectedSpotId,
          });
        }}
        onQrVerified={handleQrVerified}
      />
      ,
      'map'
    );
  }

  if (scene === 7) {
    return withNav(
      <SceneArriveVerify
        sessionId={session.sessionId}
        spotId={activeClaimSpotId}
        qrCodeValue={lastVerifiedQrCode}
        alreadyVisitVerified={isSpotVisitVerified(session, activeClaimSpotId)}
        alreadyCompleted={isSpotClueOrPastLifeCompleted(session, activeClaimSpotId)}
        onBack={() => {
          setHomeTab('map');
          setScene(3);
          void persistProgressMilestone({
            ...session,
            currentScene: 3,
            currentSpotId: activeClaimSpotId,
          });
        }}
        onSpotAuthenticated={(nextSession, stampedSpotId) => {
          setSession(nextSession);
          setJustStampedSpotId(stampedSpotId);
        }}
        onClaimClueAndCoupon={handleClaimClueAndCoupon}
        onProceedToMuseumFace={() => {
          setSelectedSpotId('jeonju_museum');
          setScene(9);
          void persistProgressMilestone({
            ...session,
            currentScene: 9,
            currentSpotId: 'jeonju_museum',
          });
        }}
      />
      ,
      'map'
    );
  }

  if (scene === 8 && revealedClue) {
    const linkedCoupon = session.coupons.find(
      (c) => c.spotId === revealedClue.spotId
    );
    return withNav(
      <SceneClueReveal
        clue={revealedClue}
        coupon={linkedCoupon}
        collectedCount={clueCount}
        alreadyClaimed={revealedAlreadyClaimed}
        onGoToMap={() => {
          setHomeTab('map');
          setScene(3);
          void persistProgressMilestone({
            ...session,
            currentScene: 3,
            currentSpotId: revealedClue.spotId,
          });
        }}
        onGoToCoupons={() => {
          setHomeTab('coupons');
          setScene(5);
          void persistProgressMilestone({
            ...session,
            currentScene: 5,
            currentSpotId: revealedClue.spotId,
          });
        }}
        onGoToMuseumFace={() => {
          setSelectedSpotId('jeonju_museum');
          setScene(9);
          void persistProgressMilestone({
            ...session,
            currentScene: 9,
            currentSpotId: 'jeonju_museum',
          });
        }}
      />
      ,
      'clues'
    );
  }

  if (scene === 9) {
    return withNav(
      <SceneMuseumFace
        session={session}
        onBack={() => {
          setHomeTab('map');
          setScene(3);
          void persistProgressMilestone({
            ...session,
            currentScene: 3,
            currentSpotId: 'jeonju_museum',
          });
        }}
        onGenerated={handlePastLifeGenerated}
      />
      ,
      'map'
    );
  }

  if (scene === 10 && session.pastLifeResult) {
    return withNav(
      <SceneResult
        result={viewResult ?? session.pastLifeResult}
        visitorName={session.visitorName}
        onBackToMap={() => {
          setHomeTab('map');
          setScene(3);
          void persistProgressMilestone({
            ...session,
            currentScene: 3,
          });
        }}
        onGoToCoupons={() => {
          setHomeTab('coupons');
          setScene(5);
          void persistProgressMilestone({
            ...session,
            currentScene: 5,
          });
        }}
        onGoToMediaConsent={() => {
          setScene(11);
          void persistProgressMilestone({
            ...session,
            currentScene: 11,
          });
        }}
      />
      ,
      null,
      true,
    );
  }

  if (scene === 11 && session.pastLifeResult) {
    return withNav(
      <SceneMediaConsent
        result={viewResult ?? session.pastLifeResult}
        visitorName={session.visitorName}
        currentConsent={session.mediaWallConsent}
        onBackToResult={() => {
          setScene(10);
          void persistProgressMilestone({
            ...session,
            currentScene: 10,
          });
        }}
        onSubmitConsent={handleMediaConsentSubmit}
        onOpenWall={openMediaWall}
        onOpenGoods={() => {
          setGoodsView({ page: 'store' });
          window.scrollTo({ top: 0, behavior: 'auto' });
        }}
        onGoToCoupons={() => {
          setHomeTab('coupons');
          setScene(5);
          void persistProgressMilestone({
            ...session,
            currentScene: 5,
          });
        }}
      />
      ,
      null
    );
  }

  // Scenes 3, 4, 5 share HomeWorkspace seamlessly
  return (
    <>
    <HomeWorkspace
      session={viewSession}
      activeTab={homeTab}
      selectedSpotId={selectedSpotId}
      justStampedSpotId={justStampedSpotId}
      qrBanner={qrCompletionBanner}
      onDismissQrBanner={() => setQrCompletionBanner(null)}
      onOpenClueScroll={(spotId) => {
        const spot = JEONJU_SPOTS.find((s) => s.id === spotId);
        const clue = spot?.clueCategory ? session.clues[spot.clueCategory] : undefined;
        if (clue) {
          setRevealedClue(clue);
          setRevealedAlreadyClaimed(true);
          setJustStampedSpotId(null);
          setScene(8);
          window.scrollTo({ top: 0, behavior: 'auto' });
        }
      }}
      onChangeTab={handleNavTab}
      goodsLocked={goodsLocked}
      onSelectSpot={(spotId) => {
        setJustStampedSpotId(null);
        setSelectedSpotId(spotId);
        void persistProgressMilestone({
          ...session,
          currentSpotId: spotId,
        });
      }}
      onOpenQrScan={(spotId) => {
        setJustStampedSpotId(null);
        setQrCompletionBanner(null);
        setSelectedSpotId(spotId);
        setScene(6);
        void persistProgressMilestone({
          ...session,
          currentScene: 6,
          currentSpotId: spotId,
        });
        window.scrollTo({ top: 0, behavior: 'auto' });
      }}
      onContinueSpotVerify={(spotId) => {
        setJustStampedSpotId(null);
        setActiveClaimSpotId(spotId);
        setSelectedSpotId(spotId);
        setScene(7);
        void persistProgressMilestone({
          ...session,
          currentScene: 7,
          currentSpotId: spotId,
        });
        window.scrollTo({ top: 0, behavior: 'auto' });
      }}
      onOpenMuseumFace={() => {
        setJustStampedSpotId(null);
        setQrCompletionBanner(null);
        setSelectedSpotId('jeonju_museum');
        setScene(9);
        void persistProgressMilestone({
          ...session,
          currentScene: 9,
          currentSpotId: 'jeonju_museum',
        });
        window.scrollTo({ top: 0, behavior: 'auto' });
      }}
      onViewPastLifeResult={() => {
        setJustStampedSpotId(null);
        setScene(10);
        void persistProgressMilestone({
          ...session,
          currentScene: 10,
        });
        window.scrollTo({ top: 0, behavior: 'auto' });
      }}
      onUseDemoCoupon={handleUseDemoCoupon}
      onNavigateRoute={openRoute}
      onOpenMediaWall={openMediaWall}
      onGoHome={handleGoHomePreservingRecord}
      onCompleteAllStamps={
        // [QUICK-COMPLETE] 시연·검수용 — features.ts 의 ENABLE_QUICK_COMPLETE_BUTTON 으로 끈다
        ENABLE_QUICK_COMPLETE_BUTTON ? handleCompleteAllStamps : undefined
      }
      saveError={saveError}
      onRetrySync={
        pendingRetryPayload
          ? () => void persistProgressMilestone(pendingRetryPayload)
          : undefined
      }
    />
    {mediaVideoOpen && <MediaWallVideo onClose={closeMediaWall} />}
    </>
  );
}
