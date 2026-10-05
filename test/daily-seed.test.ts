import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDailySeed } from '@/lib/daily-seed';

/**
 * Independent FNV-1a oracle: pins the algorithm's 32-bit constants and fold
 * so a future edit can't silently drift the daily worlds. Known vectors were
 * computed with the reference constants (2166136261 / 16777619).
 */
function fnv1a(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

describe('daily seed derivation', () => {
  it('uses reference FNV-1a constants (known vectors)', () => {
    assert.equal(fnv1a('2026-10-05'), 1635592497);
    assert.equal(fnv1a('2026-01-01'), 2049302883);
  });

  it('folds the oracle hash into the exact shipped seed for a span of days', () => {
    const expected = (day: string) => Math.abs((fnv1a(day) | 0) % 900000) + 100000;
    for (const day of ['2026-01-01', '2026-10-05', '2026-12-31', '1999-09-19', '2100-02-28']) {
      assert.equal(getDailySeed(day), expected(day), day);
    }
  });

  it('stays inside the 6-digit token range across a century of days', () => {
    const seen = new Set<number>();
    let outOfRange = 0;
    const start = Date.UTC(2000, 0, 1);
    for (let i = 0; i < 36524; i++) {
      const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
      const seed = getDailySeed(day);
      if (!Number.isInteger(seed) || seed < 100000 || seed > 999999) outOfRange++;
      seen.add(seed);
    }
    assert.equal(outOfRange, 0);
    // 36524 draws into a 900k space collide rarely; the seed space must stay wide.
    assert.ok(seen.size > 30000, `seed space too narrow: ${seen.size} unique`);
  });

  it('is pure, deterministic, and day-sensitive', () => {
    assert.equal(getDailySeed('2026-10-05'), getDailySeed('2026-10-05'));
    const seeds = new Set<number>();
    const start = Date.UTC(2026, 0, 1);
    for (let i = 0; i < 365; i++) {
      seeds.add(getDailySeed(new Date(start + i * 86_400_000).toISOString().slice(0, 10)));
    }
    // Allow a handful of birthday collisions; a systematic clash means two
    // days would share one ranked world.
    assert.ok(seeds.size > 350, `consecutive days collide: ${seeds.size}/365 unique`);
    for (const bad of ['', '2026-10-05 ', '2026-1-05']) {
      assert.equal(getDailySeed(bad), getDailySeed(bad), 'malformed input stays deterministic');
    }
  });
});
