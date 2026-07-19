import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_CYCLE_SECONDS,
  getDayPhase,
  getDayTint,
  getDayTintAtPhase,
  rgbaToString,
  type DayPhase,
} from '@/game/engine/day-cycle';

// ── Phase bucketing ─────────────────────────────────────────────────

describe('day-cycle phase boundaries', () => {
  it('returns dawn for the dawn window [0, 0.15)', () => {
    // phase 0 / cycle wrap
    assert.equal(getDayPhase(0), 'dawn');
    assert.equal(getDayPhase(0.5), 'dawn');
    // just before the day boundary
    assert.equal(getDayPhase(0.15 * DAY_CYCLE_SECONDS - 0.001), 'dawn');
  });

  it('returns day for [0.15, 0.50)', () => {
    assert.equal(getDayPhase(0.15 * DAY_CYCLE_SECONDS), 'day');
    assert.equal(getDayPhase(0.3 * DAY_CYCLE_SECONDS), 'day');
    assert.equal(getDayPhase(0.5 * DAY_CYCLE_SECONDS - 0.001), 'day');
  });

  it('returns dusk for [0.50, 0.65)', () => {
    assert.equal(getDayPhase(0.5 * DAY_CYCLE_SECONDS), 'dusk');
    assert.equal(getDayPhase(0.6 * DAY_CYCLE_SECONDS), 'dusk');
    assert.equal(getDayPhase(0.65 * DAY_CYCLE_SECONDS - 0.001), 'dusk');
  });

  it('returns night for [0.65, 1.00)', () => {
    assert.equal(getDayPhase(0.65 * DAY_CYCLE_SECONDS), 'night');
    assert.equal(getDayPhase(0.9 * DAY_CYCLE_SECONDS), 'night');
    assert.equal(getDayPhase(DAY_CYCLE_SECONDS - 0.001), 'night');
  });

  it('wraps modulo the cycle length (time beyond one cycle)', () => {
    const phases: DayPhase[] = [];
    for (let i = 0; i < 4; i++) {
      phases.push(getDayPhase(i * DAY_CYCLE_SECONDS + 0.001));
    }
    // Every full-cycle echo of t≈0 should be dawn.
    assert.deepEqual(phases, ['dawn', 'dawn', 'dawn', 'dawn']);
  });
});

// ── Continuous tint ─────────────────────────────────────────────────

describe('day-cycle continuous tint', () => {
  it('preserves the peak night tint at the cycle wrap (phase 0 / phase 1)', () => {
    const at0 = getDayTintAtPhase(0);
    const at1 = getDayTintAtPhase(1);
    // 0 and 1 must resolve to the same tint → no visible seam at the wrap.
    assert.ok(Math.abs(at0.r - at1.r) < 0.01);
    assert.ok(Math.abs(at0.g - at1.g) < 0.01);
    assert.ok(Math.abs(at0.b - at1.b) < 0.01);
    assert.ok(Math.abs(at0.a - at1.a) < 0.001);
    // And it must equal the canonical night peak.
    assert.ok(Math.abs(at0.a - 0.38) < 0.01, `night alpha ~0.38, got ${at0.a}`);
  });

  it('hits the canonical dusk peak exactly at the dusk keyframe', () => {
    const dusk = getDayTintAtPhase(0.575);
    assert.equal(Math.round(dusk.r), 60);
    assert.equal(Math.round(dusk.g), 30);
    assert.equal(Math.round(dusk.b), 10);
    assert.ok(Math.abs(dusk.a - 0.18) < 0.001, `dusk alpha ~0.18, got ${dusk.a}`);
  });

  it('hits the canonical dawn peak exactly at the dawn keyframe', () => {
    const dawn = getDayTintAtPhase(0.075);
    assert.equal(Math.round(dawn.r), 80);
    assert.equal(Math.round(dawn.g), 50);
    assert.equal(Math.round(dawn.b), 20);
    assert.ok(Math.abs(dawn.a - 0.12) < 0.001, `dawn alpha ~0.12, got ${dawn.a}`);
  });

  it('has alpha 0 across the day plateau [0.20, 0.45]', () => {
    for (const p of [0.2, 0.25, 0.3, 0.4, 0.45]) {
      const t = getDayTintAtPhase(p);
      assert.ok(t.a < 0.001, `day plateau at p=${p} must be alpha 0, got ${t.a}`);
    }
  });

  it('is monotonically increasing in alpha across the dusk ramp', () => {
    // Sample from end of day plateau through dusk peak to start of night.
    let prev = -1;
    const samples = [0.45, 0.48, 0.51, 0.575, 0.6, 0.65, 0.7];
    for (const p of samples) {
      const a = getDayTintAtPhase(p).a;
      assert.ok(a >= prev - 1e-9, `alpha not monotonic at p=${p}: ${a} < ${prev}`);
      prev = a;
    }
  });

  it('is continuous — adjacent samples never jump by more than a small delta', () => {
    // The whole point of this module: the old step overlay jumped by ~0.18 or
    // ~0.38 alpha at each phase boundary. Verify nothing close happens now.
    const STEP = 0.0025; // ~0.3s of game time
    let maxJump = 0;
    for (let p = 0; p < 1; p += STEP) {
      const a = getDayTintAtPhase(p).a;
      const b = getDayTintAtPhase(p + STEP).a;
      maxJump = Math.max(maxJump, Math.abs(a - b));
    }
    // 0.02 = roughly 1/10th of the largest old step jump. The smoothstep
    // keyframe distances used here produce max deltas well under this.
    assert.ok(maxJump < 0.02, `max tint alpha jump ${maxJump} exceeds continuity budget`);
  });

  it('interpolates colour channels, not just alpha', () => {
    // Halfway between dawn (r=80) and day (r=0) should be between them.
    const half = getDayTintAtPhase((0.075 + 0.2) / 2);
    assert.ok(half.r > 0 && half.r < 80, `midpoint r=${half.r} should sit between 0 and 80`);
    assert.ok(half.r < 80 && half.r > 0, 'midpoint must be strictly interior');
  });
});

// ── rgbaToString ────────────────────────────────────────────────────

describe('rgbaToString formatting', () => {
  it('formats a known tint correctly', () => {
    assert.equal(rgbaToString({ r: 10, g: 14, b: 40, a: 0.38 }), 'rgba(10, 14, 40, 0.38)');
  });

  it('rounds near-zero alpha to exactly 0 so renderers can short-circuit', () => {
    assert.equal(rgbaToString({ r: 0, g: 0, b: 0, a: 0.0001 }), 'rgba(0, 0, 0, 0)');
    assert.equal(rgbaToString({ r: 0, g: 0, b: 0, a: 0 }), 'rgba(0, 0, 0, 0)');
  });

  it('clamps alpha above 1', () => {
    const s = rgbaToString({ r: 5, g: 5, b: 5, a: 2 });
    assert.equal(s, 'rgba(5, 5, 5, 1)');
  });
});

// ── getDayTint (time-based entrypoint) ──────────────────────────────

describe('getDayTint time-based entrypoint', () => {
  it('matches getDayTintAtPhase for the equivalent phase', () => {
    const time = 30; // 30s into a 120s cycle → phase 0.25
    const phase = (time % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
    const a = getDayTint(time);
    const b = getDayTintAtPhase(phase);
    assert.deepEqual(a, b);
  });

  it('wraps modulo the cycle (time > DAY_CYCLE_SECONDS)', () => {
    const t1 = getDayTint(5);
    const t2 = getDayTint(5 + DAY_CYCLE_SECONDS);
    const t3 = getDayTint(5 + 7 * DAY_CYCLE_SECONDS);
    assert.deepEqual(t1, t2);
    assert.deepEqual(t1, t3);
  });
});
