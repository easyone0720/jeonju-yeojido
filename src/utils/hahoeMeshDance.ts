export interface MeshPoint {
  x: number;
  y: number;
}

function clamp01(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function rotateAround(
  x: number,
  y: number,
  px: number,
  py: number,
  angleRad: number
): MeshPoint {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = x - px;
  const dy = y - py;
  return {
    x: px + dx * cos - dy * sin,
    y: py + dx * sin + dy * cos,
  };
}

/**
 * Computes smooth, continuous 2D skeletal weights for the Hahoe character mesh.
 * Smooth weight falloffs prevent any polygon tearing or outline snapping at joints
 * while preserving independent motion for the head, left/right arms+fans, and legs.
 */
export function computeHahoePartWeights(u: number, v: number) {
  // Head + Jeongjagwan + mask + dangling hat straps (gakkkeun)
  const wHead =
    smoothstep(0.295, 0.335, u) *
    (1 - smoothstep(0.615, 0.655, u)) *
    (1 - smoothstep(0.325, 0.375, v));

  // Left arm + left fan + left white hanbok sleeve (contours above blue vest skirt)
  const leftArmCutoff = 0.52 - smoothstep(0.18, 0.34, u) * 0.085;
  const wLeftArm =
    (1 - smoothstep(0.295, 0.395, u)) *
    (1 - smoothstep(leftArmCutoff, leftArmCutoff + 0.09, v));

  // Right arm + right fan + right white hanbok sleeve (follows diagonal vest edge)
  const rightVestStart = 0.595 + smoothstep(0.41, 0.52, v) * 0.14;
  const wRightArm =
    smoothstep(rightVestStart, rightVestStart + 0.095, u) *
    (1 - smoothstep(0.505, 0.605, v));

  // Standing left leg & shoe
  const wLeftLeg =
    (1 - smoothstep(0.47, 0.505, u)) *
    smoothstep(0.555, 0.625, v);

  // Raised right leg & shoe
  const wRightLeg =
    smoothstep(0.48, 0.515, u) *
    smoothstep(0.53, 0.60, v);

  // Upper torso / shoulders subtle breathing squash
  const wTorso =
    smoothstep(0.33, 0.39, v) *
    (1 - smoothstep(0.54, 0.62, v));

  return { wHead, wLeftArm, wRightArm, wLeftLeg, wRightLeg, wTorso };
}

/**
 * Evaluates the deformed normalized UV -> screen-normalized XY coordinate
 * for a Hahoe character vertex at elapsed time `timeSec`.
 *
 * Uses continuous smooth weights + rigid sub-rotations on head & fans so:
 * - Ink outlines never tear or separate at seams
 * - Head, left/right arms+fans, torso, and legs dance rhythmically ('deongsil-deongsil')
 * - Character remains comfortably inside the circular border above the fixed emblem
 */
export function deformHahoeMeshVertex(
  u: number,
  v: number,
  timeSec: number
): MeshPoint {
  const TAU = Math.PI * 2;
  const phase3s = (timeSec / 3.0) * TAU;
  const phaseBounce = (timeSec / 1.5) * TAU;
  const phaseLeftArm = (timeSec / 2.4) * TAU;
  const phaseRightArm = ((timeSec + 0.9) / 2.7) * TAU;

  // Whole-body 'deongsil-deongsil' rhythm (left-right sway + knee-bend bounce)
  const swayX = Math.sin(phase3s) * 0.019;
  const bounceY =
    -Math.abs(Math.sin(phase3s)) * 0.011 -
    (0.5 - 0.5 * Math.cos(phaseBounce)) * 0.011;
  const bodyAngle = Math.sin(phase3s) * 0.058; // ~ +/-3.3 deg

  // Independent articulated rotations & offsets
  const headAngle = Math.sin(phase3s - 0.35) * 0.088; // ~ +/-5.0 deg
  const headBobY = Math.sin(phaseBounce) * 0.004;

  const leftArmAngle = Math.sin(phaseLeftArm) * 0.125; // ~ +/-7.2 deg
  const leftArmLiftY = -Math.sin(phaseLeftArm) * 0.008;

  const rightArmAngle = -Math.sin(phaseRightArm) * 0.125; // async timing vs left arm
  const rightArmLiftY = -Math.sin(phaseRightArm) * 0.008;

  const leftLegLift = (0.5 - 0.5 * Math.cos(phaseBounce)) * 0.011;
  const leftLegAngle = (0.5 - 0.5 * Math.cos(phaseBounce)) * 0.055;

  const rightLegPhase = phaseBounce - Math.PI;
  const rightLegLift = (0.5 - 0.5 * Math.cos(rightLegPhase)) * 0.015;
  const rightLegAngle = -(0.5 - 0.5 * Math.cos(rightLegPhase)) * 0.075;

  const torsoSquash = Math.sin(phaseBounce) * 0.004;

  const { wHead, wLeftArm, wRightArm, wLeftLeg, wRightLeg, wTorso } =
    computeHahoePartWeights(u, v);

  let x = u;
  let y = v;

  // 1. Subtle torso knee-bend compression
  y += wTorso * torsoSquash * ((0.5 - v) * 2.2);

  // 2. Head tilt around neck pivot (0.495, 0.345)
  if (wHead > 0.0001) {
    const r = rotateAround(x, y, 0.495, 0.345, headAngle * wHead);
    x = r.x;
    y = r.y + headBobY * wHead;
  }

  // 3. Left arm + fan swing around left shoulder (0.355, 0.365)
  if (wLeftArm > 0.0001) {
    const r = rotateAround(x, y, 0.355, 0.365, leftArmAngle * wLeftArm);
    x = r.x;
    y = r.y + leftArmLiftY * wLeftArm;
  }

  // 4. Right arm + fan swing around right shoulder (0.625, 0.365)
  if (wRightArm > 0.0001) {
    const r = rotateAround(x, y, 0.625, 0.365, rightArmAngle * wRightArm);
    x = r.x;
    y = r.y + rightArmLiftY * wRightArm;
  }

  // 5. Alternating foot steps
  if (wLeftLeg > 0.0001) {
    const r = rotateAround(x, y, 0.435, 0.56, leftLegAngle * wLeftLeg);
    x = r.x;
    y = r.y - leftLegLift * wLeftLeg;
  }

  if (wRightLeg > 0.0001) {
    const r = rotateAround(x, y, 0.545, 0.54, rightLegAngle * wRightLeg);
    x = r.x;
    y = r.y - rightLegLift * wRightLeg;
  }

  // 6. Whole-body rhythm sway around lower center of gravity (0.485, 0.72)
  const body = rotateAround(x, y, 0.485, 0.72, bodyAngle);
  return {
    x: body.x + swayX,
    y: body.y + bounceY,
  };
}
