import { useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX, X } from 'lucide-react';

/** public/videos/mediawall.mp4 (프로젝트에 이 이름으로 영상을 넣으면 재생된다) */
export const MEDIA_WALL_VIDEO_SRC = '/videos/mediawall.mp4';

interface MediaWallVideoProps {
  /** X 버튼: 닫고 지도 탭으로 이동 */
  onClose: () => void;
}

/**
 * 박물관 미디어월 영상 화면. 열리자마자 자동 재생(loop, playsInline)하고,
 * 우측 상단 X 로 닫으면 전통 여지도가 있는 지도 탭으로 돌아간다.
 */
export function MediaWallVideo({ onClose }: MediaWallVideoProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [muted, setMuted] = useState(false);
  const [failed, setFailed] = useState(false);

  // 화면이 열려 있는 동안 뒤 화면 스크롤 잠금 + ESC 로 닫기
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // 자동 재생: 클릭으로 열렸으니 소리와 함께 시도하고, 브라우저가 막으면 음소거로 재생한다
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = false;
    el.play().then(
      () => setMuted(false),
      () => {
        el.muted = true;
        setMuted(true);
        void el.play().catch(() => {});
      },
    );
  }, []);

  const toggleMuted = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
    setMuted(el.muted);
    if (!el.muted) void el.play().catch(() => {});
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
            프로젝트의 public/videos/mediawall.mp4 파일을 확인해 주세요.
          </span>
        </p>
      ) : (
        <video
          ref={videoRef}
          src={MEDIA_WALL_VIDEO_SRC}
          autoPlay
          loop
          playsInline
          preload="auto"
          onError={() => setFailed(true)}
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
            <VolumeX className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Volume2 className="w-4 h-4" aria-hidden="true" />
          )}
          <span>{muted ? '소리 켜기' : '소리 끄기'}</span>
        </button>
      )}
    </div>
  );
}
