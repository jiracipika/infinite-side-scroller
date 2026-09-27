import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract test: level-select cards explain difficulty BEFORE launch
// ("level difficulty and target explained before launch" — GLM-NEXT-SLICE).

const selectSrc = readFileSync(new URL('../src/components/LevelSelectScreen.tsx', import.meta.url), 'utf8');
const solverSrc = readFileSync(new URL('../src/game/level-difficulty.ts', import.meta.url), 'utf8');

describe('LevelCard difficulty display contract', () => {
  test('card imports the pure difficulty solver', () => {
    assert.match(selectSrc, /rateLevelDifficulty/);
    assert.match(selectSrc, /level-difficulty/);
  });

  test('card renders a 3-dot difficulty meter', () => {
    assert.match(selectSrc, /DIFFICULTY_DOTS|difficulty dots|\[1, 2, 3\]\.map\(d =>/);
  });

  test('difficulty meter is exposed to assistive tech with tier + label', () => {
    assert.match(selectSrc, /aria-label=[^>]*difficulty/i);
    assert.match(selectSrc, /rating\.label|rating\.tier/);
  });

  test('locked cards dim the meter with the rest of the card', () => {
    assert.match(selectSrc, /opacity: locked \? 0\.15 : 1/);
  });

  test('solver is pure authored-data (no RNG, no localStorage/save access)', () => {
    assert.doesNotMatch(solverSrc, /Math\.random|localStorage|loadProgress/);
  });

  test('solver labels are plain-language and uppercase for the chip', () => {
    assert.match(solverSrc, /'CALM' \| 'STEADY' \| 'WILD'/);
  });
});
