import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract test for the two run-start affordances from the GLM-NEXT-SLICE
// vertical slice:
//  1. character/ability affordance — ALREADY SHIPPED on the start screen
//     (loadout panel is the default view; selected runner + ability come
//     from save state). This suite pins it so it cannot regress.
//  2. mobile controls preview — the level-select area must show what touch
//     controls will be used, mirroring the canonical set in TouchControls
//     (the round3 phase 4 guard's source of truth).

const startSrc = readFileSync(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8');
const selectSrc = readFileSync(new URL('../src/components/LevelSelectScreen.tsx', import.meta.url), 'utf8');
const hintSrc = readFileSync(new URL('../src/components/ControlsHint.tsx', import.meta.url), 'utf8');
const touchSrc = readFileSync(new URL('../src/components/TouchControls.tsx', import.meta.url), 'utf8');

describe('run-start character affordance (already shipped — pinned)', () => {
  test('loadout panel is the default view on the start screen', () => {
    assert.match(startSrc, /useState<MenuView>\("character"\)/);
  });

  test('selected runner loads from save state', () => {
    assert.match(startSrc, /setSelectedChar\(loadSelectedCharacter\(\)\)/);
  });

  test('ability + description render with the selected runner', () => {
    assert.match(startSrc, /\{selectedCharacter\.description\} · \{selectedCharacter\.ability\}/);
  });

  test('hero quick-stats surface the runner name', () => {
    assert.match(startSrc, /<small>Runner<\/small>/);
    assert.match(startSrc, /\{selectedCharacter\.name\}/);
  });
});

describe('mobile controls preview contract', () => {
  test('canonical touch control set stays pinned (guard source of truth)', () => {
    for (const marker of [
      'aria-label="Jump"',
      'aria-label="Attack"',
      'aria-label="Melee slash"',
      'aria-label="Dash"',
      'aria-label="Special attack"',
      'aria-label="Carry teammate"',
      'aria-label="Pause game"',
    ]) {
      assert.ok(touchSrc.includes(marker), `TouchControls missing: ${marker}`);
    }
  });

  test('controls hint touch copy names the canonical verb set', () => {
    for (const verb of ['move', 'jump', 'attack', 'melee', 'dash', 'special', 'carry', 'pause']) {
      assert.ok(new RegExp(verb, 'i').test(hintSrc), `ControlsHint missing verb: ${verb}`);
    }
  });

  test('level-select area shows the controls preview before launch', () => {
    assert.match(selectSrc, /import ControlsHint from ['"]\.\/ControlsHint['"]/);
    assert.match(selectSrc, /<ControlsHint dismissible=\{false\} \/>/);
  });
});
