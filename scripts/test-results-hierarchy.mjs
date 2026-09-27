import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract test: level-complete results make the action hierarchy obvious —
// exactly ONE dominant primary action (Next when advancing, Retry otherwise).

const src = readFileSync(new URL('../src/components/LevelCompleteScreen.tsx', import.meta.url), 'utf8');

describe('LevelComplete results hierarchy contract', () => {
  test('the container pins which action is primary', () => {
    assert.match(src, /data-primary-action=\{canAdvance \? 'next' : 'retry'\}/);
  });

  test('primary action is visually dominant (flex 1.5), secondary stays at 1', () => {
    assert.match(src, /flex: 1\.5/);
    assert.match(src, /flex: canAdvance \? 1 : 1\.5/);
  });

  test('primary glow: Retry only glows when it is the primary', () => {
    assert.match(src, /boxShadow: canAdvance \? 'none' : `/);
  });

  test('Next is only offered when advancing is possible (stars >= 1)', () => {
    assert.match(src, /onNext && stars >= 1/);
  });

  test('keyboard confirm intent mirrors the render gate', () => {
    assert.match(src, /const canAdvance = Boolean\(onNext\) && stars >= 1;/);
  });
});
