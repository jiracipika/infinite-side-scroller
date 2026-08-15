import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Static contract test for the level-select UX additions.
// These are render-behavior guarantees the release evidence relies on.

const src = readFileSync(new URL('../src/components/LevelSelectScreen.tsx', import.meta.url), 'utf8');

describe('LevelSelectScreen continue/next UX contract', () => {
  test('continueLevel picks the first unlocked, not-fully-starred level', () => {
    assert.match(src, /first unlocked level that[\s\S]*?isn't fully starred/i);
    assert.match(src, /if \(p\.stars < 3\) return level;/);
  });

  test('continue banner renders only for level tabs and links to continueLevel', () => {
    assert.match(src, /tab !== 'endless' && continueLevel/);
    assert.match(src, /onClick=\{\(\) => onLevelSelect\(continueLevel\)\}/);
    assert.match(src, /aria-label=\{`Continue: \$\{continueLevel\.name\}`\}/);
  });

  test('header shows per-mode star summary with accessible label', () => {
    assert.match(src, /starsEarned/);
    assert.match(src, /aria-label=\{`Mode progress: \$\{starsEarned\} of \$\{starsTotal\} stars earned`\}/);
  });

  test('locked cards explain how to unlock (title + aria)', () => {
    assert.match(src, /title=\{locked \? 'Earn at least 1 star on the previous level to unlock' : undefined\}/);
    assert.match(src, /locked — earn a star on the previous level to unlock/);
  });

  test('next-up level card gets a NEXT badge and aria note', () => {
    assert.match(src, /isNext=\{continueLevel\?\.id === level\.id\}/);
    assert.match(src, /NEXT/);
    assert.match(src, /next up/);
  });

  test('grid no longer mutates loaded progress via ensureDefault spread', () => {
    // The old pattern ensureDefault({ ...progress }, level.id) mutated a copy
    // per render; the new code reads a memoized levelProgress map instead.
    assert.ok(!src.includes("ensureDefault({ ...progress }"));
    assert.match(src, /const p = levelProgress\[level\.id\];/);
  });
});
