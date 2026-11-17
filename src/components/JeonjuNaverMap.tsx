import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Compass,
  LocateFixed,
  MapPin,
  Pin,
  PinOff,
} from 'lucide-react';
import { JEONJU_SPOTS } from '../data/jeonjuSpots';
import type { SpotDefinition, SpotId, UserSessionState } from '../types/jeonju';
import {
  isSpotClueOrPastLifeCompleted,
  isSpotVisitVerified,
} from '../utils/pastLifeEngine';

interface NaverLatLng {
  lat(): number;
  lng(): number;
}

interface NaverLatLngBounds {
  extend(coord: NaverLatLng): void;
}

interface NaverMapInstance {
  setCenter(center: NaverLatLng): void;
  setZoom(zoom: number): void;
  fitBounds(bounds: NaverLatLngBounds, margin?: { top?: number; right?: number; bottom?: number; left?: number }): void;
}

interface NaverMarkerInstance {
  setMap(map: NaverMapInstance | null): void;
  setPosition(pos: NaverLatLng): void;
}

interface NaverInfoWindowInstance {
  open(map: NaverMapInstance, anchor: NaverMarkerInstance): void;
  close(): void;
  getMap(): NaverMapInstance | null;
}

interface NaverMapsNamespace {
  LatLng: new (lat: number, lng: number) => NaverLatLng;
  LatLngBounds: new (sw?: NaverLatLng, ne?: NaverLatLng) => NaverLatLngBounds;
  Point: new (x: number, y: number) => unknown;
  Map: new (
    el: HTMLElement,
    options: Record<string, unknown>
  ) => NaverMapInstance;
  Marker: new (options: Record<string, unknown>) => NaverMarkerInstance;
  InfoWindow: new (options: Record<string, unknown>) => NaverInfoWindowInstance;
  Position: {
    TOP_RIGHT: unknown;
  };
  Event: {
    addListener: (
      target: unknown,
      eventName: string,
      handler: (e?: { coord?: NaverLatLng }) => void
    ) => unknown;
    removeListener: (listener: unknown) => void;
    trigger: (target: unknown, eventName: string) => void;
    clearInstanceListeners: (target: unknown) => void;
  };
}

declare global {
  interface Window {
    naver?: {
      maps?: NaverMapsNamespace;
    };
    navermap_authFailure?: () => void;
  }
}

export type NaverMapLoadStatus =
  | 'checking'
  | 'missing_key'
  | 'loading'
  | 'ready'
  | 'auth_failed'
  | 'load_error';

interface JeonjuNaverMapProps {
  session: UserSessionState;
  selectedSpotId: SpotId;
  museumReady: boolean;
  onSelectSpot: (spotId: SpotId) => void;
  onOpenSpotDetail: (spotId: SpotId) => void;
  onStatusChange?: (status: NaverMapLoadStatus) => void;
}

const HANOK_VILLAGE_CENTER = { lat: 35.8142, lng: 127.1496 };

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildMarkerHtml(
  spot: SpotDefinition,
  options: {
    visited: boolean;
    stage2Done: boolean;
    selected: boolean;
    locked: boolean;
  }
): string {
  const isMuseum = spot.id === 'jeonju_museum';
  const badgeText = isMuseum ? '박' : String(spot.orderNumber);
  const bg = options.selected
    ? '#9A3412'
    : options.stage2Done
      ? '#16A34A'
      : options.visited
        ? '#B45309'
        : options.locked
          ? '#78716C'
          : '#1C1917';
  const ring = options.selected ? '#1C1917' : '#FBF8F2';
  const sealBadge = options.visited
    ? `<span style="position:absolute;top:-7px;right:-7px;width:18px;height:18px;border-radius:9999px;background:#B91C1C;color:#FFFFFF;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;border:1.5px solid #FBF8F2;">完</span>`
    : '';

  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;font-family:'Noto Sans KR',sans-serif;cursor:pointer;transform:translate(-50%,-100%);">
      <div style="position:relative;min-width:34px;height:34px;padding:0 8px;border-radius:9999px;background:${bg};color:#FFFFFF;border:2px solid ${ring};box-shadow:0 3px 8px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:13px;">
        ${escapeHtml(badgeText)}
        ${sealBadge}
      </div>
      <span style="padding:2px 7px;border-radius:6px;background:rgba(251,248,242,0.96);border:1px solid #8C7A62;color:#1C1917;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,0.16);">
        ${escapeHtml(spot.name)}
      </span>
    </div>
  `;
}

function buildInfoWindowHtml(
  spot: SpotDefinition,
  visited: boolean,
  stage2Done: boolean
): string {
  const statusLabel =
    spot.id === 'jeonju_museum'
      ? stage2Done
        ? '전생 완성 완료'
        : visited
          ? '방문 인증 완료'
          : '최종 목적지'
      : stage2Done
        ? '방문 인증 · 조각 획득 완료'
        : visited
          ? '방문 인증 완료'
          : '방문 인증 대기';
  const statusColor = stage2Done ? '#15803D' : visited ? '#9A3412' : '#44403C';

  return `
    <div style="min-width:200px;max-width:250px;padding:12px 14px;background:#FFFFFF;border-radius:12px;font-family:'Noto Sans KR',sans-serif;color:#1C1917;line-height:1.45;">
      <div style="font-size:11px;font-weight:700;color:${statusColor};margin-bottom:2px;">
        ${escapeHtml(statusLabel)}
      </div>
      <div style="font-size:15px;font-weight:800;color:#1C1917;">
        ${escapeHtml(spot.name)}
      </div>
      <div style="font-size:12px;color:#57534E;margin-top:3px;">
        ${escapeHtml(spot.address)}
      </div>
    </div>
  `;
}

export function JeonjuNaverMap({
  session,
  selectedSpotId,
  museumReady,
  onSelectSpot,
  onOpenSpotDetail,
  onStatusChange,
}: JeonjuNaverMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<NaverMapInstance | null>(null);
  const markersRef = useRef<Map<SpotId, NaverMarkerInstance>>(new Map());
  const infoWindowRef = useRef<NaverInfoWindowInstance | null>(null);
  const markerListenersRef = useRef<unknown[]>([]);
  const mapClickListenerRef = useRef<unknown | null>(null);
  const tempPinMarkerRef = useRef<NaverMarkerInstance | null>(null);

  const [status, setStatus] = useState<NaverMapLoadStatus>('checking');
  const [clientId, setClientId] = useState<string>('');
  const [pinMode, setPinMode] = useState<boolean>(false);
  const [tempPinCoords, setTempPinCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const updateStatus = useCallback(
    (next: NaverMapLoadStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange]
  );

  // 1. Resolve public NAVER Map Client ID from Vite env or safe backend config
  useEffect(() => {
    let cancelled = false;
    const envClientId =
      (import.meta.env?.VITE_NAVER_MAP_CLIENT_ID as string | undefined)?.trim() ?? '';

    if (envClientId) {
      setClientId(envClientId);
      updateStatus('loading');
      return;
    }

    fetch('/api/config/map')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { naverMapClientId?: string } | null) => {
        if (cancelled) return;
        const resolved = (data?.naverMapClientId ?? '').trim();
        if (resolved) {
          setClientId(resolved);
          updateStatus('loading');
        } else {
          updateStatus('missing_key');
        }
      })
      .catch(() => {
        if (!cancelled) {
          updateStatus('missing_key');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [updateStatus]);

  // 2. Load official NAVER Maps JS v3 SDK (oapi.map.naver.com with ncpKeyId)
  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    const prevAuthFailure = window.navermap_authFailure;
    window.navermap_authFailure = () => {
      if (!cancelled) {
        updateStatus('auth_failed');
      }
      prevAuthFailure?.();
    };

    const initializeIfReady = () => {
      if (cancelled) return;
      if (window.naver?.maps) {
        updateStatus('ready');
      }
    };

    if (window.naver?.maps) {
      updateStatus('ready');
      return () => {
        window.navermap_authFailure = prevAuthFailure;
      };
    }

    const scriptId = 'jeonsaeng-naver-maps-sdk';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener('load', initializeIfReady);
      existingScript.addEventListener('error', () => {
        if (!cancelled) updateStatus('load_error');
      });
      return () => {
        cancelled = true;
        window.navermap_authFailure = prevAuthFailure;
      };
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(
      clientId
    )}`;
    script.onload = initializeIfReady;
    script.onerror = () => {
      if (!cancelled) {
        updateStatus('load_error');
      }
    };
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      window.navermap_authFailure = prevAuthFailure;
    };
  }, [clientId, updateStatus]);

  // 3. Create & manage Map instance, ResizeObserver, markers, and cleanup
  useEffect(() => {
    if (status !== 'ready' || !mapContainerRef.current || !window.naver?.maps) {
      return;
    }

    const naverMaps = window.naver.maps;
    const map = new naverMaps.Map(mapContainerRef.current, {
      center: new naverMaps.LatLng(HANOK_VILLAGE_CENTER.lat, HANOK_VILLAGE_CENTER.lng),
      zoom: 15,
      minZoom: 11,
      maxZoom: 19,
      zoomControl: true,
      zoomControlOptions: {
        position: naverMaps.Position.TOP_RIGHT,
      },
      mapDataControl: false,
      scaleControl: true,
    });
    mapInstanceRef.current = map;

    const infoWindow = new naverMaps.InfoWindow({
      content: '',
      borderWidth: 1,
      borderColor: '#C7B596',
      backgroundColor: '#FFFFFF',
      disableAnchor: false,
      pixelOffset: new naverMaps.Point(0, -10),
    });
    infoWindowRef.current = infoWindow;

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (mapInstanceRef.current && window.naver?.maps) {
              window.naver.maps.Event.trigger(mapInstanceRef.current, 'resize');
            }
          })
        : null;
    resizeObserver?.observe(mapContainerRef.current);

    return () => {
      resizeObserver?.disconnect();
      markerListenersRef.current.forEach((listener) => {
        naverMaps.Event.removeListener(listener);
      });
      markerListenersRef.current = [];
      if (mapClickListenerRef.current) {
        naverMaps.Event.removeListener(mapClickListenerRef.current);
        mapClickListenerRef.current = null;
      }
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();
      tempPinMarkerRef.current?.setMap(null);
      tempPinMarkerRef.current = null;
      infoWindow.close();
      naverMaps.Event.clearInstanceListeners(map);
      mapInstanceRef.current = null;
      infoWindowRef.current = null;
    };
  }, [status]);

  // 4. Synchronize 5 Jeonju spot markers + InfoWindow cleanly whenever selection or progress changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const naverMaps = window.naver?.maps;
    const infoWindow = infoWindowRef.current;
    if (status !== 'ready' || !map || !naverMaps || !infoWindow) return;

    markerListenersRef.current.forEach((l) => naverMaps.Event.removeListener(l));
    markerListenersRef.current = [];
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current.clear();

    for (const spot of JEONJU_SPOTS) {
      const visited = isSpotVisitVerified(session, spot.id);
      const stage2Done = isSpotClueOrPastLifeCompleted(session, spot.id);
      const selected = spot.id === selectedSpotId;
      const locked = spot.id === 'jeonju_museum' && !museumReady;

      const marker = new naverMaps.Marker({
        position: new naverMaps.LatLng(spot.coordinates.lat, spot.coordinates.lng),
        map,
        title: spot.name,
        zIndex: selected ? 50 : visited ? 30 : 20,
        icon: {
          content: buildMarkerHtml(spot, { visited, stage2Done, selected, locked }),
          anchor: new naverMaps.Point(0, 0),
        },
      });

      const listener = naverMaps.Event.addListener(marker, 'click', () => {
        onSelectSpot(spot.id);
        onOpenSpotDetail(spot.id);
        infoWindow.open(map, marker);
        const contentEl = document.createElement('div');
        contentEl.innerHTML = buildInfoWindowHtml(spot, visited, stage2Done);
        const iw = infoWindow as unknown as { setContent?: (html: string) => void };
        iw.setContent?.(contentEl.innerHTML);
      });

      markerListenersRef.current.push(listener);
      markersRef.current.set(spot.id, marker);

      if (selected) {
        const iw = infoWindow as unknown as { setContent?: (html: string) => void };
        iw.setContent?.(buildInfoWindowHtml(spot, visited, stage2Done));
        infoWindow.open(map, marker);
        map.setCenter(new naverMaps.LatLng(spot.coordinates.lat, spot.coordinates.lng));
      }
    }
  }, [
    museumReady,
    onOpenSpotDetail,
    onSelectSpot,
    selectedSpotId,
    session,
    status,
  ]);

  // 5. Optional temporary user destination pin mode (client-only, zero DB side effects)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const naverMaps = window.naver?.maps;
    if (status !== 'ready' || !map || !naverMaps) return;

    if (mapClickListenerRef.current) {
      naverMaps.Event.removeListener(mapClickListenerRef.current);
      mapClickListenerRef.current = null;
    }

    if (!pinMode) return;

    mapClickListenerRef.current = naverMaps.Event.addListener(map, 'click', (e) => {
      if (!e?.coord) return;
      const lat = Number(e.coord.lat().toFixed(6));
      const lng = Number(e.coord.lng().toFixed(6));
      setTempPinCoords({ lat, lng });

      if (!tempPinMarkerRef.current) {
        tempPinMarkerRef.current = new naverMaps.Marker({
          position: e.coord,
          map,
          title: '임시 목적지 핀',
          zIndex: 45,
          icon: {
            content: `
              <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);font-family:'Noto Sans KR',sans-serif;">
                <span style="padding:2px 8px;border-radius:9999px;background:#1E3A8A;color:#FFFFFF;font-size:11px;font-weight:700;border:2px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.25);white-space:nowrap;">
                  임시 핀
                </span>
              </div>
            `,
            anchor: new naverMaps.Point(0, 0),
          },
        });
      } else {
        tempPinMarkerRef.current.setPosition(e.coord);
        tempPinMarkerRef.current.setMap(map);
      }
    });
  }, [pinMode, status]);

  const handleFitAllSpots = () => {
    const map = mapInstanceRef.current;
    const naverMaps = window.naver?.maps;
    if (!map || !naverMaps) return;
    const bounds = new naverMaps.LatLngBounds();
    for (const spot of JEONJU_SPOTS) {
      bounds.extend(new naverMaps.LatLng(spot.coordinates.lat, spot.coordinates.lng));
    }
    map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
  };

  const handleFocusHanokVillage = () => {
    const map = mapInstanceRef.current;
    const naverMaps = window.naver?.maps;
    if (!map || !naverMaps) return;
    map.setCenter(new naverMaps.LatLng(HANOK_VILLAGE_CENTER.lat, HANOK_VILLAGE_CENTER.lng));
    map.setZoom(15);
  };

  const handleClearTempPin = () => {
    tempPinMarkerRef.current?.setMap(null);
    tempPinMarkerRef.current = null;
    setTempPinCoords(null);
    setPinMode(false);
  };

  if (status === 'missing_key' || status === 'auth_failed' || status === 'load_error') {
    return (
      <div className="rounded-2xl border border-[#D6CEBE] bg-[#FBF8F2] p-5 space-y-3 text-left shadow-xs">
        <div className="flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h2 className="section-heading text-base font-bold text-[#1C1917]">
              {status === 'missing_key'
                ? '네이버 지도 연동 준비 중 (Client ID 미설정)'
                : status === 'auth_failed'
                  ? '네이버 지도 인증 도메인 확인 필요'
                  : '네이버 지도 SDK를 불러오지 못했습니다'}
            </h2>
            <p className="text-xs text-[#44403C] leading-relaxed">
              {status === 'missing_key'
                ? '실시간 네이버 지도를 표시하려면 네이버 클라우드 플랫폼(NCP) Maps Dynamic Map Client ID를 VITE_NAVER_MAP_CLIENT_ID 환경변수에 설정해 주세요. 현재는 전통 여지도와 외부 네이버·카카오·구글 길찾기를 바로 이용하실 수 있습니다.'
                : '네이버 클라우드 플랫폼 콘솔의 Web 서비스 URL에 현재 도메인이 등록되어 있는지 확인해 주세요.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Map Controls Row */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleFitAllSpots}
          disabled={status !== 'ready'}
          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D6CEBE] bg-white hover:bg-[#F5EFE6] text-xs font-semibold text-[#1C1917] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
        >
          <Compass className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
          <span>전체 관광 거점 보기</span>
        </button>

        <button
          type="button"
          onClick={handleFocusHanokVillage}
          disabled={status !== 'ready'}
          className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D6CEBE] bg-white hover:bg-[#F5EFE6] text-xs font-semibold text-[#1C1917] inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
        >
          <LocateFixed className="w-3.5 h-3.5 text-[#9A3412]" aria-hidden="true" />
          <span>한옥마을 중심</span>
        </button>

        <button
          type="button"
          onClick={() => setPinMode((prev) => !prev)}
          disabled={status !== 'ready'}
          aria-pressed={pinMode}
          className={`min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50 transition-colors ${
            pinMode
              ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white'
              : 'border-[#D6CEBE] bg-white hover:bg-[#F5EFE6] text-[#1C1917]'
          }`}
        >
          <Pin className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{pinMode ? '지도 터치로 핀 지정 중' : '임시 목적지 핀'}</span>
        </button>

        {tempPinCoords && (
          <button
            type="button"
            onClick={handleClearTempPin}
            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] hover:bg-[#EFE8DC] text-xs font-medium text-[#44403C] inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <PinOff className="w-3.5 h-3.5" aria-hidden="true" />
            <span>임시 핀 제거</span>
          </button>
        )}
      </div>

      {/* Interactive NAVER Map Canvas */}
      <div className="relative w-full aspect-[4/3] min-h-[340px] max-h-[580px] rounded-2xl border-2 border-[#A8967A] bg-[#EFE8DC] overflow-hidden shadow-md">
        <div
          ref={mapContainerRef}
          aria-label="전주 전생여지도 실시간 네이버 지도"
          className="w-full h-full min-h-[340px]"
        />
        {status !== 'ready' && (
          <div className="absolute inset-0 bg-[#FBF8F2]/90 flex flex-col items-center justify-center gap-2 text-xs text-[#44403C] p-4 text-center">
            <MapPin className="w-6 h-6 text-[#9A3412] animate-pulse" aria-hidden="true" />
            <span>네이버 지도를 불러오는 중입니다...</span>
          </div>
        )}
      </div>

      {tempPinCoords && (
        <p className="text-xs text-[#44403C]">
          임시 목적지 핀 위치: {tempPinCoords.lat}, {tempPinCoords.lng} (일시적인 길 안내 참고용이며 공식 QR 방문 인증에는 영향을 주지 않습니다)
        </p>
      )}
    </div>
  );
}
