import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STRATA_DEPTHS,
  STRATA_ALPHAS,
  SPECKLE_STEP,
  textureHash,
  tuftsForChunk,
  surfaceAt,
  drawTuft,
  paintGroundTexture,
  paintPlatformDetail,
} from '@/game/rendering/textures';
import { getSkyCycle, ridgeHeightAt } from '@/game/rendering/background';
import {
  shadeHexColor,
  shadeFraction,
  blendHex,
  hexToRgba,
} from '@/game/rendering/color';
import { DAY_CYCLE_SECONDS } from '@/game/engine/day-cycle';

// ── Deterministic hashing ────────────────────────────────────────────

describe('textureHash', () => {
  it('is deterministic for identical inputs', () => {
    for (let i = 0; i < 200; i++) {
      assert.equal(textureHash(i, 42), textureHash(i, 42));
    }
  });

  it('stays in [0, 1) across a wide input sweep', () => {
    for (let i = -500; i < 500; i += 7) {
      const v = textureHash(i, i * 31 + 7);
      assert.ok(v >= 0 && v < 1, `out of range: ${v} for (${i})`);
    }
  });

  it('produces varied output for distinct inputs', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) seen.add(textureHash(i, 9).toFixed(6));
    assert.ok(seen.size > 90, `only ${seen.size} distinct values in 100 draws`);
  });

  it('handles negative and fractional seeds without crashing', () => {
    assert.ok(textureHash(5, -1) >= 0 && textureHash(5, -1) < 1);
    assert.ok(textureHash(-3, 0.5) >= 0 && textureHash(-3, 0.5) < 1);
  });
});

// ── Sky cycle (day/night star gating) ────────────────────────────────

describe('getSkyCycle', () => {
  it('is fully day at midday', () => {
    const { phase, nightness } = getSkyCycle(0.4 * DAY_CYCLE_SECONDS);
    assert.equal(phase, 0.4);
    assert.equal(nightness, 0);
  });

  it('is full night in the small hours', () => {
    assert.equal(getSkyCycle(0.02 * DAY_CYCLE_SECONDS).nightness, 1);
    assert.equal(getSkyCycle(0.9 * DAY_CYCLE_SECONDS).nightness, 1);
  });

  it('is ~half-faded at the dawn midpoint', () => {
    const mid = ((0.075 + 0.2) / 2) * DAY_CYCLE_SECONDS;
    const { nightness } = getSkyCycle(mid);
    assert.ok(Math.abs(nightness - 0.5) < 0.01, `got ${nightness}`);
  });

  it('wraps continuously with no discontinuity at the 0/1 boundary', () => {
    const atWrap = getSkyCycle(DAY_CYCLE_SECONDS).nightness;
    const atZero = getSkyCycle(0).nightness;
    assert.equal(atWrap, atZero);
  });

  it('fades smoothly across the dawn boundary (no pops)', () => {
    const before = getSkyCycle(0.0749 * DAY_CYCLE_SECONDS).nightness;
    const after = getSkyCycle(0.0751 * DAY_CYCLE_SECONDS).nightness;
    assert.ok(before > 0.98);
    assert.ok(after > 0.98);
    assert.ok(Math.abs(before - after) < 0.01);
  });
});

// ── Parallax ridge geometry ──────────────────────────────────────────

describe('ridgeHeightAt', () => {
  it('is deterministic', () => {
    for (const x of [0, 1234, -999, 48000.5]) {
      assert.equal(ridgeHeightAt(x, 7, 100), ridgeHeightAt(x, 7, 100));
    }
  });

  it('stays bounded within the amplitude envelope', () => {
    for (let x = -5000; x < 5000; x += 13) {
      const h = ridgeHeightAt(x, 3, 200);
      assert.ok(h >= -200 && h <= 200, `unbounded ${h} at x=${x}`);
    }
  });

  it('varies across the world (not a flat line)', () => {
    let min = Infinity;
    let max = -Infinity;
    for (let x = 0; x < 20000; x += 50) {
      const h = ridgeHeightAt(x, 11, 150);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    assert.ok(max - min > 50, `ridge too flat: range ${max - min}`);
  });
});

// ── Ground texture data ──────────────────────────────────────────────

describe('ground texture tables', () => {
  it('has one alpha per stratum depth', () => {
    assert.equal(STRATA_DEPTHS.length, STRATA_ALPHAS.length);
  });

  it('keeps speckle columns sparser in low detail', () => {
    assert.ok(SPECKLE_STEP.low > SPECKLE_STEP.high);
  });

  it('orders strata shallow-to-deep with fading alpha', () => {
    for (let i = 1; i < STRATA_DEPTHS.length; i++) {
      assert.ok(STRATA_DEPTHS[i] > STRATA_DEPTHS[i - 1]);
      assert.ok(STRATA_ALPHAS[i] < STRATA_ALPHAS[i - 1]);
    }
  });
});

describe('surfaceAt', () => {
  const heights = [100, 104, 108, 112];

  it('returns exact samples at 4px grid points', () => {
    assert.equal(surfaceAt(heights, 0), 100);
    assert.equal(surfaceAt(heights, 8), 108);
  });

  it('interpolates halfway between samples', () => {
    assert.equal(surfaceAt(heights, 2), 102);
    assert.equal(surfaceAt(heights, 6), 106);
  });

  it('clamps out-of-range indices instead of crashing', () => {
    assert.equal(surfaceAt(heights, -100), 100);
    assert.equal(surfaceAt(heights, 10_000), 112);
  });
});

describe('tuftsForChunk', () => {
  const heights: number[] = [];
  for (let i = 0; i <= 200; i++) heights.push(300 + Math.sin(i * 0.3) * 20);

  it('is deterministic per chunk index', () => {
    const a = tuftsForChunk(5, heights, 0.5);
    const b = tuftsForChunk(5, heights, 0.5);
    assert.deepEqual(a, b);
  });

  it('differs between chunk indices', () => {
    const a = tuftsForChunk(1, heights, 0.9).map((t) => t.x);
    const b = tuftsForChunk(2, heights, 0.9).map((t) => t.x);
    assert.notDeepEqual(a, b);
  });

  it('plants every tuft exactly on the surface', () => {
    for (const tuft of tuftsForChunk(9, heights, 0.9)) {
      assert.ok(Math.abs(tuft.y - surfaceAt(heights, tuft.x)) < 0.001);
    }
  });

  it('enforces minimum spacing between tufts', () => {
    const tufts = tuftsForChunk(4, heights, 0.9).sort((a, b) => a.x - b.x);
    for (let i = 1; i < tufts.length; i++) {
      assert.ok(tufts[i].x - tufts[i - 1].x >= 22, 'tufts overlapping');
    }
  });

  it('respects the chance gate (0 = bare ground)', () => {
    assert.equal(tuftsForChunk(3, heights, 0).length, 0);
  });

  it('produces sane tuft geometry', () => {
    for (const tuft of tuftsForChunk(8, heights, 0.9)) {
      assert.ok(tuft.height >= 5 && tuft.height <= 12);
      assert.ok(tuft.lean >= -1 && tuft.lean <= 1);
      assert.ok(tuft.blades >= 2 && tuft.blades <= 3);
    }
  });
});

// ── Canvas painters smoke (minimal 2D context stub) ──────────────────

function makeCtxStub(): CanvasRenderingContext2D {
  const calls: string[] = [];
  const gradient = { addColorStop: () => calls.push('stop') };
  return {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('path'),
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    ellipse: () => {},
    fill: () => calls.push('fill'),
    stroke: () => calls.push('stroke'),
    fillRect: () => calls.push('fillRect'),
    quadraticCurveTo: () => {},
    closePath: () => {},
    clip: () => calls.push('clip'),
    set globalAlpha(_v: number) {},
    get globalAlpha() {
      return 1;
    },
    set lineWidth(_v: number) {},
    get lineWidth() {
      return 1;
    },
    set strokeStyle(_v: string | CanvasGradient) {},
    get strokeStyle(): string {
      return '#000000';
    },
    set fillStyle(_v: string | CanvasGradient) {},
    get fillStyle(): string {
      return '#000000';
    },
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    // Expose call log for assertions.
    ...({ __calls: calls } as Record<string, unknown>),
  } as unknown as CanvasRenderingContext2D;
}

describe('painters run against a stub context', () => {
  const heights: number[] = [];
  for (let i = 0; i <= 100; i++) heights.push(400 + Math.sin(i * 0.2) * 15);

  it('paintGroundTexture executes and balances save/restore', () => {
    const ctx = makeCtxStub();
    paintGroundTexture(ctx, {
      heights,
      chunkWorldX: 8000,
      chunkIndex: 10,
      offsetX: 0,
      offsetY: 0,
      depthPx: 600,
      ground: '#48d597',
      groundDark: '#123d46',
      detail: true,
    });
    const calls = (ctx as unknown as { __calls: string[] }).__calls;
    assert.ok(calls.includes('stroke'), 'strata lines expected');
    const saves = calls.filter((c) => c === 'save').length;
    const restores = calls.filter((c) => c === 'restore').length;
    assert.equal(saves, restores, 'ctx state must be balanced');
  });

  it('drawTuft renders blades without throwing', () => {
    const ctx = makeCtxStub();
    const tufts = tuftsForChunk(2, heights, 0.9);
    assert.ok(tufts.length > 0);
    drawTuft(ctx, tufts[0], '#2d7a27', 0.5, 0, 0);
  });

  it('paintPlatformDetail balances save/restore', () => {
    const ctx = makeCtxStub();
    paintPlatformDetail(ctx, 10, 20, 120, '#123d46', '#0a2530');
    const calls = (ctx as unknown as { __calls: string[] }).__calls;
    assert.equal(
      calls.filter((c) => c === 'save').length,
      calls.filter((c) => c === 'restore').length,
    );
  });
});

// ── Color utilities ──────────────────────────────────────────────────

describe('color utilities', () => {
  it('shadeHexColor lightens and darkens with clamping', () => {
    assert.equal(shadeHexColor('#808080', 16), '#909090');
    assert.equal(shadeHexColor('#808080', -16), '#707070');
    assert.equal(shadeHexColor('#ffffff', 100), '#ffffff');
    assert.equal(shadeHexColor('#000000', -100), '#000000');
  });

  it('shadeFraction interpolates toward white/black', () => {
    assert.equal(shadeFraction('#404040', 0), '#404040');
    assert.equal(shadeFraction('#404040', 1), '#ffffff');
    assert.equal(shadeFraction('#404040', -1), '#000000');
    const half = shadeFraction('#404040', 0.5);
    assert.ok(half > '#404040' && half < '#ffffff');
  });

  it('blendHex endpoints and midpoint', () => {
    assert.equal(blendHex('#000000', '#ffffff', 0), '#000000');
    assert.equal(blendHex('#000000', '#ffffff', 1), '#ffffff');
    assert.equal(blendHex('#000000', '#ffffff', 0.5), '#808080');
  });

  it('blendHex clamps out-of-range t', () => {
    assert.equal(blendHex('#102030', '#ffffff', -5), '#102030');
    assert.equal(blendHex('#102030', '#ffffff', 5), '#ffffff');
  });

  it('hexToRgba formats and clamps alpha', () => {
    assert.equal(hexToRgba('#ff8000', 0.5), 'rgba(255,128,0,0.500)');
    assert.equal(hexToRgba('#ff8000', 2), 'rgba(255,128,0,1.000)');
    assert.equal(hexToRgba('#ff8000', -1), 'rgba(255,128,0,0.000)');
  });
});
