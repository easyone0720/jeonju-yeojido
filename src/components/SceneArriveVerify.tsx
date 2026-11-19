import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  MapPin,
  RefreshCw,
  AlertTriangle,
  ScrollText,
} from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { SPOT_IMAGES } from '../data/spotImages';
import {
  ClueSpotId,
  GeoCoordinates,
  SpotId,
  UserSessionState,
} from '../types/jeonju';
import { verifySpotLocation } from '../utils/pastLifeEngine';
import { getAuthHeaders } from '../utils/storage';
import { CompleteSealStamp } from './CompleteSealStamp';
import { apiFetch } from '../utils/localApi';

interface SceneArriveVerifyProps {
  sessionId: string;
  spotId: SpotId;
  qrCodeValue: string | null;
  alreadyVisitVerified: boolean;
  alreadyCompleted: boolean;
  onBack: () => void;
  onSpotAuthenticated: (nextSession: UserSessionState, spotId: SpotId) => void;
  onClaimClueAndCoupon: (params: {
    spotId: ClueSpotId;
    coords: GeoCoordinates | null;
    spotPhotoCaptured: boolean;
    qrCodeValue: string | null;
  }) => Promise<void>;
  onProceedToMuseumFace: () => void;
}

export function SceneArriveVerify({
  sessionId,
  spotId,
  qrCodeValue,
  alreadyVisitVerified,
  alreadyCompleted,
  onBack,
  onSpotAuthenticated,
  onClaimClueAndCoupon,
  onProceedToMuseumFace,
}: SceneArriveVerifyProps) {
  const spot = JEONJU_SPOTS.find((s) => s.id === spotId) ?? JEONJU_SPOTS[0];
  const authStartedRef = useRef<boolean>(false);

  const [gpsStatus, setGpsStatus] = useState<'checking' | 'verified' | 'error'>('checking');
  const [coords, setCoords] = useState<GeoCoordinates | null>(null);
  const [gpsMessage, setGpsMessage] = useState<string>('위치 확인 중...');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);

  const [authStatus, setAuthStatus] = useState<
    'idle' | 'saving' | 'verified' | 'already' | 'error'
  >(alreadyVisitVerified ? 'already' : 'idle');
  const [authError, setAuthError] = useState<string | null>(null);
  const [justStampedHere, setJustStampedHere] = useState<boolean>(false);

  const [spotPhotoCaptured, setSpotPhotoCaptured] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  const persistVisitAuthentication = useCallback(
    async (verifiedCoords: GeoCoordinates | null) => {
      if (alreadyVisitVerified || authStartedRef.current) {
        return;
      }
      authStartedRef.current = true;
      setAuthStatus('saving');
      setAuthError(null);

      try {
        const res = await apiFetch(
          `/api/session/${encodeURIComponent(sessionId)}/verify-spot`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeaders('experience'),
            },
            credentials: 'same-origin',
            body: JSON.stringify({
              spotId,
              qrCodeValue,
              coords: verifiedCoords,
            }),
          }
        );

        const payload = (await res.json().catch(() => ({}))) as {
          session?: UserSessionState;
          alreadyVerified?: boolean;
          error?: string;
        };

        if (res.status === 409 && payload.alreadyVerified && payload.session) {
          setAuthStatus('already');
          setAuthError(payload.error || '이미 방문 인증을 완료한 장소입니다.');
          onSpotAuthenticated(payload.session, spotId);
          return;
        }

        if (!res.ok || !payload.session) {
          authStartedRef.current = false;
          setAuthStatus('error');
          setAuthError(
            payload.error ||
              '방문 인증 정보를 서버에 저장하지 못했습니다. 다시 시도해 주세요.'
          );
          return;
        }

        setAuthStatus('verified');
        setJustStampedHere(true);
        setAuthError(null);
        onSpotAuthenticated(payload.session, spotId);
      } catch {
        authStartedRef.current = false;
        setAuthStatus('error');
        setAuthError(
          '네트워크 오류로 방문 인증을 저장하지 못했습니다. 아래 버튼을 눌러 다시 시도해 주세요.'
        );
      }
    },
    [alreadyVisitVerified, onSpotAuthenticated, qrCodeValue, sessionId, spotId]
  );

  const runGpsCheck = useCallback(() => {
    setGpsStatus('checking');
    setSubmitError(null);
    setAuthError(null);
    authStartedRef.current = false;

    if (qrCodeValue || alreadyVisitVerified) {
      const virtualCoords = { lat: spot.coordinates.lat, lng: spot.coordinates.lng };
      setCoords(virtualCoords);
      setDistanceMeters(null);
      setGpsMessage('QR코드 현장 방문 인증이 확인되었습니다.');
      setGpsStatus('verified');
      if (!alreadyVisitVerified) {
        void persistVisitAuthentication(virtualCoords);
      } else {
        setAuthStatus('already');
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('error');
      setGpsMessage('이 브라우저는 GPS 위치 확인을 지원하지 않습니다.');
      return;
    }

    setGpsMessage(`${spot.name} 도착 여부를 확인하는 중입니다...`);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: GeoCoordinates = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setCoords(current);
        const check = verifySpotLocation(spotId, current, 'experience');
        setDistanceMeters(check.distanceMeters);
        setGpsMessage(check.reason);
        setGpsStatus(check.verified ? 'verified' : 'error');
        if (check.verified) {
          if (!alreadyVisitVerified) {
            void persistVisitAuthentication(current);
          } else {
            setAuthStatus('already');
          }
        }
      },
      (err) => {
        setGpsStatus('error');
        if (err.code === err.PERMISSION_DENIED) {
          setGpsMessage(
            '위치 권한이 거부되었습니다. 브라우저 위치 권한을 허용한 뒤 다시 시도해 주세요.'
          );
        } else {
          setGpsMessage('현재 위치를 가져오지 못했습니다. 위치 서비스를 켠 뒤 재시도해 주세요.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [alreadyVisitVerified, persistVisitAuthentication, spot.coordinates.lat, spot.coordinates.lng, spot.name, spotId]);

  const runGpsCheckRef = useRef(runGpsCheck);
  runGpsCheckRef.current = runGpsCheck;

  useEffect(() => {
    runGpsCheckRef.current();
  }, [spotId]);

  const handleSpotPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setSpotPhotoCaptured(true);
    }
    e.target.value = '';
  };

  const isVisitStamped =
    gpsStatus === 'verified' &&
    (alreadyVisitVerified || authStatus === 'verified' || authStatus === 'already');

  const handlePrimaryCta = async () => {
    if (!isVisitStamped) return;

    if (spotId === 'jeonju_museum') {
      onProceedToMuseumFace();
      return;
    }

    if (alreadyCompleted) {
      onBack();
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await onClaimClueAndCoupon({
        spotId: spotId as ClueSpotId,
        coords,
        spotPhotoCaptured,
        qrCodeValue,
      });
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : '조각 획득 처리 중 오류가 발생했습니다.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-app hanji-texture flex flex-col pb-44">
      <header className="sticky top-0 z-20 border-b border-[#E5DDD0] bg-[#FBF8F2]/95 backdrop-blur-md">
        <div className="mx-auto max-w-md sm:max-w-lg px-4 h-14 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-base font-semibold text-[#1C1917] hover:text-[#9A3412] min-h-[44px]"
          >
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            <span>
              {spotId === 'jeonju_museum'
                ? spot.name
                : `장소 ${spot.orderNumber} · ${spot.name}`}
            </span>
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md sm:max-w-lg px-4 py-5 flex flex-col justify-between gap-5 pb-24">
        <div className="space-y-4">
          {/* Top Status Box with Traditional Red '完' Seal Slam */}
          <section
            aria-label="도착 및 방문 인증 상태"
            className={`relative rounded-xl border px-4 py-3.5 flex items-center justify-between gap-3 ${
              isVisitStamped
                ? 'bg-white border-[#16A34A]/50 shadow-xs'
                : gpsStatus === 'error' || authStatus === 'error'
                  ? 'bg-white border-[#9A3412]/60'
                  : 'bg-white border-[#E5DDD0]'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              {isVisitStamped ? (
                <CheckCircle2
                  className="w-5 h-5 text-[#16A34A] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : gpsStatus === 'error' || authStatus === 'error' ? (
                <AlertTriangle
                  className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
              ) : (
                <MapPin className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" aria-hidden="true" />
              )}

              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-bold text-[#1C1917]">
                  {isVisitStamped
                    ? '✓ QR · 위치 방문 인증 완료'
                    : authStatus === 'saving'
                      ? '방문 인증 저장 중...'
                      : authStatus === 'error'
                        ? '방문 인증 저장 필요'
                        : gpsStatus === 'error'
                          ? '위치 확인 필요'
                          : '도착 여부 확인 중'}
                </p>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  {authError
                    ? authError
                    : `${gpsMessage}${distanceMeters !== null ? ` (약 ${distanceMeters.toLocaleString()}m)` : ''}`}
                </p>
                {isVisitStamped && (
                  <p className="text-[11px] font-semibold text-[#9A3412]">
                    {spotId === 'jeonju_museum'
                      ? '방문 인증 완료 · 이제 내 전생 결과를 확인해 주세요.'
                      : alreadyCompleted
                        ? '방문 인증 및 전생 조각 획득이 완료된 장소입니다.'
                        : '방문 인증 완료 · 아래에서 전생 조각과 쿠폰을 수령하세요.'}
                  </p>
                )}
              </div>
            </div>

            {isVisitStamped ? (
              <CompleteSealStamp
                animate={justStampedHere}
                size="md"
                label={`${spot.name} 방문 인증 완료 도장 (完)`}
              />
            ) : authStatus === 'error' ? (
              <button
                type="button"
                onClick={() => {
                  authStartedRef.current = false;
                  void persistVisitAuthentication(coords);
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#8E3524] text-[#FBF8F1] text-xs font-semibold inline-flex items-center gap-1 shrink-0"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>저장 재시도</span>
              </button>
            ) : (
              gpsStatus !== 'checking' && (
                <button
                  type="button"
                  onClick={runGpsCheck}
                  className="min-h-[36px] px-2.5 py-1 rounded-lg border border-[#D6CEBE] bg-[#FBF8F2] text-xs font-medium text-[#1C1917] inline-flex items-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" aria-hidden="true" />
                  <span>재확인</span>
                </button>
              )
            )}
          </section>

          {/* Center Place Photo & Story */}
          <section className="space-y-2.5">
            <h1 className="text-sm font-semibold text-[#57534E]">&lt;이곳의 이야기&gt;</h1>
            <article className="rounded-2xl border border-[#D6CEBE] bg-white overflow-hidden shadow-sm">
              <div className="aspect-video w-full bg-[#EFE8DC] overflow-hidden">
                {!imgError ? (
                  <img
                    src={SPOT_IMAGES[spot.id]}
                    alt={`${spot.name} 현장`}
                    className="w-full h-full object-cover object-top block"
                    referrerPolicy="no-referrer"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[#57534E]">
                    <ScrollText className="w-8 h-8" aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="p-5 space-y-3">
                <h2 className="font-serif-kr text-xl font-bold text-[#1C1917]">
                  {spot.name} ({spot.hanjaName})
                </h2>
                <p className="text-sm text-[#292524] leading-relaxed">
                  {spot.historicalStory}
                </p>
                <p className="text-xs text-[#9A3412] font-medium leading-relaxed pt-1 border-t border-[#F0EAE0]">
                  {spot.clueConnectionText}
                </p>

                {spotId !== 'jeonju_museum' && (
                  <div className="pt-1 flex items-center justify-between gap-2">
                    <label className="text-xs text-[#57534E] hover:text-[#1C1917] inline-flex items-center gap-1.5 cursor-pointer min-h-[36px]">
                      <Camera className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>
                        {spotPhotoCaptured
                          ? '현장 기념 사진 첨부됨 (서버 미저장)'
                          : '선택: 현장 기념 사진 남기기'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleSpotPhoto}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}
              </div>
            </article>
          </section>

          {submitError && (
            <div
              role="alert"
              className="rounded-xl border border-[#9A3412]/40 bg-[#8E3524]/10 px-4 py-3 text-xs font-medium text-[#7C2D12]"
            >
              {submitError}
            </div>
          )}
        </div>
      </main>

      {/* Bottom Sticky CTA */}
      <div className="fixed bottom-[4.75rem] left-0 right-0 z-30 border-t border-[#E5DDD0] bg-[#FBF8F2]/95 backdrop-blur-md p-3">
        <div className="mx-auto max-w-md sm:max-w-lg">
          <button
            type="button"
            disabled={!isVisitStamped || submitting}
            onClick={handlePrimaryCta}
            className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] disabled:bg-[#C7BDA9] disabled:cursor-not-allowed transition-colors"
          >
            {submitting
              ? '조각을 펼치는 중...'
              : spotId === 'jeonju_museum'
                ? '내 전생 결과 확인하기'
                : alreadyCompleted
                  ? '지도로 돌아가기'
                  : '조각 · 쿠폰 받기'}
          </button>
        </div>
      </div>
    </div>
  );
}
