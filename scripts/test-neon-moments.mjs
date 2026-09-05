import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract gate for the graphic-novel moment FX slice:
//  - biome-entry title card (engine event → React ink card)
//  - game-over comic knockout flash
// Both must respect reduced motion and not touch engine timing contracts.

const engine = readFileSync(new URL('../src/game/engine/game-engine.ts', import.meta.url), 'utf8');
const page = readFileSync(new URL('../src/app/page.tsx', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/components/BiomeTitleCard.tsx', import.meta.url), 'utf8');
const flash = readFileSync(new URL('../src/components/GameOverFlash.tsx', import.meta.url), 'utf8');

describe('biome title card contract', () => {
  test('engine dispatches dashverse-biome once per biome change during play', () => {
    assert.match(engine, /new CustomEvent\("dashverse-biome"/);
    assert.match(engine, /lastAnnouncedBiome/);
    assert.match(engine, /this\._state === "playing"/, 'event fires only while playing');
  });

  test('tracker resets per run so every run announces its biomes again', () => {
    assert.match(engine, /this\.lastAnnouncedBiome = null;/);
  });

  test('card listens on window, is aria-live, and unmounts itself after the hold', () => {
    assert.match(card, /addEventListener\('dashverse-biome'/);
    assert.match(card, /aria-live="polite"/);
    assert.match(card, /setCard\(null\)/);
  });

  test('card animation is suppressed under reduced motion (still prop)', () => {
    assert.match(card, /still = false/);
    assert.match(card, /animation: still/);
    assert.match(page, /<BiomeTitleCard still=\{resolveReducedMotion\(settings\.reducedMotion\)\} \/>/);
  });

  test('card renders above canvas but below pause/game-over overlays', () => {
    assert.match(card, /zIndex: 15/);
  });
});

describe('game-over knockout flash contract', () => {
  test('flash is aria-hidden, pointer-transparent, and removes itself from the DOM', () => {
    assert.match(flash, /aria-hidden="true"/);
    assert.match(flash, /pointerEvents: 'none'/);
    assert.match(flash, /setPhase\(0\)/);
  });

  test('flash uses the palette ink/paper colors, not arbitrary white/black', () => {
    assert.match(flash, /#f4f2ed/);
    assert.match(flash, /#0a0a0f/);
  });

  test('flash is skipped entirely under reduced motion', () => {
    assert.match(flash, /if \(still\) return;/);
    assert.match(page, /<GameOverFlash still=\{resolveReducedMotion\(settings\.reducedMotion\)\} \/>/);
  });

  test('no canvas/engine timing touched by the flash', () => {
    assert.ok(!flash.includes('requestAnimationFrame'), 'flash must be CSS/timer only');
    assert.ok(!flash.includes('getContext'), 'no canvas work in the flash');
  });
});
