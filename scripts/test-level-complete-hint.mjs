import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract test: level-complete screen shows the next-star threshold.

const src = readFileSync(new URL('../src/components/LevelCompleteScreen.tsx', import.meta.url), 'utf8');

describe('LevelComplete next-star hint contract', () => {
  test('renders a threshold hint when stars < 3', () => {
    assert.match(src, /stars < 3 && \(/);
  });

  test('each tier uses the matching threshold from level config', () => {
    assert.match(src, /level\.starThresholds\.one\.toLocaleString\(\)/);
    assert.match(src, /level\.starThresholds\.two\.toLocaleString\(\)/);
    assert.match(src, /level\.starThresholds\.three\.toLocaleString\(\)/);
  });

  test('0-star case tells the player the first-star target explicitly', () => {
    assert.match(src, /points to earn your first star/);
  });

  test('shows the player their own score next to the threshold', () => {
    assert.match(src, /you scored \{result\.score\.toLocaleString\(\)\}/);
  });

  test('hint is announced politely (role=status, delayed after reveal)', () => {
    assert.match(src, /role="status"/);
    assert.match(src, /delay: 1\.0/);
  });
});
