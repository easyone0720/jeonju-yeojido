import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import {
  ArrowLeft,
  Camera,
  Upload,
  AlertCircle,
  X,
  CheckCircle2,
  ImagePlus,
  Loader2,
} from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import { SPOT_QR_ALLOWLIST } from '../data/qrAllowlist';
import { AppMode, SpotId } from '../types/jeonju';
import { parseSpotQrPayload } from '../utils/pastLifeEngine';

interface SceneQrScanProps {
  expectedSpotId: SpotId;
  mode: AppMode;
  alreadyVerified?: boolean;
  collectedClueCount?: number;
  onBack: () => void;
  onQrVerified: (
    recognizedSpotId: SpotId,
    qrCodeValue: string,
    options?: { demoSimulated?: boolean }
  ) => Promise<void>;
}

const CAMERA_UNAVAILABLE_MSG =
  '카메라를 사용할 수 없습니다. 브라우저의 카메라 권한을 확인해 주세요.';
const QR_DECODE_FAIL_MSG = 'QR코드를 인식하지 못했습니다. 다시 시도해 주세요.';
const ALREADY_VERIFIED_MSG = '이미 방문 인증을 완료한 장소입니다.';
const MUSEUM_LOCKED_MSG =
  '전생 조각 4개를 모두 모은 후 국립전주박물관 QR 인증을 진행할 수 있습니다.';

function decodeQrFromImageElement(img: HTMLImageElement): string | null {
  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  if (!srcWidth || !srcHeight) return null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  const maxSide = Math.max(srcWidth, srcHeight);
  const candidateScales =
    maxSide > 1200 ? [1200 / maxSide, 640 / maxSide, 1] : [1, 0.75, 1.5];

  for (const scale of candidateScales) {
    const w = Math.max(64, Math.min(1600, Math.round(srcWidth * scale)));
    const h = Math.max(64, Math.min(1600, Math.round(srcHeight * scale)));
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (decoded?.data) {
      return decoded.data;
    }
  }

  return null;
}

export function SceneQrScan({
  expectedSpotId,
  mode,
  alreadyVerified = false,
  collectedClueCount = 0,
  onBack,
  onQrVerified,
}: SceneQrScanProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDecodeAtRef = useRef<number>(0);
  const recognizedLockRef = useRef<boolean>(false);

  const museumLocked = expectedSpotId === 'jeonju_museum' && collectedClueCount < 4;
  const scanBlocked = alreadyVerified || museumLocked;

  const [cameraState, setCameraState] = useState<'starting' | 'active' | 'unavailable'>(
    scanBlocked ? 'unavailable' : 'starting'
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatusText, setScanStatusText] = useState<string>(
    alreadyVerified
      ? ALREADY_VERIFIED_MSG
      : museumLocked
        ? MUSEUM_LOCKED_MSG
        : '카메라를 준비하고 있습니다...'
  );
  const [scanFeedback, setScanFeedback] = useState<string | null>(
    alreadyVerified ? ALREADY_VERIFIED_MSG : museumLocked ? MUSEUM_LOCKED_MSG : null
  );
  const [analyzingImage, setAnalyzingImage] = useState<boolean>(false);
  const [verifyingServer, setVerifyingServer] = useState<boolean>(false);

  const expectedSpot =
    JEONJU_SPOTS.find((s) => s.id === expectedSpotId) ?? JEONJU_SPOTS[0];

  const stopCamera = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // Ignore track stop errors
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const submitVerifiedQr = useCallback(
    async (
      spotId: SpotId,
      qrValue: string,
      options?: { demoSimulated?: boolean }
    ) => {
      recognizedLockRef.current = true;
      setVerifyingServer(true);
      setScanFeedback(null);
      setScanStatusText('QR코드가 확인되었습니다. 인증 기록을 저장하는 중...');
      stopCamera();

      try {
        await onQrVerified(spotId, qrValue, options);
      } catch (err) {
        recognizedLockRef.current = false;
        setVerifyingServer(false);
        const msg =
          err instanceof Error
            ? err.message
            : '인증 기록을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
        setScanFeedback(msg);
        setScanStatusText('인증을 완료하지 못했습니다. 안내를 확인해 주세요.');
      }
    },
    [onQrVerified, stopCamera]
  );

  // Shared QR validation path used identically by live camera frames AND image file uploads
  const handleDecodedQr = useCallback(
    (rawData: string) => {
      if (recognizedLockRef.current || verifyingServer) return;

      if (alreadyVerified) {
        setScanFeedback(ALREADY_VERIFIED_MSG);
        return;
      }
      if (museumLocked) {
        setScanFeedback(MUSEUM_LOCKED_MSG);
        return;
      }

      const parsed = parseSpotQrPayload(rawData, expectedSpotId);
      if (!parsed.valid || !parsed.spotId || !parsed.canonicalQrUrl) {
        setScanFeedback(
          parsed.error ?? '이 장소의 QR코드가 아닙니다. 다시 확인해 주세요.'
        );
        return;
      }

      void submitVerifiedQr(parsed.spotId, parsed.canonicalQrUrl);
    },
    [alreadyVerified, expectedSpotId, museumLocked, submitVerifiedQr, verifyingServer]
  );

  useEffect(() => {
    recognizedLockRef.current = false;

    if (alreadyVerified) {
      stopCamera();
      setCameraState('unavailable');
      setScanStatusText(ALREADY_VERIFIED_MSG);
      setScanFeedback(ALREADY_VERIFIED_MSG);
      return;
    }

    if (museumLocked) {
      stopCamera();
      setCameraState('unavailable');
      setScanStatusText(MUSEUM_LOCKED_MSG);
      setScanFeedback(MUSEUM_LOCKED_MSG);
      return;
    }

    let cancelled = false;

    const acquireCameraStream = async (): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch (err) {
        const errName = err instanceof Error ? err.name : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          throw err;
        }
        // Fallback for desktop webcams or browsers that reject facingMode constraints
        return navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    };

    const startCamera = async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        if (!cancelled) {
          setCameraState('unavailable');
          setCameraError(CAMERA_UNAVAILABLE_MSG);
          setScanStatusText('아래 사진 촬영 또는 QR 이미지 선택을 이용해 주세요.');
        }
        return;
      }

      try {
        const stream = await acquireCameraStream();

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if (cancelled) {
          stopCamera();
          return;
        }

        setCameraState('active');
        setCameraError(null);
        setScanStatusText('네모 안에 QR코드를 맞추면 자동으로 인식됩니다.');

        const scanFrame = (timestamp: number) => {
          if (cancelled || recognizedLockRef.current) return;

          if (timestamp - lastDecodeAtRef.current >= 140) {
            lastDecodeAtRef.current = timestamp;
            const video = videoRef.current;
            const canvas = canvasRef.current;
            if (video && canvas && video.readyState >= video.HAVE_CURRENT_DATA) {
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              if (vw > 0 && vh > 0) {
                const maxSide = 720;
                const scale = Math.min(1, maxSide / Math.max(vw, vh));
                canvas.width = Math.round(vw * scale);
                canvas.height = Math.round(vh * scale);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                if (ctx) {
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                  const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: 'attemptBoth',
                  });
                  if (code?.data) {
                    handleDecodedQr(code.data);
                    if (recognizedLockRef.current) return;
                  }
                }
              }
            }
          }

          rafRef.current = requestAnimationFrame(scanFrame);
        };

        rafRef.current = requestAnimationFrame(scanFrame);
      } catch {
        if (!cancelled) {
          stopCamera();
          setCameraState('unavailable');
          setCameraError(CAMERA_UNAVAILABLE_MSG);
          setScanStatusText('아래 사진 촬영 또는 QR 이미지 선택을 이용해 주세요.');
        }
      }
    };

    void startCamera();

    const handleVisibilityOrHide = () => {
      if (document.hidden) {
        stopCamera();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrHide);
    window.addEventListener('pagehide', stopCamera);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityOrHide);
      window.removeEventListener('pagehide', stopCamera);
      stopCamera();
    };
  }, [alreadyVerified, expectedSpotId, handleDecodedQr, museumLocked, stopCamera]);

  const handleCloseCamera = () => {
    stopCamera();
    onBack();
  };

  const handleCircleShutterClick = () => {
    if (verifyingServer || analyzingImage) return;

    if (alreadyVerified) {
      setScanFeedback(ALREADY_VERIFIED_MSG);
      return;
    }
    if (museumLocked) {
      setScanFeedback(MUSEUM_LOCKED_MSG);
      return;
    }

    if (cameraState === 'active' && videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth',
          });
          if (code?.data) {
            handleDecodedQr(code.data);
            return;
          }
        }
      }
    }

    if (mode === 'demo') {
      void submitVerifiedQr(expectedSpotId, SPOT_QR_ALLOWLIST[expectedSpotId], {
        demoSimulated: true,
      });
      return;
    }

    setScanFeedback(QR_DECODE_FAIL_MSG);
  };

  const handleUploadQrImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || verifyingServer) return;

    if (alreadyVerified) {
      setScanFeedback(ALREADY_VERIFIED_MSG);
      return;
    }
    if (museumLocked) {
      setScanFeedback(MUSEUM_LOCKED_MSG);
      return;
    }

    setAnalyzingImage(true);
    setScanFeedback(null);
    setScanStatusText('QR코드를 분석하는 중입니다...');

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const decodedText = decodeQrFromImageElement(img);
        if (decodedText) {
          handleDecodedQr(decodedText);
        } else {
          setScanFeedback(QR_DECODE_FAIL_MSG);
          setScanStatusText(
            cameraState === 'active'
              ? '네모 안에 QR코드를 맞추면 자동으로 인식됩니다.'
              : '아래 사진 촬영 또는 QR 이미지 선택을 이용해 주세요.'
          );
        }
      } finally {
        URL.revokeObjectURL(objectUrl);
        setAnalyzingImage(false);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setAnalyzingImage(false);
      setScanFeedback(QR_DECODE_FAIL_MSG);
    };

    img.src = objectUrl;
  };

  return (
    <div className="min-h-app hanji-texture text-[#1C1917] flex flex-col justify-between">
      {/* Top Bar with explicit Camera Close & Back trigger */}
      <header className="w-full px-4 h-14 flex items-center justify-between max-w-md mx-auto">
        <button
          type="button"
          onClick={handleCloseCamera}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1C1917] hover:text-[#9A3412] min-h-[44px]"
          aria-label="지도로 돌아가기"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>지도</span>
        </button>

        <span className="text-xs text-[#57534E] font-medium truncate px-2">
          {expectedSpot.name} {mode === 'demo' ? '· 시연 모드' : ''}
        </span>

        <button
          type="button"
          onClick={handleCloseCamera}
          aria-label="카메라 닫기"
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#57534E] hover:text-[#9A3412] min-h-[44px] px-2"
        >
          <X className="w-4 h-4" aria-hidden="true" />
          <span>카메라 닫기</span>
        </button>
      </header>

      <main className="flex-1 mx-auto w-full max-w-md px-5 py-3 flex flex-col items-center justify-between gap-4">
        <div className="w-full max-w-[330px] text-center space-y-1">
          <h1 className="font-serif-kr text-base sm:text-lg font-bold text-[#1C1917]">
            현장에 설치된 QR코드를 인식해 주세요.
          </h1>
          <p className="text-xs text-[#57534E]" aria-live="polite">
            {scanStatusText}
          </p>
        </div>

        {/* Center Corner-Bracket Scan Guide */}
        <div className="relative w-full max-w-[330px] aspect-[3/4] rounded-2xl overflow-hidden bg-[#1D1A16] flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            autoPlay
            muted
            className={`absolute inset-0 w-full h-full object-cover ${
              cameraState === 'active' ? 'block' : 'hidden'
            }`}
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Four Corner Bracket Square Reticle */}
          <div className="relative z-10 w-[82%] aspect-square flex flex-col items-center justify-center p-5 text-center">
            <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-[#FBF8F2]" aria-hidden="true" />
            <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-[#FBF8F2]" aria-hidden="true" />
            <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-[#FBF8F2]" aria-hidden="true" />
            <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-[#FBF8F2]" aria-hidden="true" />

            {verifyingServer ? (
              <div className="rounded-xl bg-black/75 px-4 py-3 text-[#FBF8F2] space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#FBF8F2]" aria-hidden="true" />
                <p className="text-xs font-semibold leading-relaxed">
                  인증 기록 저장 중...
                </p>
              </div>
            ) : alreadyVerified ? (
              <div className="rounded-xl bg-black/75 px-4 py-3 text-[#FBF8F2] space-y-2">
                <CheckCircle2 className="w-6 h-6 text-[#4ADE80] mx-auto" aria-hidden="true" />
                <p className="text-xs font-semibold leading-relaxed">
                  {ALREADY_VERIFIED_MSG}
                </p>
              </div>
            ) : museumLocked ? (
              <div className="rounded-xl bg-black/75 px-4 py-3 text-[#FDE68A] space-y-1.5">
                <p className="text-xs font-semibold leading-relaxed">
                  {MUSEUM_LOCKED_MSG}
                </p>
              </div>
            ) : (
              <>
                <p className="font-medium text-xs sm:text-sm text-[#FBF8F2] bg-black/55 px-3 py-1.5 rounded-lg">
                  {expectedSpot.name} 현장 QR 맞추기
                </p>
                {cameraState !== 'active' && cameraError && (
                  <p className="mt-3 text-xs text-[#FDE68A] bg-black/70 px-3 py-2.5 rounded-lg leading-relaxed">
                    {cameraError}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {scanFeedback && (
          <div
            role="alert"
            className="w-full max-w-[330px] rounded-xl border border-[#9A3412]/50 bg-[#FFF7ED] p-3 text-xs font-medium text-[#7C2D12] flex items-start gap-2 shadow-xs"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#9A3412]" aria-hidden="true" />
            <span className="leading-relaxed">{scanFeedback}</span>
          </div>
        )}

        {/* Capture / Upload & Demo Actions */}
        <div className="w-full max-w-[330px] flex flex-col items-center gap-3 pb-6 safe-pb">
          {!scanBlocked && (
            <>
              <button
                type="button"
                onClick={handleCircleShutterClick}
                disabled={analyzingImage || verifyingServer}
                aria-label={mode === 'demo' ? `${expectedSpot.name} 시연 QR 스캔` : '현재 화면 QR 스캔 시도'}
                className="w-16 h-16 rounded-full border-2 border-[#9A3412] bg-white/90 hover:bg-white active:scale-95 transition-all flex items-center justify-center shadow-md disabled:opacity-60"
              >
                <span className="w-12 h-12 rounded-full bg-[#9A3412] flex items-center justify-center text-white">
                  <Camera className="w-5 h-5" aria-hidden="true" />
                </span>
              </button>

              {mode === 'demo' && (
                <span className="text-xs text-[#9A3412] font-medium text-center">
                  시연 모드: 원형 버튼을 누르면 {expectedSpot.name} QR이 시연 인식됩니다
                </span>
              )}

              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <label className="min-h-[44px] px-3 py-2 rounded-xl border border-[#C7B596] bg-white hover:bg-[#F5EFE6] text-xs font-semibold text-[#1C1917] inline-flex items-center justify-center gap-1.5 cursor-pointer text-center">
                  <ImagePlus className="w-4 h-4 text-[#9A3412] shrink-0" aria-hidden="true" />
                  <span>사진 촬영 인식</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleUploadQrImage}
                    disabled={verifyingServer}
                    className="sr-only"
                    aria-label="카메라 사진 촬영으로 QR 인식"
                  />
                </label>

                <label className="min-h-[44px] px-3 py-2 rounded-xl border border-[#C7B596] bg-white hover:bg-[#F5EFE6] text-xs font-semibold text-[#1C1917] inline-flex items-center justify-center gap-1.5 cursor-pointer text-center">
                  <Upload className="w-4 h-4 text-[#9A3412] shrink-0" aria-hidden="true" />
                  <span>QR 이미지 선택</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadQrImage}
                    disabled={verifyingServer}
                    className="sr-only"
                    aria-label="QR 이미지 파일 업로드 인식"
                  />
                </label>
              </div>
            </>
          )}

          {scanBlocked && (
            <button
              type="button"
              onClick={handleCloseCamera}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-[#1C1917] text-white text-sm font-semibold"
            >
              지도로 돌아가기
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
