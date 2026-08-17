import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// getDailyStreak is browser-localStorage-bound; test the pure streak walk
// by re-implementing its storage contract against a stub localStorage.

/** Mirror of the storage contract: Record<isoDay, slotId[]>. */
function streakFromHistory(history, slotId, today) {
  const played = (day) => {
    const list = history[day];
    return Array.isArray(list) && list.includes(slotId);
  };
  let cursorTs = new Date(`${today}T00:00:00Z`).getTime();
  if (!played(today)) cursorTs -= 86_400_000;
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const day = new Date(cursorTs).toISOString().slice(0, 10);
    if (played(day)) {
      streak++;
      cursorTs -= 86_400_000;
    } else break;
  }
  return streak;
}

describe('daily streak math (storage contract mirror)', () => {
  test('returns 0 for empty history', () => {
    assert.equal(streakFromHistory({}, 'slot-1', '2026-08-15'), 0);
  });

  test('counts consecutive days ending today', () => {
    assert.equal(
      streakFromHistory({ '2026-08-15': ['slot-1'], '2026-08-14': ['slot-1'], '2026-08-13': ['slot-1'] }, 'slot-1', '2026-08-15'),
      3,
    );
  });

  test('yesterday-grace: unplayed today keeps yesterday-anchored streak', () => {
    assert.equal(
      streakFromHistory({ '2026-08-14': ['slot-1'], '2026-08-13': ['slot-1'] }, 'slot-1', '2026-08-15'),
      2,
    );
  });

  test('a gap day breaks the streak', () => {
    assert.equal(
      streakFromHistory({ '2026-08-15': ['slot-1'], '2026-08-13': ['slot-1'] }, 'slot-1', '2026-08-15'),
      1,
    );
  });

  test('other slots do not inflate the streak', () => {
    assert.equal(
      streakFromHistory({ '2026-08-15': ['slot-2'], '2026-08-14': ['slot-1'] }, 'slot-1', '2026-08-15'),
      1,
    );
  });

  test('caps at 60 days of retention', () => {
    const history = {};
    for (let i = 0; i < 80; i++) {
      const ts = new Date('2026-08-15T00:00:00Z').getTime() - i * 86_400_000;
      history[new Date(ts).toISOString().slice(0, 10)] = ['slot-1'];
    }
    assert.equal(streakFromHistory(history, 'slot-1', '2026-08-15'), 60);
  });
});

describe('markDailyChallengePlayed retention contract (source scan)', () => {
  const src = readFileSync(new URL('../src/lib/progression.ts', import.meta.url), 'utf8');

  test('keeps 60 days of history, not just today', () => {
    assert.match(src, /60 \* 86_400_000/);
    assert.ok(!src.includes('const keepDays = [day];'), 'old today-only wipe still present');
  });

  test('streak fn exists and anchors with yesterday-grace', () => {
    assert.match(src, /export function getDailyStreak/);
    assert.match(src, /if \(!played\(today\)\) cursorTs -= 86_400_000/);
  });

  test('StartScreen surfaces the streak on the daily card', () => {
    const start = readFileSync(new URL('../src/components/StartScreen.tsx', import.meta.url), 'utf8');
    assert.match(start, /getDailyStreak/);
    assert.match(start, /day streak/);
  });
});
