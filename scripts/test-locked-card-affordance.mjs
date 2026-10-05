import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract test: locked level cards are a complete affordance — the player
// can SEE how to unlock, assistive tech HEARS state + condition, the card
// cannot be activated, and the locked state is distinguishable from
// unlocked/complete beyond color alone ("explicit locked/unlocked/complete
// states" + "locked states not clickable" — GLM-NEXT-SLICE).
//
// LevelSelectScreen is not Node-importable (JSX + framer-motion), so this
// pins the source contract grep-style, same as test-level-select-ux.mjs.

const src = readFileSync(new URL('../src/components/LevelSelectScreen.tsx', import.meta.url), 'utf8');

describe('Locked level card affordance contract', () => {
  test('locked cards cannot be activated: no onClick, real disabled semantics, no action affordance', () => {
    assert.match(src, /onClick=\{locked \? undefined : onClick\}/);
    assert.match(src, /disabled=\{locked\}/);
    assert.match(src, /cursor: locked \? 'default' : 'pointer'/);
    assert.match(src, /whileHover=\{!locked \?/);
    assert.match(src, /whileTap=\{!locked \?/);
  });

  test('locked cards announce BOTH the locked state and the unlock condition', () => {
    assert.match(src, /locked — earn a star on the previous level to unlock/);
  });

  test('locked cards show the unlock condition as visible copy (touch devices have no tooltips)', () => {
    // The title attribute is hover-only; the condition must also be rendered
    // as static text on the card itself, in sync with the aria-label copy.
    assert.match(src, /\{locked && \(/);
    assert.match(src, /Earn a star on the previous level to unlock/);
  });

  test('locked state is distinguishable beyond color: lock glyph replaces the star row', () => {
    assert.match(src, /\{locked \? \(\s*<span[^>]*>🔒<\/span>\s*\) : \(/);
    // The other branch renders the 3-star row (unlocked = partial, complete = 3 lit).
    assert.match(src, /\[1,2,3\]\.map\(s =>/);
  });
});
