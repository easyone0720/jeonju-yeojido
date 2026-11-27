import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

/** public/videos/mediawall.mp4 */
export const MEDIA_WALL_VIDEO_SRC = '/videos/mediawall.mp4';

interface MediaWallVideoProps {
  /** X 버튼: 닫고 지도 탭으로 이동 */
  onClose: () => void;
}

/**
 * 박물관 미디어월 영상 화면.
 *
 * - 소리 있는 자동 재생을 먼저 시도한다.
 * - 브라우저가 유음 자동 재생을 차단하면 음소거로 재시도한다.
 * - 사용자가 '소리 켜기'를 누르면 음소거를 해제하고 재생한다.
 * - X 버튼 또는 ESC 키로 닫는다.
 */
export function MediaWallVideo({ onClose }: MediaWallVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // 자동 재생 처리 도중 사용자가 변경한 설정을 덮어쓰지 않도록 한다.
  const userInteractedRef = useRef(false);

  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  // 화면이 열려 있는 동안 배경 스크롤 잠금 + ESC로 닫기
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // 유음 자동 재생 시도 → 정책상 차단된 경우에만 음소거 재시도
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    const startPlayback = async () => {
      // 사용자가 이미 버튼을 조작했다면 해당 설정을 유지한다.
      if (userInteractedRef.current) return;

      video.muted = false;

      try {
        await video.play();

        if (!cancelled) {
          setMuted(video.muted);
        }
      } catch (error) {
        if (cancelled || userInteractedRef.current) return;

        // 화면 닫기, 재생 중단 등으로 발생할 수 있는 오류
        if (
          error instanceof DOMException &&
          error.name === 'AbortError'
        ) {
          return;
        }

        // 자동 재생 차단이 아닌 오류는 별도로 확인한다.
        if (
          !(error instanceof DOMException) ||
          error.name !== 'NotAllowedError'
        ) {
          console.error('미디어월 재생 실패:', error);
          return;
        }

        console.info(
          '유음 자동 재생이 차단되어 음소거로 재생합니다.',
        );

        video.muted = true;
        setMuted(true);

        try {
          await video.play();
        } catch (fallbackError) {
          if (cancelled || userInteractedRef.current) return;

          if (
            fallbackError instanceof DOMException &&
            fallbackError.name === 'AbortError'
          ) {
            return;
          }

          console.error(
            '미디어월 음소거 자동 재생 실패:',
            fallbackError,
          );
        }
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
      video.pause();
    };
  }, []);

  // 사용자 클릭 안에서 음소거 변경 및 재생 요청
  const toggleMuted = () => {
    const video = videoRef.current;
    if (!video) return;

    userInteractedRef.current = true;

    const nextMuted = !video.muted;

    video.muted = nextMuted;

    if (!nextMuted) {
      // 음량이 0으로 설정되어 있는 경우도 함께 복구
      video.volume = 1;

      // 사용자 클릭 처리 중 즉시 재생을 요청한다.
      void video.play().catch((error) => {
        console.error(
          '미디어월 소리 켜기 후 재생 실패:',
          error,
        );
      });
    }

    setMuted(video.muted);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="박물관 미디어월 영상"
      className="fixed inset-0 z-50 bg-black flex items-center justify-center"
    >
      {failed ? (
        <p className="px-6 text-center text-sm text-white/80 leading-relaxed">
          미디어월 영상을 불러오지 못했습니다.
          <br />
          <span className="text-white/50 text-xs">
            프로젝트의 public/videos/mediawall.mp4 파일과
            브라우저에서 지원하는 영상 형식인지 확인해 주세요.
          </span>
        </p>
      ) : (
        <video
          controls
          ref={videoRef}
          src={MEDIA_WALL_VIDEO_SRC}
          onEnded={onClose}
          playsInline
          preload="auto"
          onVolumeChange={(event) => {
            // 실제 영상의 음소거 상태와 버튼 표시를 동기화
            setMuted(event.currentTarget.muted);
          }}
          onError={(event) => {
            console.error(
              '미디어월 파일 오류:',
              event.currentTarget.error,
            );

            setFailed(true);
          }}
          className="w-full h-full object-contain"
        />
      )}

      <button
        type="button"
        onClick={onClose}
        aria-label="미디어월 닫기"
        className="absolute top-4 right-4 z-50 w-11 h-11 flex items-center justify-center rounded-full bg-black/55 text-white border border-white/25 hover:bg-black/75 transition-colors"
      >
        <X className="w-6 h-6" aria-hidden="true" />
      </button>

      {!failed && (
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          className="absolute bottom-5 left-4 z-50 inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full bg-black/45 text-white/90 text-xs border border-white/20 hover:bg-black/65 transition-colors"
        >
          {muted ? (
            <VolumeX
              className="w-4 h-4"
              aria-hidden="true"
            />
          ) : (
            <Volume2
              className="w-4 h-4"
              aria-hidden="true"
            />
          )}

          <span>{muted ? '소리 켜기' : '소리 끄기'}</span>
        </button>
      )}
    </div>
  );
}
