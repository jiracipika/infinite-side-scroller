import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static contract for the graphic-novel backdrop slice: ink clouds and the
// ink city skyline with lit windows + neon signs (concept-board fidelity).
// Mirrors the source-contract style of the other scripts/*.mjs gates.

const background = readFileSync(new URL('../src/game/rendering/background.ts', import.meta.url), 'utf8');

describe('graphic-novel backdrop contract', () => {
  test('ink clouds: bold opaque inked bodies, not alpha-washed white ellipses', () => {
    // The old invisible clouds used a ~0.11-0.21 alpha white base.
    assert.ok(
      !/cloudBase = blendHex\("#ffffff"/.test(background),
      'clouds must not fall back to near-invisible white blobs',
    );
    assert.match(background, /const inkBody = blendHex\("#0a0a0f", colors\.groundDark, 0\.42\);/);
    assert.match(background, /const alpha = 0\.78 \+ h3 \* 0\.18;/, 'ink clouds stay near-opaque');
    assert.match(background, /ctx\.strokeStyle = rim;/, 'clouds carry the light top rim (inked highlight)');
  });

  test('ink city skyline exists between streams and near ridge', () => {
    const order = background.indexOf('drawChromaticStreams(');
    const skyline = background.indexOf('drawInkSkyline(');
    const ridge = background.indexOf('drawRidge(ctx, width, height, cameraX, cameraY, 0.35,');
    assert.ok(skyline > 0, 'drawInkSkyline must be defined/called');
    assert.ok(order < skyline && skyline < ridge, 'skyline must render between streams and near ridge');
  });

  test('skyline is deterministic — hash-seeded, no RNG, multiplayer-stable', () => {
    const fn = background.slice(background.indexOf('function drawInkSkyline'), background.indexOf('/**\n * World-anchored drifting clouds'));
    assert.ok(!fn.includes('Math.random'), 'skyline must not use Math.random');
    assert.match(fn, /textureHash\(/, 'skyline geometry comes from textureHash');
  });

  test('neon signs use the approved accent trio and stay local (no full-screen blur)', () => {
    const fn = background.slice(background.indexOf('function drawInkSkyline'), background.indexOf('/**\n * World-anchored drifting clouds'));
    for (const tint of ['#c7ff4d', '#9570ff', '#ff7166']) {
      assert.ok(fn.includes(tint), `sign palette must include ${tint}`);
    }
    assert.match(fn, /createRadialGradient/, 'sign glow is a local radial gradient');
  });

  test('lit windows and sign flicker brighten at night; reduced motion freezes flicker', () => {
    const fn = background.slice(background.indexOf('function drawInkSkyline'), background.indexOf('/**\n * World-anchored drifting clouds'));
    assert.match(fn, /0\.16 \+ nightness \* 0\.5/, 'windows brighten with nightness');
    assert.match(fn, /reducedMotionFlag\s*\n?\s*\? 1/, 'flicker frozen under reduced motion');
  });

  test('low detail degrades gracefully (fewer towers, no window/sign pass)', () => {
    const fn = background.slice(background.indexOf('function drawInkSkyline'), background.indexOf('/**\n * World-anchored drifting clouds'));
    assert.match(fn, /detail !== "high"\) continue;/, 'window/sign detail skipped at low fidelity');
    assert.match(fn, /detail === "high" \? 10 : 6/, 'tower count scales with detail');
  });
});
