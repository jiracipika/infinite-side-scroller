import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { getDifficulty, type DifficultyConfig } from '@/game/difficulty';

/**
 * Characterization tests for the difficulty curve.
 *
 * These don't claim the tuning is optimal — they PIN it. The ramp is the
 * game's balance spine; if a future tuning pass changes any of these
 * numbers, the tests should fail loudly so the change is deliberate and
 * reviewed, not an accident.
 */

const KEYS: (keyof DifficultyConfig)[] = [
  'speedMult',
  'densityMult',
  'damageMult',
  'healthMult',
  'detectRangeMult',
  'shootCooldownMult',
];

describe('difficulty curve baseline', () => {
  it('starts at the documented baseline (density 0.4, everything else 1)', () => {
    const d = getDifficulty(0);
    assert.equal(d.speedMult, 1);
    assert.equal(d.densityMult, 0.4);
    assert.equal(d.damageMult, 1);
    assert.equal(d.healthMult, 1);
    assert.equal(d.detectRangeMult, 1);
    assert.equal(d.shootCooldownMult, 1);
  });

  it('pins the primary ramp completion at 12000px (speedMult 1.8)', () => {
    // Primary ramp: 0→1 over 12000px, speed gains t * 0.8.
    assert.equal(getDifficulty(12000).speedMult, 1.8);
    assert.equal(getDifficulty(6000).speedMult, 1.4);
  });

  it('primary ramp completes at 12000px regardless of extra scaling', () => {
    // Just past the primary boundary the extra ramp is ~0: values must be
    // continuous with the 12000px anchors (small extra, not a jump).
    const at = getDifficulty(12000);
    const justAfter = getDifficulty(12100);
    for (const k of KEYS) {
      const drift = Math.abs(Number(justAfter[k]) - Number(at[k]));
      assert.ok(drift < 0.01, `${k} is continuous at the ramp boundary`);
    }
  });
});

describe('difficulty curve shape', () => {
  it('offense/survival multipliers never decrease with distance', () => {
    let prev = getDifficulty(0);
    for (let x = 500; x <= 400000; x += 500) {
      const d = getDifficulty(x);
      assert.ok(d.speedMult >= prev.speedMult, `speedMult grows at ${x}`);
      assert.ok(d.densityMult >= prev.densityMult, `densityMult grows at ${x}`);
      assert.ok(d.damageMult >= prev.damageMult, `damageMult grows at ${x}`);
      assert.ok(d.healthMult >= prev.healthMult, `healthMult grows at ${x}`);
      assert.ok(d.detectRangeMult >= prev.detectRangeMult, `detectRangeMult grows at ${x}`);
      prev = d;
    }
  });

  it('shoot cooldown never increases (enemies only get more aggressive)', () => {
    let prev = getDifficulty(0).shootCooldownMult;
    for (let x = 500; x <= 400000; x += 500) {
      const d = getDifficulty(x).shootCooldownMult;
      assert.ok(d <= prev, `shootCooldownMult shrinks monotonically at ${x}`);
      prev = d;
    }
  });

  it('respects the documented shoot-cooldown floor of 0.25', () => {
    for (let x = 0; x <= 1000000; x += 10000) {
      assert.ok(
        getDifficulty(x).shootCooldownMult >= 0.25,
        `cooldown floor holds at ${x}`,
      );
    }
  });

  it('respects the documented density cap of 2.0', () => {
    for (let x = 0; x <= 1000000; x += 10000) {
      assert.ok(getDifficulty(x).densityMult <= 2.0, `density cap holds at ${x}`);
    }
  });

  it('is a pure function: same distance, same config', () => {
    const a = getDifficulty(31337);
    const b = getDifficulty(31337);
    assert.deepEqual(a, b);
  });

  it('handles negative distance without producing inverted values', () => {
    // Math.min/max already clamp the ramps; this pins that behavior.
    const d = getDifficulty(-5000);
    assert.equal(d.speedMult, 1);
    assert.equal(d.densityMult, 0.4);
  });
});
