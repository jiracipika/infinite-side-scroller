import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static contract tests for the neon sky hand-off + menu disclosure a11y.
// Source-contract style matching the repo's existing scripts/*.mjs gates.

const background = readFileSync(new URL('../src/game/rendering/background.ts', import.meta.url), 'utf8');
const startScreen = readFileSync(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8');

describe('celestial sky hand-off contract', () => {
  test('resolveCelestialAlphas exists and takes gameTime only (pure, no RNG)', () => {
    assert.match(background, /export function resolveCelestialAlphas\(\s*\n?\s*gameTime: number,/);
    assert.ok(!/Math\.random/.test(background), 'background.ts must stay RNG-free (multiplayer sky parity)');
  });

  test('drawSun/drawMoon consume an explicit alpha instead of gating on nightness themselves', () => {
    assert.match(background, /function drawSun\(\s*[\s\S]*?alpha: number,/);
    assert.match(background, /function drawMoon\(\s*[\s\S]*?alpha: number,/);
    assert.ok(
      !/drawMoon\(ctx, width, height, phase, nightness\)/.test(background),
      'moon must be driven by the solver alpha, not raw nightness',
    );
  });

  test('sky painter delegates visibility to the solver and skips near-zero alphas', () => {
    assert.match(background, /const \{ sunAlpha, moonAlpha \} = resolveCelestialAlphas\(gameTime\);/);
    assert.match(background, /if \(moonAlpha > 0\.004\)/);
    assert.match(background, /if \(sunAlpha > 0\.004\)/);
  });

  test('sun/moon arc constants are shared between solver and painters', () => {
    assert.match(background, /export const SUN_ARC_START = 0\.075;/);
    assert.match(background, /export const SUN_ARC_LENGTH = 0\.625;/);
    assert.match(background, /export const MOON_ARC_START = 0\.575;/);
    assert.match(background, /export const MOON_ARC_LENGTH = 0\.625;/);
    assert.match(background, /\(phase - SUN_ARC_START\) \/ SUN_ARC_LENGTH/);
    assert.match(background, /\(phase - MOON_ARC_START \+ 1\) % 1\) \/ MOON_ARC_LENGTH|MOON_ARC_LENGTH;\s*\/\/ same arc length/s);
  });
});

describe('menu disclosure a11y contract', () => {
  test('every disclosure card (label flips to "Hide …") exposes aria-expanded', () => {
    const buttons = startScreen.split('<button').slice(1).map((b) => b.split('</button>')[0]);
    const disclosures = buttons.filter((b) => /Hide /.test(b));
    assert.ok(disclosures.length >= 4, `expected >=4 disclosure cards, found ${disclosures.length}`);
    for (const b of disclosures) {
      assert.match(b, /aria-expanded=/, `disclosure card missing aria-expanded: ${b.slice(0, 140)}`);
      assert.match(b, /dash-mode-card-v2/);
    }
  });

  test('every aria-expanded disclosure points at a real panel id via aria-controls', () => {
    for (const m of startScreen.matchAll(/aria-controls="([^"]+)"/g)) {
      const id = m[1];
      assert.ok(
        new RegExp(`id="${id}"`).test(startScreen),
        `aria-controls points at missing panel: ${id}`,
      );
    }
    assert.match(startScreen, /aria-controls="saves-shop-panel"/);
  });
});
