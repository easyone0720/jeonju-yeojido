import { useCallback, useEffect, useState } from 'react';
import { AdminDashboardPage } from './components/AdminDashboardPage';
import { HomeWorkspace, type QrCompletionBanner } from './components/HomeWorkspace';
import { MediaWallPage } from './components/MediaWallPage';
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
  AppMode,
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
  const [activeInputMode, setActiveInputMode] = useState<AppMode>('experience');

  const [homeTab, setHomeTab] = useState<HomeTab>('map');
  const [selectedSpotId, setSelectedSpotId] = useState<SpotId>('gyeonggijeon');
  const [activeClaimSpotId, setActiveClaimSpotId] = useState<SpotId>('gyeonggijeon');
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

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      // Quick automated test entry using demo mode without polluting experience records
      apiFetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          mode: 'demo',
          visitorName: '시연 탐험가',
          birthDate: '1998-05-15',
          companion: 'alone',
          permissionsAcknowledged: { location: true, camera: true },
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { session?: UserSessionState; authToken?: string } | null) => {
          if (data?.session) {
            if (data.authToken) {
              setMemoryAuthToken('demo', data.authToken);
            }
            setSession(data.session);
            setActiveInputMode('demo');
            setHomeTab('map');
            setScene(3);
          }
        })
        .catch(() => {
          // Ignore autostart network error
        });
    }

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
    setActiveInputMode(restored.mode);
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

  const checkExistingAuthOrGoToInput = useCallback(async (chosenMode: AppMode) => {
    try {
      const res = await apiFetch(`/api/auth/me?mode=${encodeURIComponent(chosenMode)}`, {
        headers: getAuthHeaders(chosenMode),
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

    setActiveInputMode(chosenMode);
    setSession(createInitialSession({ sessionId: '', mode: chosenMode }));
    setScene(2);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  // Scene 1 CTA clicks
  const handleStartClick = (chosenMode: AppMode) => {
    setActiveInputMode(chosenMode);
    if (chosenMode === 'experience') {
      if (shouldShowTutorial(new Date())) {
        setTutorialOpen(true);
        return;
      }
    }
    void checkExistingAuthOrGoToInput(chosenMode);
  };

  const handleCloseTutorialWithoutHide = () => {
    setTutorialOpen(false);
    void checkExistingAuthOrGoToInput('experience');
  };

  const handleHideTutorialTodayAndProceed = () => {
    hideTutorialForToday(new Date());
    setTutorialOpen(false);
    void checkExistingAuthOrGoToInput('experience');
  };

  // Scene 2: Register new non-member experience/demo user
  const handleSubmitInputConsent = async (data: {
    visitorName: string;
    birthDate: string;
    companion: CompanionType;
    permissionsAcknowledged: { location: boolean; camera: boolean };
  }) => {
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({
        mode: activeInputMode,
        visitorName: data.visitorName,
        birthDate: data.birthDate,
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
    setSelectedSpotId('gyeonggijeon');
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
      body: JSON.stringify(data),
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
    qrCodeValue: string,
    options?: { demoSimulated?: boolean }
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
          demoSimulated: Boolean(options?.demoSimulated),
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
          '국립전주박물관 QR 방문 인증이 완료되었습니다! 이제 전생 초상화 촬영으로 전생을 완성하세요.',
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

  // Explicit User-Confirmed Record Deletion
  const handleDeleteCurrentRecord = async () => {
    const res = await apiFetch(
      `/api/auth/record?mode=${encodeURIComponent(session.mode)}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(session.mode),
        credentials: 'same-origin',
      }
    );
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(payload.error || '기록 삭제에 실패했습니다.');
    }

    clearMemoryAuthToken(session.mode);

    setSession(createInitialSession({ sessionId: '' }));
    setRevealedClue(null);
    setJustStampedSpotId(null);
    setQrCompletionBanner(null);
    setLastVerifiedQrCode(null);
    setSelectedSpotId('gyeonggijeon');
    setHomeTab('map');
    setSaveError(null);
    setPendingRetryPayload(null);
    setScene(1);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  // Separated Routes: /wall & /admin
  if (route === '/wall') {
    return <MediaWallPage onBackToApp={() => navigateRoute('/')} />;
  }

  if (route === '/admin') {
    return <AdminDashboardPage onBackToApp={() => navigateRoute('/')} />;
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
          onNavigateRoute={(p) => navigateRoute(p)}
        />
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
            setActiveInputMode(modeToClear);
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
          mode={activeInputMode}
          initialVisitorName={session.visitorName}
          initialBirthDate={session.birthDate}
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
    return (
      <SceneQrScan
        expectedSpotId={selectedSpotId}
        mode={session.mode}
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
    );
  }

  if (scene === 7) {
    return (
      <SceneArriveVerify
        sessionId={session.sessionId}
        spotId={activeClaimSpotId}
        mode={session.mode}
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
    );
  }

  if (scene === 8 && revealedClue) {
    const linkedCoupon = session.coupons.find(
      (c) => c.spotId === revealedClue.spotId
    );
    return (
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
    );
  }

  if (scene === 9) {
    return (
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
    );
  }

  if (scene === 10 && session.pastLifeResult) {
    return (
      <SceneResult
        result={session.pastLifeResult}
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
    );
  }

  if (scene === 11 && session.pastLifeResult) {
    return (
      <SceneMediaConsent
        result={session.pastLifeResult}
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
        onOpenWall={() => navigateRoute('/wall')}
        onGoToCoupons={() => {
          setHomeTab('coupons');
          setScene(5);
          void persistProgressMilestone({
            ...session,
            currentScene: 5,
          });
        }}
      />
    );
  }

  // Scenes 3, 4, 5 share HomeWorkspace seamlessly
  return (
    <HomeWorkspace
      session={session}
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
      onChangeTab={(tab) => {
        const nextScene = tab === 'map' ? 3 : tab === 'clues' ? 4 : 5;
        setJustStampedSpotId(null);
        setHomeTab(tab);
        setScene(nextScene);
        void persistProgressMilestone({
          ...session,
          currentScene: nextScene,
          currentSpotId: selectedSpotId,
        });
      }}
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
      onNavigateRoute={(p) => navigateRoute(p)}
      onGoHome={handleGoHomePreservingRecord}
      onDeleteRecord={handleDeleteCurrentRecord}
      saveError={saveError}
      onRetrySync={
        pendingRetryPayload
          ? () => void persistProgressMilestone(pendingRetryPayload)
          : undefined
      }
    />
  );
}
