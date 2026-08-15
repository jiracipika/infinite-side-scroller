import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static contract test for the start-screen controls hint.

const src = readFileSync(new URL('../src/components/ControlsHint.tsx', import.meta.url), 'utf8');
const startSrc = readFileSync(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8');

describe('ControlsHint contract', () => {
  test('adapts to pointer type: keyboard map for fine pointers, touch summary for coarse', () => {
    assert.match(src, /matchMedia\('\(pointer: coarse\)'\)/);
    assert.match(src, /TOUCH CONTROLS/);
    assert.match(src, /KEYBOARD/);
  });

  test('keyboard map covers move/jump/attack/dash/special/pause', () => {
    for (const label of ['move', 'jump', 'attack', 'dash', 'special', 'pause']) {
      assert.ok(new RegExp(label, 'i').test(src), `missing: ${label}`);
    }
  });

  test('dismissal persists and is discoverable/a11y-labelled', () => {
    assert.match(src, /dash-controls-hint-dismissed/);
    assert.match(src, /aria-label="Hide controls hint"/);
    assert.match(src, /role="note"/);
  });

  test('SSR-safe: hidden until mounted (no hydration flash of wrong layout)', () => {
    assert.match(src, /useState\(true\)/); // dismissed=true initial
  });

  test('StartScreen renders the hint inside the hero panel', () => {
    assert.match(startSrc, /import ControlsHint from "\.\/ControlsHint"/);
    assert.match(startSrc, /<ControlsHint \/>/);
  });
});
