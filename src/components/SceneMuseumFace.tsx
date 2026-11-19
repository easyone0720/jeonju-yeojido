import { ChangeEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckSquare,
  Square,
  Upload,
  AlertTriangle,
} from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { GeoCoordinates, PastLifeResult, UserSessionState } from '../types/jeonju';
import {
  determinePastLifeArchetype,
  getCollectedClueCount,
  isSpotVisitVerified,
  verifySpotLocation,
} from '../utils/pastLifeEngine';
import { getAuthHeaders } from '../utils/storage';
import { downscaleImageDataUrl, synthesizeJoseonPortrait } from '../utils/portraitPainter';
import { ENABLE_AI_GENERATION, USE_LOCAL_BACKEND } from '../config/features';
import { apiFetch } from '../utils/localApi';

interface SceneMuseumFaceProps {
  session: UserSessionState;
  onBack: () => void;
  onGenerated: (nextSession: UserSessionState, result: PastLifeResult) => void;
}

export function SceneMuseumFace({
  session,
  onBack,
  onGenerated,
}: SceneMuseumFaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedFaceUrl, setCapturedFaceUrl] = useState<string | null>(null);
  const [privacyAgreed, setPrivacyAgreed] = useState(session.facePrivacyConsent);
  const [museumCoords, setMuseumCoords] = useState<GeoCoordinates | null>(null);
  const museumQrVerified = isSpotVisitVerified(session, 'jeonju_museum');
  const [museumGpsVerified, setMuseumGpsVerified] = useState(
    session.mode === 'demo' || museumQrVerified
  );
  const [museumGpsMessage, setMuseumGpsMessage] = useState<string>(
    session.mode === 'demo'
      ? '시연 모드 국립전주박물관 도착이 확인되었습니다.'
      : museumQrVerified
        ? '국립전주박물관 QR 방문 인증이 완료되었습니다.'
        : '국립전주박물관 위치 확인 중...'
  );
  const [generating, setGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const museumSpot = JEONJU_SPOTS.find((s) => s.id === 'jeonju_museum')!;
  const clueCount = getCollectedClueCount(session);

  useEffect(() => {
    if (session.mode === 'demo' || museumQrVerified) {
      setMuseumGpsVerified(true);
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setMuseumGpsVerified(false);
      setMuseumGpsMessage('위치 서비스를 사용할 수 없습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const current: GeoCoordinates = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setMuseumCoords(current);
        const check = verifySpotLocation('jeonju_museum', current, 'experience');
        setMuseumGpsVerified(check.verified);
        setMuseumGpsMessage(check.reason);
      },
      () => {
        setMuseumGpsVerified(false);
        setMuseumGpsMessage('국립전주박물관 위치 확인에 실패했습니다. 위치 권한을 허용해 주세요.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [museumQrVerified, session.mode]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startFrontCamera = async () => {
    setErrorMsg(null);
    setCameraError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setCameraError('실시간 카메라를 열 수 없습니다. 사진 업로드를 이용해 주세요.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setCameraError('카메라 접근이 제한되었습니다. 사진 파일 업로드를 이용해 주세요.');
    }
  };

  const stopFrontCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureFromVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 640;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedFaceUrl(dataUrl);
    stopFrontCamera();
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCapturedFaceUrl(String(reader.result));
      stopFrontCamera();
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGeneratePastLife = async (useIllustratedFallback = false) => {
    if (clueCount < 4) {
      setErrorMsg('4개의 전생 조각을 모두 모아야 진행할 수 있습니다.');
      return;
    }
    if (!privacyAgreed) {
      setErrorMsg(
        ENABLE_AI_GENERATION
          ? 'AI 생성을 위한 사진 전송·미저장 안내에 동의해 주세요.'
          : '사진 사용 안내에 동의해 주세요.',
      );
      return;
    }
    if (!museumGpsVerified) {
      setErrorMsg(museumGpsMessage);
      return;
    }
    if (!useIllustratedFallback && !capturedFaceUrl) {
      setErrorMsg('먼저 얼굴을 촬영하거나 사진을 업로드해 주세요.');
      return;
    }

    setGenerating(true);
    setErrorMsg(null);

    try {
      const archetype = determinePastLifeArchetype({
        birthDate: session.birthDate || '1998-05-15',
        visitOrder: session.visitOrder,
        sessionId: session.sessionId,
      });

      // 로컬 단독 모드는 고정 캐릭터 일러스트를 쓰므로 캔버스 초상화를 만들지 않는다 (서버 모드의 폴백용으로만 생성)
      const portraitDataUrl = USE_LOCAL_BACKEND
        ? ''
        : await synthesizeJoseonPortrait({
            faceImageDataUrl: useIllustratedFallback ? null : capturedFaceUrl,
            archetypeId: archetype.id,
            title: archetype.title,
            hanjaTitle: archetype.hanjaTitle,
            visitorName: session.visitorName,
          });

      // AI 생성이 켜져 있고 동의한 경우에만, 줄인 얼굴 사진을 서버(→ Gemini 참조 이미지)로 보낸다. 서버는 저장하지 않는다.
      // AI 생성이 꺼져 있으면(기본) 사진은 이 기기 화면 밖으로 나가지 않는다.
      let faceImageForAi: string | null = null;
      if (ENABLE_AI_GENERATION && !useIllustratedFallback && capturedFaceUrl) {
        try {
          faceImageForAi = await downscaleImageDataUrl(capturedFaceUrl);
        } catch {
          faceImageForAi = null; // 사진 처리에 실패해도 얼굴 없이 계속 진행
        }
      }

      setCapturedFaceUrl(null);

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
          faceImageDataUrl: faceImageForAi,
          faceConsent: Boolean(faceImageForAi) && privacyAgreed,
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
      setErrorMsg(
        err instanceof Error ? err.message : '전생 생성 중 문제가 발생했습니다.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handlePrimaryShootAction = () => {
    if (capturedFaceUrl) {
      handleGeneratePastLife(false);
      return;
    }
    if (cameraActive) {
      captureFromVideo();
      return;
    }
    startFrontCamera();
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col">
      <header className="w-full px-4 h-12 flex items-center justify-between max-w-md sm:max-w-lg mx-auto">
        <button
          type="button"
          onClick={() => {
            stopFrontCamera();
            onBack();
          }}
          className="inline-flex items-center gap-1 text-sm text-[#57534E] hover:text-[#1C1917] min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>지도</span>
        </button>
        <span className="text-xs font-medium text-[#78716C]">{museumSpot.name}</span>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-5 py-3 flex flex-col items-center justify-between gap-5 pb-6 safe-pb">
        {/* Top Scroll Banner matching Scene 9 wireframe */}
        <div className="w-full flex items-center justify-center">
          <div className="w-3 rounded-full bg-gradient-to-r from-[#5C4428] to-[#8C6D46] border border-[#44311B] self-stretch shrink-0" />
          <div className="flex-1 bg-[#FBF5E8] border-y-2 border-[#C7B596] px-4 py-3.5 text-center shadow-sm">
            <h1 className="font-serif-kr text-sm sm:text-base font-bold text-[#1C1917] leading-snug">
              조각 4개를 모두 모았어요.
              <br />
              사진으로 전생을 확인해요!
            </h1>
          </div>
          <div className="w-3 rounded-full bg-gradient-to-l from-[#5C4428] to-[#8C6D46] border border-[#44311B] self-stretch shrink-0" />
        </div>

        {!museumGpsVerified && (
          <div className="w-full rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 p-3 flex items-start gap-2 text-xs text-[#7C2D12]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{museumGpsMessage}</span>
          </div>
        )}

        {/* Center Vertical Oval Face Guide matching Scene 9 wireframe */}
        <div className="flex flex-col items-center gap-3 my-auto">
          <div className="relative w-60 h-80 sm:w-64 sm:h-[22rem] rounded-[999px] border-2 border-[#1C1917]/60 bg-[#F2ECE1] overflow-hidden flex items-center justify-center shadow-inner">
            {capturedFaceUrl ? (
              <img
                src={capturedFaceUrl}
                alt="촬영된 얼굴 미리보기"
                className="w-full h-full object-cover"
              />
            ) : (
              <>
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className={`w-full h-full object-cover scale-x-[-1] ${
                    cameraActive ? 'block' : 'hidden'
                  }`}
                />
                {!cameraActive && (
                  <div className="p-6 text-center space-y-2">
                    <Camera className="w-7 h-7 text-[#9A3412] mx-auto" aria-hidden="true" />
                    <p className="font-serif-kr text-base font-semibold text-[#1C1917]">
                      얼굴을 여기에
                      <br />
                      맞춰요
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {cameraError && (
            <p className="text-xs text-[#9A3412] text-center max-w-xs">{cameraError}</p>
          )}
        </div>

        {/* Bottom: Privacy checkbox + '촬영' primary button + upload/demo options */}
        <div className="w-full space-y-3">
          <button
            type="button"
            role="checkbox"
            aria-checked={privacyAgreed}
            onClick={() => {
              setPrivacyAgreed((prev) => !prev);
              setErrorMsg(null);
            }}
            className="w-full text-left px-3 py-2 rounded-xl border border-[#E5DDD0] bg-white flex items-start gap-2.5 min-h-[44px]"
          >
            {privacyAgreed ? (
              <CheckSquare className="w-4 h-4 text-[#9A3412] shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <Square className="w-4 h-4 text-[#78716C] shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <span className="text-xs text-[#44403C] leading-snug">
              {ENABLE_AI_GENERATION
                ? 'AI 전생 일러스트 생성을 위해 사진이 Google Gemini API로 전송되며, 우리 서버에는 저장되지 않음에 동의합니다.'
                : '촬영한 사진은 이 기기 화면에서만 사용되며 서버나 외부로 전송·저장되지 않음을 확인했습니다.'}
            </span>
          </button>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#9A3412]/40 bg-[#9A3412]/10 px-3 py-2 text-xs font-medium text-[#7C2D12]"
            >
              {errorMsg}
            </div>
          )}

          {/* Primary '촬영' Button matching Scene 9 wireframe */}
          <button
            type="button"
            disabled={generating}
            onClick={handlePrimaryShootAction}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#9A3412] text-white font-semibold text-base hover:bg-[#7C2D12] disabled:opacity-60 transition-colors"
          >
            {generating
              ? ENABLE_AI_GENERATION
                ? 'AI가 전생을 그리는 중... (최대 1분)'
                : '전생을 확인하는 중...'
              : capturedFaceUrl
                ? '전생 확인하기'
                : cameraActive
                  ? '촬영'
                  : '촬영'}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#57534E]">
            <label className="inline-flex items-center gap-1 cursor-pointer hover:text-[#1C1917] min-h-[36px]">
              <Upload className="w-3.5 h-3.5" aria-hidden="true" />
              <span>사진 파일 올리기</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>

            {capturedFaceUrl && (
              <button
                type="button"
                onClick={() => setCapturedFaceUrl(null)}
                className="min-h-[36px] underline underline-offset-2 hover:text-[#1C1917]"
              >
                다시 찍기
              </button>
            )}

            {session.mode === 'demo' && !capturedFaceUrl && (
              <button
                type="button"
                disabled={generating}
                onClick={() => handleGeneratePastLife(true)}
                className="min-h-[36px] font-semibold text-[#1E3A8A] hover:underline"
              >
                [시연 모드] 사진 없이 전통 초상화 생성
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
