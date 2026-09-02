import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveMagnetFieldPose,
  resolveSpeedLinesPose,
  powerFxIntensity,
} from '@/game/rendering/power-fx';

describe('resolveMagnetFieldPose', () => {
  it('fills the actual pull radius (inner < mid < outer)', () => {
    const p = resolveMagnetFieldPose(150, 0);
    assert.ok(p.inner < p.mid);
    assert.ok(p.mid < p.ringRadius);
    assert.ok(p.inner > 0);
  });

  it('rings pulse over time (alpha and shimmer vary)', () => {
    const a = resolveMagnetFieldPose(150, 0);
    const b = resolveMagnetFieldPose(150, 0.3);
    const c = resolveMagnetFieldPose(150, 0.62);
    assert.notEqual(a.pulse, b.pulse);
    assert.notEqual(a.ringAlphas[0], b.ringAlphas[0]);
    // shimmer is sinusoidal: distinct phases give distinct offsets
    assert.notDeepEqual(a.ringShimmer, c.ringShimmer);
  });

  it('pulse is bounded 0..1 and shimmer bounded ±2px', () => {
    for (const t of [0, 0.11, 0.37, 0.5, 0.83]) {
      const p = resolveMagnetFieldPose(150, t);
      assert.ok(p.pulse >= 0 && p.pulse <= 1);
      for (const s of p.ringShimmer) {
        assert.ok(Math.abs(s) <= 2.01, `shimmer ${s} out of bounds`);
      }
      for (const al of p.ringAlphas) {
        assert.ok(al > 0 && al <= 0.2, `alpha ${al} outside subtle band`);
      }
    }
  });

  it('is deterministic: same inputs, same outputs (MP parity)', () => {
    const a = resolveMagnetFieldPose(160, 1.234);
    const b = resolveMagnetFieldPose(160, 1.234);
    assert.deepStrictEqual(a, b);
  });
});

describe('resolveSpeedLinesPose', () => {
  it('produces 4 streaks distributed vertically over the body', () => {
    const p = resolveSpeedLinesPose(24, 38, 0.5);
    assert.equal(p.streaks.length, 4);
    const ys = p.streaks.map(s => s.y);
    assert.ok(Math.min(...ys) > 0);
    assert.ok(Math.max(...ys) < 38);
    assert.ok(Math.min(...ys) < Math.max(...ys), 'lanes spread vertically');
  });

  it('streaks trail BEHIND the player (negative x offsets)', () => {
    const p = resolveSpeedLinesPose(24, 38, 0.3);
    for (const s of p.streaks) {
      assert.ok(s.x < 0, `streak x ${s.x} must be behind (negative)`);
    }
  });

  it('streak phases cycle: positions differ across time', () => {
    const a = resolveSpeedLinesPose(24, 38, 0);
    const b = resolveSpeedLinesPose(24, 38, 0.2);
    assert.notDeepEqual(a.streaks.map(s => s.x), b.streaks.map(s => s.x));
  });

  it('alpha peaks mid-cycle and never exceeds 0.5 (subtle)', () => {
    for (let t = 0; t < 1; t += 0.13) {
      const p = resolveSpeedLinesPose(24, 38, t);
      for (const s of p.streaks) {
        assert.ok(s.alpha >= 0 && s.alpha <= 0.5, `alpha ${s.alpha} too strong`);
      }
    }
  });

  it('is deterministic (MP parity)', () => {
    assert.deepStrictEqual(
      resolveSpeedLinesPose(24, 38, 0.77),
      resolveSpeedLinesPose(24, 38, 0.77),
    );
  });
});

describe('powerFxIntensity', () => {
  it('ramps 0→1 over the first 0.25s', () => {
    assert.equal(powerFxIntensity(6, 6), 0);
    assert.ok(powerFxIntensity(5.9, 6) > 0);
    assert.equal(powerFxIntensity(5.75, 6), 1);
  });

  it('ramps 1→0 over the final 0.4s', () => {
    assert.equal(powerFxIntensity(0.4, 6), 1);
    assert.ok(powerFxIntensity(0.2, 6) > 0 && powerFxIntensity(0.2, 6) < 1);
    assert.equal(powerFxIntensity(0, 6), 0);
  });

  it('never pops: always within 0..1', () => {
    for (let rem = 0; rem <= 6; rem += 0.17) {
      const v = powerFxIntensity(rem, 6);
      assert.ok(v >= 0 && v <= 1);
    }
  });
});
