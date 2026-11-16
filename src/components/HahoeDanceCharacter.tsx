import { useEffect, useRef, useState } from 'react';
import { Compass } from 'lucide-react';
import { deformHahoeMeshVertex } from '../utils/hahoeMeshDance';

interface HahoeDanceCharacterProps {
  src: string;
}

const GRID_COLS = 32;
const GRID_ROWS = 32;

const VERTEX_SHADER = `
  attribute vec2 aPosition;
  attribute vec2 aUv;
  varying vec2 vUv;
  void main() {
    vUv = aUv;
    gl_Position = vec4(aPosition.x * 2.0 - 1.0, 1.0 - aPosition.y * 2.0, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform sampler2D uTexture;
  varying vec2 vUv;
  void main() {
    if (vUv.y > 0.7895) discard;
    if (vUv.y > 0.735 && (vUv.x < 0.382 || vUv.x > 0.478)) discard;
    gl_FragColor = texture2D(uTexture, vUv);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HahoeDanceCharacter({ src }: HahoeDanceCharacterProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imgError, setImgError] = useState(false);
  const [useCssFallback, setUseCssFallback] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage || useCssFallback || imgError) return;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'default',
    });

    if (!gl) {
      setUseCssFallback(true);
      return;
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
    if (!vs || !fs) {
      setUseCssFallback(true);
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      setUseCssFallback(true);
      return;
    }
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setUseCssFallback(true);
      return;
    }

    const vertexCount = (GRID_COLS + 1) * (GRID_ROWS + 1);
    const uvs = new Float32Array(vertexCount * 2);
    const positions = new Float32Array(vertexCount * 2);

    let ptr = 0;
    for (let r = 0; r <= GRID_ROWS; r++) {
      const v = r / GRID_ROWS;
      for (let c = 0; c <= GRID_COLS; c++) {
        const u = c / GRID_COLS;
        uvs[ptr] = u;
        uvs[ptr + 1] = v;
        positions[ptr] = u;
        positions[ptr + 1] = v;
        ptr += 2;
      }
    }

    const indices = new Uint16Array(GRID_COLS * GRID_ROWS * 6);
    let iPtr = 0;
    const stride = GRID_COLS + 1;
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const tl = r * stride + c;
        const tr = tl + 1;
        const bl = tl + stride;
        const br = bl + 1;
        indices[iPtr++] = tl;
        indices[iPtr++] = bl;
        indices[iPtr++] = tr;
        indices[iPtr++] = tr;
        indices[iPtr++] = bl;
        indices[iPtr++] = br;
      }
    }

    const uvBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
    gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);

    const posBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);

    const idxBuf = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    const aUvLoc = gl.getAttribLocation(program, 'aUv');
    const aPosLoc = gl.getAttribLocation(program, 'aPosition');
    const uTexLoc = gl.getUniformLocation(program, 'uTexture');

    const texture = gl.createTexture();
    let textureReady = false;
    let cancelled = false;
    let rafId = 0;

    const syncCanvasSize = () => {
      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 2), 3);
      const nextW = Math.max(1, Math.round(rect.width * dpr));
      const nextH = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== nextW || canvas.height !== nextH) {
        canvas.width = nextW;
        canvas.height = nextH;
      }
    };

    const drawFrame = (elapsedSec: number) => {
      if (!textureReady || cancelled) return;
      syncCanvasSize();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      let p = 0;
      for (let r = 0; r <= GRID_ROWS; r++) {
        const v = r / GRID_ROWS;
        for (let c = 0; c <= GRID_COLS; c++) {
          const u = c / GRID_COLS;
          const pt = deformHahoeMeshVertex(u, v, elapsedSec);
          positions[p] = pt.x;
          positions[p + 1] = pt.y;
          p += 2;
        }
      }

      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf);
      gl.enableVertexAttribArray(aUvLoc);
      gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);
      gl.enableVertexAttribArray(aPosLoc);
      gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      if (uTexLoc) gl.uniform1i(uTexLoc, 0);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
      gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
    };

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let startTs = performance.now();

    const loop = (now: number) => {
      if (cancelled) return;
      if (!document.hidden && !mediaQuery.matches) {
        drawFrame((now - startTs) / 1000);
      }
      if (!mediaQuery.matches) {
        rafId = requestAnimationFrame(loop);
      }
    };

    const sprite = new Image();
    sprite.crossOrigin = 'anonymous';
    sprite.onload = () => {
      if (cancelled) return;
      // Downscale cleanly to 1024x1024 power-of-two canvas so WebGL1 can generate smooth trilinear mipmaps
      const texCanvas = document.createElement('canvas');
      texCanvas.width = 1024;
      texCanvas.height = 1024;
      const texCtx = texCanvas.getContext('2d');
      let texSource: TexImageSource = sprite;
      if (texCtx) {
        texCtx.imageSmoothingEnabled = true;
        texCtx.imageSmoothingQuality = 'high';
        texCtx.drawImage(sprite, 0, 0, 1024, 1024);
        texSource = texCanvas;
      }

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texSource);
      if (texSource === texCanvas) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      }

      textureReady = true;
      startTs = performance.now();
      drawFrame(0);
      if (!mediaQuery.matches) {
        rafId = requestAnimationFrame(loop);
      }
    };
    sprite.onerror = () => {
      if (!cancelled) setImgError(true);
    };
    sprite.src = src;

    const resizeObserver = new ResizeObserver(() => {
      if (textureReady && !cancelled) {
        drawFrame(mediaQuery.matches ? 0 : (performance.now() - startTs) / 1000);
      }
    });
    resizeObserver.observe(stage);

    const handleMotionChange = () => {
      cancelAnimationFrame(rafId);
      if (mediaQuery.matches) {
        drawFrame(0);
      } else if (textureReady) {
        startTs = performance.now();
        rafId = requestAnimationFrame(loop);
      }
    };
    mediaQuery.addEventListener('change', handleMotionChange);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      mediaQuery.removeEventListener('change', handleMotionChange);
      gl.deleteTexture(texture);
      gl.deleteBuffer(uvBuf);
      gl.deleteBuffer(posBuf);
      gl.deleteBuffer(idxBuf);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [src, useCssFallback, imgError]);

  if (imgError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-gradient-to-b from-[#F5EFE6] to-[#E5D8BE] rounded-full">
        <Compass className="w-10 h-10 text-[#9A3412] mb-2" aria-hidden="true" />
        <span className="font-serif-kr text-sm font-semibold text-[#1C1917]">전생여지도</span>
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      className="hahoe-dance-stage"
      data-anim-mode={useCssFallback ? 'fallback-css' : 'webgl-mesh'}
      role="img"
      aria-label="부채를 들고 덩실덩실 전통춤을 추는 전주 하회탈 캐릭터"
    >
      {/* Stationary bottom '전주 (Jeonju)' emblem & ground shadow */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="hahoe-layer hahoe-static-emblem"
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
      />
      <div className="hahoe-ground-shadow" aria-hidden="true" />

      {useCssFallback ? (
        <div className="hahoe-dance">
          <img
            src={src}
            alt=""
            aria-hidden="true"
            className="hahoe-layer hahoe-fallback-character"
            referrerPolicy="no-referrer"
          />
        </div>
      ) : (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="hahoe-layer pointer-events-none"
        />
      )}
    </div>
  );
}
