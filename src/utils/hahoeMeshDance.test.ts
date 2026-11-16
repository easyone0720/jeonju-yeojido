import test from 'node:test';
import assert from 'node:assert/strict';
import { computeHahoePartWeights, deformHahoeMeshVertex } from './hahoeMeshDance';

test('deformHahoeMeshVertex returns finite bounded coordinates with zero tearing across joints', () => {
  const sampleTimes = [0, 0.45, 0.9, 1.5, 2.25, 3.0];

  for (const t of sampleTimes) {
    // Verify character boundary points never clip out of padded stage bounds
    const hatTop = deformHahoeMeshVertex(0.5, 0.02, t);
    const leftFanTip = deformHahoeMeshVertex(0.08, 0.2, t);
    const rightFanTip = deformHahoeMeshVertex(0.88, 0.32, t);
    const standingFoot = deformHahoeMeshVertex(0.43, 0.785, t);

    for (const pt of [hatTop, leftFanTip, rightFanTip, standingFoot]) {
      assert.equal(Number.isFinite(pt.x), true);
      assert.equal(Number.isFinite(pt.y), true);
      assert.ok(pt.x > 0.01 && pt.x < 0.99, `x out of bounds at t=${t}: ${pt.x}`);
      assert.ok(pt.y > -0.02 && pt.y < 0.805, `y out of bounds at t=${t}: ${pt.y}`);
    }

    // Verify continuity across neck, shoulder, and hip seams (no jump > 0.04 over deltaUV=0.02)
    const step = 0.02;
    for (let u = 0.1; u <= 0.9; u += 0.05) {
      for (let v = 0.1; v <= 0.75; v += 0.05) {
        const p0 = deformHahoeMeshVertex(u, v, t);
        const px = deformHahoeMeshVertex(u + step, v, t);
        const py = deformHahoeMeshVertex(u, v + step, t);
        const distX = Math.hypot(px.x - p0.x, px.y - p0.y);
        const distY = Math.hypot(py.x - p0.x, py.y - p0.y);
        assert.ok(distX < 0.035, `X seam tear at (${u},${v}, t=${t}): ${distX}`);
        assert.ok(distY < 0.035, `Y seam tear at (${u},${v}, t=${t}): ${distY}`);
      }
    }
  }
});

test('arms, head, and legs articulate independently with asynchronous left/right arm motion', () => {
  const weightsHead = computeHahoePartWeights(0.49, 0.18);
  const weightsLeftFan = computeHahoePartWeights(0.18, 0.22);
  const weightsRightFan = computeHahoePartWeights(0.8, 0.34);

  assert.ok(weightsHead.wHead > 0.95);
  assert.equal(weightsHead.wLeftArm, 0);
  assert.equal(weightsHead.wRightArm, 0);

  assert.ok(weightsLeftFan.wLeftArm > 0.95);
  assert.equal(weightsLeftFan.wHead, 0);

  assert.ok(weightsRightFan.wRightArm > 0.95);
  assert.equal(weightsRightFan.wHead, 0);

  // At t=0.6s, left and right fans have non-identical vertical displacement relative to t=0
  const l0 = deformHahoeMeshVertex(0.18, 0.22, 0);
  const l1 = deformHahoeMeshVertex(0.18, 0.22, 0.6);
  const r0 = deformHahoeMeshVertex(0.8, 0.34, 0);
  const r1 = deformHahoeMeshVertex(0.8, 0.34, 0.6);

  assert.notEqual((l1.y - l0.y).toFixed(4), (r1.y - r0.y).toFixed(4));
});
