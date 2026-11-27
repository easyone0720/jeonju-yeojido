import { CHARACTERS, characterToStory, getCharacterById, resolveCharacterImage } from '../data/characters';
import { ArchetypeId, PastLifeResult } from '../types/jeonju';

interface AttireColors {
  robePrimary: string;
  robeSecondary: string;
  collar: string;
  hatColor: string;
  accentGold: string;
  sealLabel: string;
}

const ATTIRE_PALETTE: Record<ArchetypeId, AttireColors> = {
  royal_inspector: {
    robePrimary: '#1E3A5F',
    robeSecondary: '#162A45',
    collar: '#F5EFE6',
    hatColor: '#1C1917',
    accentGold: '#C59B43',
    sealLabel: '暗行御史',
  },
  gamyeong_official: {
    robePrimary: '#7C2D12',
    robeSecondary: '#5B1F0B',
    collar: '#FBF8F2',
    hatColor: '#292524',
    accentGold: '#D4AF37',
    sealLabel: '全羅官印',
  },
  woodblock_artisan: {
    robePrimary: '#4D5E4A',
    robeSecondary: '#374435',
    collar: '#EFE9DC',
    hatColor: '#44403C',
    accentGold: '#A16207',
    sealLabel: '完板刻手',
  },
  market_merchant: {
    robePrimary: '#6B4F3B',
    robeSecondary: '#4E3829',
    collar: '#F5EFE6',
    hatColor: '#8C6D46',
    accentGold: '#CA8A04',
    sealLabel: '全州巨商',
  },
  gate_guardian: {
    robePrimary: '#292524',
    robeSecondary: '#1C1917',
    collar: '#B91C1C',
    hatColor: '#1C1917',
    accentGold: '#D97706',
    sealLabel: '守門將印',
  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드에 실패했습니다.'));
    img.src = src;
  });
}

/**
 * 얼굴 사진을 Gemini 참조 이미지로 보내기 전에 줄이고 JPEG로 재인코딩한다.
 * (전송 용량 절감 + HEIC 등 비표준 포맷 정규화 + EXIF 위치 정보 제거: canvas를 거치면 메타데이터가 남지 않는다)
 */
export async function downscaleImageDataUrl(
  dataUrl: string,
  maxSide = 768,
  quality = 0.82
): Promise<string> {
  const img = await loadImage(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스 렌더링을 지원하지 않는 브라우저입니다.');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Synthesizes a traditional Korean Joseon-style portrait scroll painting on an HTML5 Canvas
 * by blending the user's face image (if provided) with ink-wash brushwork, Joseon attire,
 * traditional headgear, hanji paper texture, and a red seal stamp.
 * Raw user photo is never persisted—only the finished portrait artwork is returned.
 */
export async function synthesizeJoseonPortrait(params: {
  faceImageDataUrl: string | null;
  archetypeId: ArchetypeId;
  title: string;
  hanjaTitle: string;
  visitorName: string;
}): Promise<string> {
  const width = 720;
  const height = 960;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('캔버스 렌더링을 지원하지 않는 브라우저입니다.');
  }

  const palette = ATTIRE_PALETTE[params.archetypeId];

  // 1. Archival silk outer mounting (족자 비단 테두리)
  ctx.fillStyle = '#DED4C3';
  ctx.fillRect(0, 0, width, height);

  // Subtle woven silk lines
  ctx.strokeStyle = 'rgba(90, 72, 50, 0.08)';
  ctx.lineWidth = 1;
  for (let y = 0; y < height; y += 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Inner hanji canvas
  const padX = 44;
  const padY = 48;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const paperGrad = ctx.createLinearGradient(0, padY, 0, padY + innerH);
  paperGrad.addColorStop(0, '#F7F1E3');
  paperGrad.addColorStop(0.55, '#EFE5D0');
  paperGrad.addColorStop(1, '#E5D8BE');
  ctx.fillStyle = paperGrad;
  ctx.fillRect(padX, padY, innerW, innerH);

  // Double archival border
  ctx.strokeStyle = '#6B5A45';
  ctx.lineWidth = 3;
  ctx.strokeRect(padX, padY, innerW, innerH);
  ctx.strokeStyle = 'rgba(107, 90, 69, 0.45)';
  ctx.lineWidth = 1;
  ctx.strokeRect(padX + 10, padY + 10, innerW - 20, innerH - 20);

  // Subtle ink-wash mountain & bamboo silhouette behind figure
  ctx.save();
  ctx.beginPath();
  ctx.rect(padX + 12, padY + 12, innerW - 24, innerH - 24);
  ctx.clip();

  ctx.fillStyle = 'rgba(87, 83, 78, 0.07)';
  ctx.beginPath();
  ctx.moveTo(padX, padY + 420);
  ctx.quadraticCurveTo(padX + 190, padY + 290, padX + 350, padY + 370);
  ctx.quadraticCurveTo(padX + 510, padY + 260, padX + innerW, padY + 390);
  ctx.lineTo(padX + innerW, padY + innerH);
  ctx.lineTo(padX, padY + innerH);
  ctx.closePath();
  ctx.fill();

  // 2. Joseon Robe (도포 / 관복)
  const centerX = width / 2;
  const shoulderY = 510;

  // Shoulders & torso
  ctx.fillStyle = palette.robePrimary;
  ctx.beginPath();
  ctx.moveTo(centerX - 88, shoulderY);
  ctx.quadraticCurveTo(centerX - 245, shoulderY + 55, centerX - 280, padY + innerH);
  ctx.lineTo(centerX + 280, padY + innerH);
  ctx.quadraticCurveTo(centerX + 245, shoulderY + 55, centerX + 88, shoulderY);
  ctx.closePath();
  ctx.fill();

  // Shading folds
  ctx.fillStyle = palette.robeSecondary;
  ctx.beginPath();
  ctx.moveTo(centerX - 30, shoulderY + 130);
  ctx.lineTo(centerX - 180, padY + innerH);
  ctx.lineTo(centerX - 280, padY + innerH);
  ctx.quadraticCurveTo(centerX - 245, shoulderY + 55, centerX - 88, shoulderY);
  ctx.closePath();
  ctx.fill();

  // Traditional Dongjeong (동정 / V-collar)
  ctx.strokeStyle = palette.collar;
  ctx.lineWidth = 18;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(centerX - 68, shoulderY - 6);
  ctx.lineTo(centerX + 10, shoulderY + 150);
  ctx.lineTo(centerX + 70, shoulderY - 4);
  ctx.stroke();

  // Chest badge (흉배 for officials / woven sash for artisans)
  if (
    params.archetypeId === 'royal_inspector' ||
    params.archetypeId === 'gamyeong_official' ||
    params.archetypeId === 'gate_guardian'
  ) {
    ctx.fillStyle = '#1A2433';
    ctx.strokeStyle = palette.accentGold;
    ctx.lineWidth = 3;
    ctx.fillRect(centerX - 70, shoulderY + 175, 140, 128);
    ctx.strokeRect(centerX - 70, shoulderY + 175, 140, 128);

    // Crane / cloud geometric embroidery motif
    ctx.strokeStyle = palette.accentGold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, shoulderY + 238, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - 36, shoulderY + 252);
    ctx.quadraticCurveTo(centerX, shoulderY + 210, centerX + 36, shoulderY + 252);
    ctx.stroke();
  }

  // Neck
  ctx.fillStyle = '#DFC4A6';
  ctx.fillRect(centerX - 42, shoulderY - 70, 84, 95);

  // 3. Face Portrait Layer (user photo blended in warm archival ink tone OR fallback silhouette)
  const faceCenterY = 380;
  const faceRadiusX = 98;
  const faceRadiusY = 122;

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(centerX, faceCenterY, faceRadiusX, faceRadiusY, 0, 0, Math.PI * 2);
  ctx.clip();

  if (params.faceImageDataUrl) {
    try {
      const faceImg = await loadImage(params.faceImageDataUrl);
      // Cover-fit user face into oval
      const targetSize = 270;
      const aspect = faceImg.width / faceImg.height;
      let drawW = targetSize;
      let drawH = targetSize;
      if (aspect > 1) {
        drawW = targetSize * aspect;
      } else {
        drawH = targetSize / aspect;
      }
      ctx.filter = 'sepia(34%) contrast(106%) saturate(78%) brightness(102%)';
      ctx.drawImage(
        faceImg,
        centerX - drawW / 2,
        faceCenterY - drawH / 2,
        drawW,
        drawH
      );
      ctx.filter = 'none';

      // Warm hanji tint overlay to unify brushwork tone
      const faceWash = ctx.createRadialGradient(
        centerX,
        faceCenterY - 10,
        40,
        centerX,
        faceCenterY,
        130
      );
      faceWash.addColorStop(0, 'rgba(247, 241, 227, 0.08)');
      faceWash.addColorStop(1, 'rgba(138, 108, 72, 0.28)');
      ctx.fillStyle = faceWash;
      ctx.fillRect(centerX - 130, faceCenterY - 140, 260, 280);
    } catch {
      drawIllustratedJoseonFace(ctx, centerX, faceCenterY);
    }
  } else {
    drawIllustratedJoseonFace(ctx, centerX, faceCenterY);
  }
  ctx.restore();

  // Delicate ink outline around face oval
  ctx.strokeStyle = 'rgba(41, 37, 36, 0.55)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.ellipse(centerX, faceCenterY, faceRadiusX, faceRadiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  // 4. Traditional Headgear (사모 / 갓 / 패랭이 / 투구)
  drawHeadgear(ctx, centerX, faceCenterY - 105, params.archetypeId, palette);

  // 5. Archival Calligraphy Title & Red Vermilion Seal Stamp (낙관)
  ctx.fillStyle = '#292524';
  ctx.font = '600 28px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(params.hanjaTitle, padX + innerW - 32, padY + 62);

  ctx.fillStyle = '#57534E';
  ctx.font = '500 18px "Noto Sans KR", sans-serif';
  const aliasLine = params.visitorName.trim()
    ? `${params.visitorName.trim()} 肖像`
    : '前生 肖像畫';
  ctx.fillText(aliasLine, padX + innerW - 32, padY + 94);

  // Red seal stamp (낙관)
  const sealX = padX + innerW - 94;
  const sealY = padY + 114;
  ctx.fillStyle = '#9A3412';
  ctx.fillRect(sealX, sealY, 62, 62);
  ctx.strokeStyle = '#F7F1E3';
  ctx.lineWidth = 2;
  ctx.strokeRect(sealX + 4, sealY + 4, 54, 54);
  ctx.fillStyle = '#F7F1E3';
  ctx.font = '700 17px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(palette.sealLabel.slice(0, 2), sealX + 31, sealY + 27);
  ctx.fillText(palette.sealLabel.slice(2, 4), sealX + 31, sealY + 49);

  // Subtle hanji fiber flecks
  ctx.fillStyle = 'rgba(120, 96, 68, 0.08)';
  for (let i = 0; i < 160; i += 1) {
    const fx = padX + ((i * 97) % innerW);
    const fy = padY + ((i * 173) % innerH);
    ctx.fillRect(fx, fy, (i % 3) + 1, 1);
  }

  ctx.restore();
  return canvas.toDataURL('image/png');
}

function drawIllustratedJoseonFace(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number
) {
  const skinGrad = ctx.createRadialGradient(cx - 12, cy - 18, 20, cx, cy, 130);
  skinGrad.addColorStop(0, '#EDD7BE');
  skinGrad.addColorStop(0.7, '#E0C29F');
  skinGrad.addColorStop(1, '#CFA980');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(cx - 120, cy - 130, 240, 260);

  // Traditional ink-wash hairline & sideburns (구레나룻)
  ctx.fillStyle = 'rgba(41, 37, 36, 0.78)';
  ctx.beginPath();
  ctx.moveTo(cx - 98, cy - 90);
  ctx.quadraticCurveTo(cx - 82, cy - 45, cx - 84, cy + 16);
  ctx.lineTo(cx - 98, cy + 16);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx + 98, cy - 90);
  ctx.quadraticCurveTo(cx + 82, cy - 45, cx + 84, cy + 16);
  ctx.lineTo(cx + 98, cy + 16);
  ctx.closePath();
  ctx.fill();

  // Traditional Joseon portrait brow strokes
  ctx.strokeStyle = '#292524';
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 56, cy - 22);
  ctx.quadraticCurveTo(cx - 34, cy - 34, cx - 12, cy - 24);
  ctx.moveTo(cx + 12, cy - 24);
  ctx.quadraticCurveTo(cx + 34, cy - 34, cx + 56, cy - 22);
  ctx.stroke();

  // Almond-shaped Korean portrait eyes & subtle eyelid fold
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(41, 37, 36, 0.55)';
  ctx.beginPath();
  ctx.moveTo(cx - 50, cy - 9);
  ctx.quadraticCurveTo(cx - 33, cy - 18, cx - 16, cy - 8);
  ctx.moveTo(cx + 16, cy - 8);
  ctx.quadraticCurveTo(cx + 33, cy - 18, cx + 50, cy - 9);
  ctx.stroke();

  ctx.fillStyle = '#1C1917';
  ctx.beginPath();
  ctx.ellipse(cx - 33, cy - 6, 8, 3.6, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 33, cy - 6, 8, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Nose bridge & shading
  ctx.strokeStyle = 'rgba(92, 68, 40, 0.65)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(cx - 2, cy - 12);
  ctx.lineTo(cx - 4, cy + 24);
  ctx.quadraticCurveTo(cx, cy + 32, cx + 8, cy + 27);
  ctx.stroke();

  // Serene mouth & subtle philtrum
  ctx.strokeStyle = '#6B4436';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(cx - 19, cy + 56);
  ctx.quadraticCurveTo(cx, cy + 63, cx + 19, cy + 56);
  ctx.stroke();
}

function drawHeadgear(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  archetypeId: ArchetypeId,
  palette: AttireColors
) {
  ctx.save();
  if (archetypeId === 'royal_inspector' || archetypeId === 'gamyeong_official') {
    // Samo (사모 - Joseon official winged cap)
    ctx.fillStyle = palette.hatColor;
    // Wings
    ctx.beginPath();
    ctx.ellipse(cx - 118, topY + 26, 46, 18, -0.1, 0, Math.PI * 2);
    ctx.ellipse(cx + 118, topY + 26, 46, 18, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Crown
    ctx.beginPath();
    ctx.moveTo(cx - 88, topY + 42);
    ctx.lineTo(cx - 76, topY - 46);
    ctx.quadraticCurveTo(cx, topY - 72, cx + 76, topY - 46);
    ctx.lineTo(cx + 88, topY + 42);
    ctx.closePath();
    ctx.fill();
  } else if (archetypeId === 'gate_guardian') {
    // Jeonrip (전립 - military felt hat with red tassel)
    ctx.fillStyle = '#1C1917';
    ctx.beginPath();
    ctx.ellipse(cx, topY + 28, 165, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, topY + 18, 76, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#9A3412';
    ctx.fillRect(cx - 10, topY - 68, 20, 26);
  } else if (archetypeId === 'market_merchant') {
    // Paeraengi (패랭이 - woven bamboo wide hat)
    ctx.fillStyle = '#A88454';
    ctx.strokeStyle = '#6B4F3B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, topY + 26, 172, 32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 76, topY + 18);
    ctx.lineTo(cx - 38, topY - 54);
    ctx.lineTo(cx + 38, topY - 54);
    ctx.lineTo(cx + 76, topY + 18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Gat / Tanggeon (갓 - traditional scholar horsehair hat)
    ctx.fillStyle = 'rgba(28, 25, 23, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx, topY + 26, 174, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(cx - 62, topY - 68, 124, 92);
    ctx.strokeStyle = '#44403C';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - 62, topY - 68, 124, 92);
  }
  ctx.restore();
}

/** 캔버스 텍스트 줄바꿈 (글자 단위, 한국어용). 그린 마지막 줄의 다음 y 좌표를 돌려준다. */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
): number {
  let line = '';
  let lines = 0;
  let cursorY = y;
  const flush = () => {
    ctx.fillText(line, x, cursorY);
    cursorY += lineHeight;
    lines += 1;
  };
  for (const paragraph of text.split('\n')) {
    line = '';
    for (const ch of paragraph) {
      if (ctx.measureText(line + ch).width > maxWidth) {
        if (lines >= maxLines - 1) {
          line = `${line.slice(0, -1)}…`;
          flush();
          return cursorY;
        }
        flush();
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line) {
      if (lines >= maxLines) return cursorY;
      flush();
    }
  }
  return cursorY;
}

/**
 * Exports a complete archival record card PNG combining the portrait + job title + the 4-section story
 * (전생 설정 / 전생 결과 / 인생 마무리) so the user can download and keep their full result ("저장하기").
 */
export async function buildDownloadableResultCard(
  result: PastLifeResult,
  visitorName: string
): Promise<string> {
  const character = getCharacterById(result.characterId);
  const story = character ? characterToStory(character) : (result.story ?? characterToStory(CHARACTERS[0]));
  const width = 900;
  // 초상 영역을 16:9(780×439)로 두기 때문에 3:4(540×720)일 때보다 281px 낮다
  const height = 1419;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return result.portraitDataUrl;

  ctx.fillStyle = '#FBF8F2';
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = '#D6CEBE';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  // Header
  ctx.fillStyle = '#9A3412';
  ctx.font = '600 22px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('전생여지도 · 국립전주박물관 체험 기록', width / 2, 76);

  // Portrait (16:9)
  try {
    const portraitImg = await loadImage(resolveCharacterImage(result.characterId, result.portraitDataUrl));
    // 어떤 비율이든 16:9 칸에 cover 로 채우되, 인물 얼굴이 잘리지 않도록 위쪽을 기준으로 자른다
    const targetRatio = 780 / 439;
    const srcRatio = portraitImg.width / portraitImg.height;
    let sx = 0;
    let sy = 0;
    let sw = portraitImg.width;
    let sh = portraitImg.height;
    if (srcRatio < targetRatio) {
      sh = sw / targetRatio;
      sy = 0;
    } else {
      sw = sh * targetRatio;
      sx = (portraitImg.width - sw) / 2;
    }
    ctx.drawImage(portraitImg, sx, sy, sw, sh, 60, 108, 780, 439);
  } catch {
    ctx.fillStyle = '#EBE6DF';
    ctx.fillRect(60, 108, 780, 439);
  }

  // Title: [이름] 님의 전생 기록 + 직업
  ctx.fillStyle = '#78716C';
  ctx.font = '500 22px "Noto Sans KR", sans-serif';
  ctx.fillText(`${visitorName.trim() || '전주 나그네'} 님의 전생 기록`, width / 2, 593);

  ctx.fillStyle = '#1C1917';
  ctx.font = '700 42px "Noto Sans KR", sans-serif';
  const titleBottom = drawWrappedText(ctx, story.jobTitle, width / 2, 647, 760, 54, 2);

  // Divider
  let y = titleBottom + 6;
  ctx.strokeStyle = '#D6CEBE';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(110, y);
  ctx.lineTo(width - 110, y);
  ctx.stroke();
  y += 50;

  const startX = 110;
  const maxWidth = 680;
  ctx.textAlign = 'left';

  const drawSection = (label: string, body: string, maxLines: number) => {
    ctx.fillStyle = '#9A3412';
    ctx.font = '700 24px "Noto Sans KR", sans-serif';
    ctx.fillText(label, startX, y);
    y += 36;
    ctx.fillStyle = '#292524';
    ctx.font = '400 22px "Noto Sans KR", sans-serif';
    y = drawWrappedText(ctx, body, startX, y, maxWidth, 34, maxLines) + 18;
  };

  drawSection('전생 설정', story.setting, 4);
  drawSection(
    '전생 결과',
    `직업  ${story.outcome.job}\n평판  ${story.outcome.reputation}\n업적  ${story.outcome.achievement}`,
    6
  );
  drawSection('인생 마무리', story.ending, 4);

  // Footer disclaimer
  ctx.fillStyle = '#78716C';
  ctx.font = '400 16px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    '전주의 역사적 배경을 바탕으로 AI가 구성한 가상 체험 서사입니다 · 전생여지도',
    width / 2,
    height - 52
  );

  return canvas.toDataURL('image/png');
}

/** 외부(Storage) 이미지를 Blob 으로 받아 Canvas 가 오염되지 않게 불러온다. 실패하면 crossOrigin 방식으로 다시 시도한다 */
async function loadImageUntainted(src: string): Promise<HTMLImageElement> {
  try {
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await loadImage(objectUrl);
    } finally {
      // 그린 뒤에는 필요 없다 (img 는 이미 디코드됨)
      setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    }
  } catch {
    return loadImage(src);
  }
}

export interface AiResultCardInput {
  visitorName: string;
  title: string;
  imageUrl: string | null;
  categoryName?: string;
  job: string;
  reputation: string;
  achievement: string;
}

/**
 * AI 전생 결과 카드(PNG data URL): 초상화 + 전생 제목(칭호) + 핵심 결과 문구(직업·평판·업적).
 * 초상화가 없거나 불러오지 못하면 한지색 빈 칸으로 두고 나머지는 그대로 그린다.
 */
export async function buildAiResultCard(input: AiResultCardInput): Promise<string> {
  const width = 900;
  const portraitW = 405;
  const portraitH = 720; // 9:16
  const height = 1500;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('이미지를 만들 수 없는 환경입니다.');

  ctx.fillStyle = '#FBF8F2';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#D6CEBE';
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, width - 48, height - 48);

  ctx.fillStyle = '#9A3412';
  ctx.font = '600 22px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('전생여지도 · 국립전주박물관 체험 기록', width / 2, 76);

  const px = (width - portraitW) / 2;
  const py = 104;
  ctx.fillStyle = '#EFE6D4';
  ctx.fillRect(px, py, portraitW, portraitH);
  if (input.imageUrl) {
    try {
      const img = await loadImageUntainted(input.imageUrl);
      // 9:16 칸에 cover 로 채운다 (위쪽 기준으로 자른다)
      const target = portraitW / portraitH;
      const src = img.width / img.height;
      let sx = 0;
      let sy = 0;
      let sw = img.width;
      let sh = img.height;
      if (src > target) {
        sw = img.height * target;
        sx = (img.width - sw) / 2;
      } else {
        sh = img.width / target;
      }
      ctx.drawImage(img, sx, sy, sw, sh, px, py, portraitW, portraitH);
    } catch {
      // 초상화를 불러오지 못해도 카드는 만든다
    }
  }
  ctx.strokeStyle = '#C7B596';
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, portraitW, portraitH);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#78716C';
  ctx.font = '500 22px "Noto Sans KR", sans-serif';
  ctx.fillText(`${input.visitorName.trim() || '전주 나그네'} 님의 전생 기록${input.categoryName ? ` · ${input.categoryName}` : ''}`, width / 2, py + portraitH + 48);

  ctx.fillStyle = '#1C1917';
  ctx.font = '700 40px "Noto Sans KR", sans-serif';
  const titleBottom = drawWrappedText(ctx, input.title, width / 2, py + portraitH + 106, 760, 52, 2);

  let y = titleBottom + 8;
  ctx.strokeStyle = '#D6CEBE';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(110, y);
  ctx.lineTo(width - 110, y);
  ctx.stroke();
  y += 50;

  ctx.textAlign = 'left';
  const rows: Array<[string, string, number]> = [
    ['직업', input.job, 2],
    ['평판', input.reputation, 3],
    ['업적', input.achievement, 4],
  ];
  for (const [label, body, lines] of rows) {
    ctx.fillStyle = '#9A3412';
    ctx.font = '700 24px "Noto Sans KR", sans-serif';
    ctx.fillText(label, 110, y);
    y += 36;
    ctx.fillStyle = '#292524';
    ctx.font = '400 22px "Noto Sans KR", sans-serif';
    y = drawWrappedText(ctx, body, 110, y, 680, 34, lines) + 22;
  }

  ctx.fillStyle = '#78716C';
  ctx.font = '400 16px "Noto Sans KR", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('전주의 역사적 배경을 바탕으로 AI가 구성한 가상 체험 서사입니다 · 전생여지도', width / 2, height - 52);

  return canvas.toDataURL('image/png');
}
