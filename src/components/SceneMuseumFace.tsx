import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { GeoCoordinates, PastLifeResult, UserSessionState } from '../types/jeonju';
import {
  determinePastLifeArchetype,
  getCollectedClueCount,
  isSpotVisitVerified,
  verifySpotLocation,
} from '../utils/pastLifeEngine';
import { getAuthHeaders } from '../utils/storage';
import { synthesizeJoseonPortrait } from '../utils/portraitPainter';
import { USE_LOCAL_BACKEND } from '../config/features';
import { apiFetch } from '../utils/localApi';

interface SceneMuseumFaceProps {
  session: UserSessionState;
  onBack: () => void;
  onGenerated: (nextSession: UserSessionState, result: PastLifeResult) => void;
}

/**
 * 4개 조각을 모은 뒤 국립전주박물관 인증이 끝나면 사진 촬영 없이 곧바로 전생 결과를 만든다.
 * (웹캠·사진 업로드 UI는 제거됨. 이 화면은 결과 생성 중 잠깐 보이는 전환 화면이다.)
 */
export function SceneMuseumFace({ session, onBack, onGenerated }: SceneMuseumFaceProps) {
  const museumQrVerified = isSpotVisitVerified(session, 'jeonju_museum');
  const clueCount = getCollectedClueCount(session);
  const museumSpot = JEONJU_SPOTS.find((s) => s.id === 'jeonju_museum')!;

  const [museumCoords, setMuseumCoords] = useState<GeoCoordinates | null>(null);
  const [gpsState, setGpsState] = useState<'checking' | 'ok' | 'fail'>(
    museumQrVerified ? 'ok' : 'checking'
  );
  const [gpsMessage, setGpsMessage] = useState('국립전주박물관 위치 확인 중...');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const generatingRef = useRef(false);

  // QR 인증이 없으면 GPS로 박물관 위치를 확인한다.
  useEffect(() => {
    if (museumQrVerified) {
      setGpsState('ok');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsState('fail');
      setGpsMessage('위치 서비스를 사용할 수 없습니다.');
      return;
    }
    setGpsState('checking');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const current: GeoCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setMuseumCoords(current);
        const check = verifySpotLocation('jeonju_museum', current, 'experience');
        setGpsState(check.verified ? 'ok' : 'fail');
        setGpsMessage(check.reason);
      },
      () => {
        setGpsState('fail');
        setGpsMessage('국립전주박물관 위치 확인에 실패했습니다. 위치 권한을 허용해 주세요.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [museumQrVerified, attempt]);

  // 인증이 확인되면 즉시 결과를 생성하고 결과 화면으로 넘긴다.
  useEffect(() => {
    if (gpsState !== 'ok' || generatingRef.current) return;
    if (clueCount < 4) {
      setErrorMsg('4개의 전생 조각을 모두 모아야 진행할 수 있습니다.');
      return;
    }
    generatingRef.current = true;
    setErrorMsg(null);

    void (async () => {
      try {
        const archetype = determinePastLifeArchetype({
          birthDate: session.birthDate || '1998-05-15',
          visitOrder: session.visitOrder,
          sessionId: session.sessionId,
        });

        // 로컬 단독 모드는 고정 일러스트를 쓰므로 초상화를 만들지 않는다. 서버 모드의 폴백용으로만 생성한다.
        const portraitDataUrl = USE_LOCAL_BACKEND
          ? ''
          : await synthesizeJoseonPortrait({
              faceImageDataUrl: null,
              archetypeId: archetype.id,
              title: archetype.title,
              hanjaTitle: archetype.hanjaTitle,
              visitorName: session.visitorName,
            });

        const response = await apiFetch('/api/past-life/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(session.mode),
          },
          credentials: 'same-origin',
          body: JSON.stringify({
            sessionId: session.sessionId,
            portraitDataUrl,
            faceImageDataUrl: null,
            faceConsent: false,
            coords: museumCoords,
            mode: session.mode,
          }),
        });

        const payload = (await response.json()) as {
          session?: UserSessionState;
          result?: PastLifeResult;
          error?: string;
        };

        if (!response.ok || !payload.session || !payload.result) {
          throw new Error(payload.error || '전생 생성 중 오류가 발생했습니다.');
        }

        onGenerated(payload.session, payload.result);
      } catch (err) {
        generatingRef.current = false;
        setErrorMsg(err instanceof Error ? err.message : '전생 생성 중 문제가 발생했습니다.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gpsState, attempt]);

  const failed = gpsState === 'fail' || Boolean(errorMsg);
  const message = errorMsg ?? (gpsState === 'fail' ? gpsMessage : null);

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-28">
      <header className="w-full px-4 h-12 flex items-center justify-between max-w-md sm:max-w-lg mx-auto">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>지도</span>
        </button>
        <span className="text-xs font-medium text-[#78716C]">{museumSpot.name}</span>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-5 py-10 flex flex-col items-center justify-center gap-5 text-center">
        {failed ? (
          <>
            <div
              role="alert"
              className="w-full rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 p-3 flex items-start gap-2 text-xs text-[#7C2D12] text-left"
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{message}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                generatingRef.current = false;
                setErrorMsg(null);
                setAttempt((n) => n + 1);
              }}
              className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] transition-colors"
            >
              다시 시도
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-8 h-8 text-[#9A3412] animate-spin" aria-hidden="true" />
            <p className="font-serif-kr text-base font-semibold text-[#1C1917]">
              조각 4개가 하나로 모이고 있어요.
              <br />
              전생을 확인하는 중...
            </p>
          </>
        )}
      </main>
    </div>
  );
}
