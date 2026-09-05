import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  DAY_CYCLE_SECONDS,
} from '@/game/engine/day-cycle';
import {
  getSkyCycle,
  resolveCelestialAlphas,
  SUN_ARC_START,
  SUN_ARC_LENGTH,
  MOON_ARC_START,
  MOON_ARC_LENGTH,
} from '@/game/rendering/background';

const at = (phase: number) => phase * DAY_CYCLE_SECONDS;

// ── Arc constants stay in sync with the painters ─────────────────────

describe('celestial arc constants', () => {
  it('sun and moon arcs share the same arc length (0.625)', () => {
    assert.equal(SUN_ARC_LENGTH, 0.625);
    assert.equal(MOON_ARC_LENGTH, 0.625);
  });

  it('arc starts match the documented painter windows', () => {
    assert.equal(SUN_ARC_START, 0.075);
    assert.equal(MOON_ARC_START, 0.575);
  });
});

// ── resolveCelestialAlphas: single-body hand-off ─────────────────────

describe('resolveCelestialAlphas', () => {
  it('sun fully visible at midday, moon fully gone', () => {
    const a = resolveCelestialAlphas(at(0.3));
    assert.equal(a.sunAlpha, 1);
    assert.equal(a.moonAlpha, 0);
  });

  it('moon fully visible at deep night, sun fully gone', () => {
    const a = resolveCelestialAlphas(at(0.9));
    assert.equal(a.moonAlpha, 1);
    assert.equal(a.sunAlpha, 0);
  });

  it('deep night shows only the moon (sun set after dusk)', () => {
    const a = resolveCelestialAlphas(at(0.76));
    assert.equal(a.sunAlpha, 0, 'sun must be below horizon after dusk');
    assert.equal(a.moonAlpha, 1, 'moon rides the deep-night sky');
  });

  it('late day shows only the sun (moon has set at dawn, next moonrise at dusk)', () => {
    const a = resolveCelestialAlphas(at(0.55));
    assert.equal(a.sunAlpha, 1);
    assert.equal(a.moonAlpha, 0, 'moon must be below horizon before moonrise');
  });

  it('never renders both bodies at full strength (the documented both-celestial-bodies bug)', () => {
    for (let p = 0; p < 1; p += 0.005) {
      const a = resolveCelestialAlphas(at(p));
      const combined = a.sunAlpha + a.moonAlpha;
      assert.ok(
        combined <= 1.0001,
        `phase ${p.toFixed(3)}: sun ${a.sunAlpha.toFixed(3)} + moon ${a.moonAlpha.toFixed(3)} > 1`,
      );
    }
  });

  it('hands over smoothly at dawn: moon fades out as sun fades in', () => {
    // Across the dawn window the moon alpha must be monotonically
    // non-increasing while the sun alpha rises.
    let prevMoon = 1;
    for (let p = 0.075; p <= 0.2; p += 0.01) {
      const a = resolveCelestialAlphas(at(p));
      assert.ok(a.moonAlpha <= prevMoon + 1e-9, `moon rose again at phase ${p}`);
      assert.ok(a.sunAlpha >= 0 && a.sunAlpha <= 1);
      prevMoon = a.moonAlpha;
    }
  });

  it('hands over smoothly at dusk: sun fades out as moon fades in', () => {
    let prevSun = 1;
    for (let p = 0.575; p <= 0.7; p += 0.01) {
      const a = resolveCelestialAlphas(at(p));
      assert.ok(a.sunAlpha <= prevSun + 1e-9, `sun rose again at phase ${p}`);
      assert.ok(a.moonAlpha >= 0 && a.moonAlpha <= 1);
      prevSun = a.sunAlpha;
    }
  });

  it('alphas stay in [0,1] for the whole cycle', () => {
    for (let p = 0; p < 1; p += 0.001) {
      const a = resolveCelestialAlphas(at(p));
      assert.ok(a.sunAlpha >= 0 && a.sunAlpha <= 1, `sun ${a.sunAlpha} at ${p}`);
      assert.ok(a.moonAlpha >= 0 && a.moonAlpha <= 1, `moon ${a.moonAlpha} at ${p}`);
    }
  });

  it('is continuous across the cycle wrap (phase 0 ≈ phase 1)', () => {
    const a0 = resolveCelestialAlphas(0);
    const a1 = resolveCelestialAlphas(DAY_CYCLE_SECONDS - 0.5);
    assert.ok(Math.abs(a0.moonAlpha - a1.moonAlpha) < 0.02, 'moon must not pop at the wrap');
    assert.ok(a0.sunAlpha === 0 && a1.sunAlpha === 0);
  });
});

// ── getSkyCycle contract unchanged (regression guard) ────────────────

describe('getSkyCycle still feeds the tint system', () => {
  it('midday is fully day (nightness 0)', () => {
    assert.equal(getSkyCycle(at(0.35)).nightness, 0);
  });
  it('deep night is nightness 1', () => {
    assert.equal(getSkyCycle(at(0.9)).nightness, 1);
  });
});
