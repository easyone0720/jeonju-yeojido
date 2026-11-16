import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Interactive Korean Norigae pendant (노리개) anchored to the top-right inner frame.
 * Users can grab & pull it with mouse or touch; releasing triggers damped pendulum spring physics.
 */
export function InteractiveNorigae() {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [renderState, setRenderState] = useState({
    angleDeg: 0,
    tasselLagDeg: 0,
    stretchPx: 0,
    dragging: false,
  });

  // Mutable physics state for 60fps requestAnimationFrame loop without stale closures
  const physRef = useRef({
    angle: 0, // radians
    vel: 0,
    tasselAngle: 0,
    tasselVel: 0,
    stretch: 0,
    stretchVel: 0,
    dragging: false,
    movedDuringDrag: false,
    rafId: 0,
    lastTs: 0,
  });

  const stopLoop = useCallback(() => {
    if (physRef.current.rafId) {
      cancelAnimationFrame(physRef.current.rafId);
      physRef.current.rafId = 0;
    }
  }, []);

  const stepPhysics = useCallback((now: number) => {
    const p = physRef.current;
    if (p.dragging) {
      p.rafId = 0;
      return;
    }

    const dt = p.lastTs ? Math.min((now - p.lastTs) / 1000, 0.032) : 0.016;
    p.lastTs = now;

    // Primary pendulum spring-damper
    const kMain = 28;
    const dampMain = 2.6;
    const acc = -kMain * p.angle - dampMain * p.vel;
    p.vel += acc * dt;
    p.angle += p.vel * dt;

    // Lower silk tassel lags behind main medallion with softer spring
    const kTassel = 36;
    const dampTassel = 4.2;
    const targetTassel = p.angle * 0.25 - p.vel * 0.045;
    const accTassel = kTassel * (targetTassel - p.tasselAngle) - dampTassel * p.tasselVel;
    p.tasselVel += accTassel * dt;
    p.tasselAngle += p.tasselVel * dt;

    // Cord stretch snap-back
    const accStretch = -140 * p.stretch - 14 * p.stretchVel;
    p.stretchVel += accStretch * dt;
    p.stretch += p.stretchVel * dt;

    const settled =
      Math.abs(p.angle) < 0.0015 &&
      Math.abs(p.vel) < 0.004 &&
      Math.abs(p.tasselAngle) < 0.0015 &&
      Math.abs(p.stretch) < 0.1;

    if (settled) {
      p.angle = 0;
      p.vel = 0;
      p.tasselAngle = 0;
      p.tasselVel = 0;
      p.stretch = 0;
      p.stretchVel = 0;
      p.rafId = 0;
      p.lastTs = 0;
      setRenderState({ angleDeg: 0, tasselLagDeg: 0, stretchPx: 0, dragging: false });
      return;
    }

    setRenderState({
      angleDeg: (p.angle * 180) / Math.PI,
      tasselLagDeg: (p.tasselAngle * 180) / Math.PI,
      stretchPx: p.stretch,
      dragging: false,
    });

    p.rafId = requestAnimationFrame(stepPhysics);
  }, []);

  const ensureLoop = useCallback(() => {
    const mediaReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mediaReduced) {
      physRef.current.angle = 0;
      physRef.current.vel = 0;
      physRef.current.tasselAngle = 0;
      physRef.current.stretch = 0;
      setRenderState({ angleDeg: 0, tasselLagDeg: 0, stretchPx: 0, dragging: false });
      return;
    }
    if (!physRef.current.rafId) {
      physRef.current.lastTs = 0;
      physRef.current.rafId = requestAnimationFrame(stepPhysics);
    }
  }, [stepPhysics]);

  useEffect(() => {
    return () => stopLoop();
  }, [stopLoop]);

  const updateAngleFromPointer = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const anchorX = rect.left + rect.width / 2;
    const anchorY = rect.top;

    const dx = clientX - anchorX;
    const dy = Math.max(36, clientY - anchorY);

    // Negative sign so pulling right swings pendant right (counter-clockwise in CSS? Wait: +angleDeg rotates clockwise, which moves bottom LEFT. So pulling RIGHT (+dx) needs NEGATIVE rotate angle!)
    const rawRad = -Math.atan2(dx, dy);
    const maxRad = (52 * Math.PI) / 180;
    const clampedRad = Math.max(-maxRad, Math.min(maxRad, rawRad));

    const dist = Math.hypot(dx, dy);
    const baseLen = rect.height * 0.72;
    const stretch = Math.max(0, Math.min(18, (dist - baseLen) * 0.14));

    const p = physRef.current;
    const prevAngle = p.angle;
    p.angle = clampedRad;
    p.vel = (clampedRad - prevAngle) * 18;
    p.stretch = stretch;
    p.tasselAngle = Math.max(-0.35, Math.min(0.35, -p.vel * 0.025));

    setRenderState({
      angleDeg: (clampedRad * 180) / Math.PI,
      tasselLagDeg: (p.tasselAngle * 180) / Math.PI,
      stretchPx: stretch,
      dragging: true,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    stopLoop();
    physRef.current.dragging = true;
    physRef.current.movedDuringDrag = false;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!physRef.current.dragging) return;
    physRef.current.movedDuringDrag = true;
    updateAngleFromPointer(e.clientX, e.clientY);
  };

  const handlePointerRelease = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!physRef.current.dragging) return;
    physRef.current.dragging = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    // Gentle click tap without drag gives a playful nudge
    if (!physRef.current.movedDuringDrag && Math.abs(physRef.current.angle) < 0.08) {
      physRef.current.vel = 2.1;
    }
    ensureLoop();
  };

  const handlePointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (physRef.current.dragging) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const enterFromLeft = e.clientX < rect.left + rect.width / 2;
    // Brush gently away from cursor side
    physRef.current.vel += enterFromLeft ? -0.95 : 0.95;
    ensureLoop();
  };

  return (
    <div
      ref={containerRef}
      role="slider"
      tabIndex={0}
      aria-label="전통 노리개 장식 (마우스나 손가락으로 잡고 흔들 수 있습니다)"
      aria-valuemin={-52}
      aria-valuemax={52}
      aria-valuenow={Math.round(renderState.angleDeg)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onPointerEnter={handlePointerEnter}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') {
          physRef.current.vel += 2.2;
          ensureLoop();
        } else if (e.key === 'ArrowRight') {
          physRef.current.vel -= 2.2;
          ensureLoop();
        }
      }}
      className={`pointer-events-auto touch-none select-none absolute top-12 sm:top-14 right-4 sm:right-11 lg:right-16 z-20 w-16 sm:w-20 lg:w-24 focus-visible:outline-none group ${
        renderState.dragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      title="잡고 흔들어 보세요"
    >
      <div
        style={{
          transform: `rotate(${renderState.angleDeg.toFixed(2)}deg)`,
          transformOrigin: '50% 0%',
        }}
        className="w-full"
      >
        <svg viewBox="0 0 110 265" className="w-full h-auto drop-shadow-xs overflow-visible" fill="none">
          {/* Top hanging silk cord (stretches subtly when pulled) */}
          <path
            d={`M55 0V${52 + renderState.stretchPx}`}
            stroke="#3B3A39"
            strokeWidth="3.2"
            strokeLinecap="round"
          />

          <g transform={`translate(0 ${renderState.stretchPx})`}>
            {/* Upper black Maedeup knot (국화매듭) */}
            <g stroke="#2F2E2D" strokeWidth="2.4" fill="none">
              <circle cx="55" cy="60" r="6" />
              <circle cx="46" cy="68" r="5" />
              <circle cx="64" cy="68" r="5" />
              <circle cx="55" cy="76" r="6" />
              <circle cx="55" cy="68" r="4" fill="#2F2E2D" />
            </g>

            {/* Embroidered round floral medallion (자수 원판) */}
            <circle cx="55" cy="100" r="18" fill="#FAF2E4" stroke="#8C6D4F" strokeWidth="1.6" />
            <circle cx="55" cy="100" r="14.5" fill="#2F3D4C" stroke="#D1BA93" strokeWidth="1" />
            <circle cx="55" cy="100" r="4.5" fill="#C85360" />
            <circle cx="55" cy="92.5" r="3" fill="#F0B7B3" />
            <circle cx="62" cy="97.5" r="3" fill="#F0B7B3" />
            <circle cx="59.5" cy="106" r="3" fill="#F0B7B3" />
            <circle cx="50.5" cy="106" r="3" fill="#F0B7B3" />
            <circle cx="48" cy="97.5" r="3" fill="#F0B7B3" />
            <ellipse cx="45" cy="102" rx="2.5" ry="1.4" fill="#7D9B76" />
            <ellipse cx="65" cy="102" rx="2.5" ry="1.4" fill="#7D9B76" />

            {/* Lower crimson bead & brass cap */}
            <circle cx="55" cy="123" r="4" fill="#B54935" />
            <rect x="44" y="128" width="22" height="5" rx="2" fill="#C79F56" />

            {/* Lower tri-color silk tassel with secondary pendulum lag */}
            <g
              transform={`rotate(${renderState.tasselLagDeg.toFixed(2)} 55 133)`}
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <path d="M46 133v78M48 133v80M50 133v81" stroke="#9E4246" />
              <path d="M53 133v82M55 133v83M57 133v82" stroke="#DCD2BC" />
              <path d="M60 133v81M62 133v80M64 133v77" stroke="#627868" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
