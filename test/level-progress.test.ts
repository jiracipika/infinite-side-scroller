import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcStars,
  findNextLevel,
  recordLevelResult,
  loadProgress,
  saveProgress,
  ensureDefault,
  STORAGE_KEY,
  type LevelProgressMap,
} from '@/lib/level-progress';
import {
  ADVENTURE_LEVELS,
  TIME_ATTACK_LEVELS,
  type LevelConfig,
} from '@/game/data/levels';

// ────────────────────────────────────────────────────────────
// localStorage polyfill — mirrors the pattern in
// progression-persistence.test.ts: sets globalThis.localStorage
// directly because the level-progress module uses bare
// `localStorage.*` calls (which resolve to globalThis in Node).
// ────────────────────────────────────────────────────────────
const MEMORY: Record<string, string> = {};
const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  removeItem: (key: string): void => { delete MEMORY[key]; },
  clear: (): void => { for (const k of Object.keys(MEMORY)) delete MEMORY[k]; },
};
const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalAny;
globalAny.localStorage = localStorageStub;

function freshStorage(): void {
  localStorageStub.clear();
}

describe('calcStars', () => {
  const level: LevelConfig = {
    id: 1,
    name: 'Test',
    mode: 'adventure',
    seed: 1,
    targetDistance: 500,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.2,
    hazardDensity: 0.1,
    boss: false,
    powerUpFrequency: 0.3,
    description: '',
    starThresholds: { one: 500, two: 1000, three: 1500 },
  };

  it('returns 0 stars for scores below the 1-star threshold', () => {
    assert.equal(calcStars(level, 0), 0);
    assert.equal(calcStars(level, 499), 0);
  });

  it('returns 1 star at the 1-star threshold', () => {
    assert.equal(calcStars(level, 500), 1);
    assert.equal(calcStars(level, 999), 1);
  });

  it('returns 2 stars at the 2-star threshold', () => {
    assert.equal(calcStars(level, 1000), 2);
    assert.equal(calcStars(level, 1499), 2);
  });

  it('returns 3 stars at the 3-star threshold', () => {
    assert.equal(calcStars(level, 1500), 3);
    assert.equal(calcStars(level, 99999), 3);
  });
});

describe('findNextLevel', () => {
  it('finds the next adventure level', () => {
    const level1 = ADVENTURE_LEVELS[0];
    const next = findNextLevel(level1);
    assert.ok(next);
    assert.equal(next!.id, ADVENTURE_LEVELS[1].id);
    assert.equal(next!.mode, 'adventure');
  });

  it('finds the next time-attack level', () => {
    const ta1 = TIME_ATTACK_LEVELS[0];
    const next = findNextLevel(ta1);
    assert.ok(next);
    assert.equal(next!.id, TIME_ATTACK_LEVELS[1].id);
    assert.equal(next!.mode, 'time-attack');
  });

  it('returns null for the last adventure level (no cross-mode jump)', () => {
    const lastAdventure = ADVENTURE_LEVELS[ADVENTURE_LEVELS.length - 1];
    const next = findNextLevel(lastAdventure);
    assert.equal(next, null);
  });

  it('returns null for the last time-attack level', () => {
    const lastTA = TIME_ATTACK_LEVELS[TIME_ATTACK_LEVELS.length - 1];
    const next = findNextLevel(lastTA);
    assert.equal(next, null);
  });

  it('does NOT cross from adventure to time-attack', () => {
    // Level 20 (Boss Rush) is the last adventure level.
    // ALL_LEVELS[20] would be the first time-attack level (id 21).
    // findNextLevel must return null, not level 21.
    const bossRush = ADVENTURE_LEVELS.find(l => l.id === 20)!;
    const next = findNextLevel(bossRush);
    assert.equal(next, null);
  });
});

describe('recordLevelResult — monotonic star logic', () => {
  beforeEach(freshStorage);

  const level: LevelConfig = {
    id: 1,
    name: 'Test',
    mode: 'adventure',
    seed: 1,
    targetDistance: 500,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.2,
    hazardDensity: 0.1,
    boss: false,
    powerUpFrequency: 0.3,
    description: '',
    starThresholds: { one: 500, two: 1000, three: 1500 },
  };

  it('saves stars and best score on first completion', () => {
    recordLevelResult(level, 1500);
    const progress = loadProgress();
    assert.equal(progress[1].stars, 3);
    assert.equal(progress[1].bestScore, 1500);
    assert.equal(progress[1].unlocked, true);
  });

  it('does NOT downgrade stars on a worse replay (regression bug fix)', () => {
    // First: earn 3 stars.
    recordLevelResult(level, 1500);
    assert.equal(loadProgress()[1].stars, 3);

    // Replay with a 1-star score — stars must stay at 3.
    recordLevelResult(level, 500);
    assert.equal(loadProgress()[1].stars, 3);
    assert.equal(loadProgress()[1].bestScore, 1500);
  });

  it('does NOT downgrade from 2 to 1 star', () => {
    recordLevelResult(level, 1000);
    assert.equal(loadProgress()[1].stars, 2);

    recordLevelResult(level, 500);
    assert.equal(loadProgress()[1].stars, 2);
  });

  it('updates best score on a better replay even if stars stay the same', () => {
    recordLevelResult(level, 1500);
    recordLevelResult(level, 2000);
    const p = loadProgress()[1];
    assert.equal(p.stars, 3);
    assert.equal(p.bestScore, 2000);
  });

  it('does NOT award stars for a 0-star score', () => {
    recordLevelResult(level, 100);
    const p = loadProgress()[1];
    assert.equal(p.stars, 0);
  });
});

describe('recordLevelResult — unlock chaining', () => {
  beforeEach(freshStorage);

  it('unlocks the next level in the same mode when ≥1 star is earned', () => {
    const level1 = ADVENTURE_LEVELS[0]; // Forest Trail
    recordLevelResult(level1, level1.starThresholds.one);
    const progress = loadProgress();
    assert.equal(progress[level1.id].stars, 1);
    const nextLevel = ADVENTURE_LEVELS[1];
    assert.equal(progress[nextLevel.id]?.unlocked, true);
  });

  it('does NOT unlock the next level when 0 stars are earned', () => {
    const level1 = ADVENTURE_LEVELS[0];
    recordLevelResult(level1, 0); // below 1-star threshold
    const progress = loadProgress();
    const nextLevel = ADVENTURE_LEVELS[1];
    // Next level should not exist in progress (or be locked if defaulted)
    assert.ok(!progress[nextLevel.id] || !progress[nextLevel.id].unlocked);
  });

  it('does NOT cross-unlock from adventure to time-attack', () => {
    // Completing level 20 (last adventure) with ≥1 star should NOT
    // unlock level 21 (first time-attack).
    const bossRush = ADVENTURE_LEVELS.find(l => l.id === 20)!;
    recordLevelResult(bossRush, bossRush.starThresholds.one);
    const progress = loadProgress();

    // Level 20 itself should be recorded
    assert.ok(progress[20]);
    assert.equal(progress[20].stars, 1);

    // Level 21 must NOT be unlocked by this
    const ta1 = TIME_ATTACK_LEVELS[0];
    assert.ok(!progress[ta1.id] || !progress[ta1.id].unlocked);
  });

  it('unlocks the next time-attack level within the time-attack chain', () => {
    const ta1 = TIME_ATTACK_LEVELS[0];
    recordLevelResult(ta1, ta1.starThresholds.one);
    const progress = loadProgress();
    const ta2 = TIME_ATTACK_LEVELS[1];
    assert.equal(progress[ta2.id]?.unlocked, true);
  });
});

describe('ensureDefault', () => {
  beforeEach(freshStorage);

  it('creates a default entry for level 1 (unlocked)', () => {
    const map: LevelProgressMap = {};
    const entry = ensureDefault(map, 1);
    assert.equal(entry.unlocked, true);
    assert.equal(entry.stars, 0);
    assert.equal(entry.bestScore, 0);
  });

  it('creates a locked default for non-first levels', () => {
    const map: LevelProgressMap = {};
    const entry = ensureDefault(map, 5);
    assert.equal(entry.unlocked, false);
  });

  it('creates an unlocked default for level 21 (first time-attack)', () => {
    const map: LevelProgressMap = {};
    const entry = ensureDefault(map, 21);
    assert.equal(entry.unlocked, true);
  });

  it('does not overwrite existing entries', () => {
    const map: LevelProgressMap = {
      3: { stars: 2, bestScore: 1200, unlocked: true },
    };
    const entry = ensureDefault(map, 3);
    assert.equal(entry.stars, 2);
    assert.equal(entry.bestScore, 1200);
  });
});

describe('saveProgress / loadProgress round-trip', () => {
  beforeEach(freshStorage);

  it('persists and reloads progress data', () => {
    const data: LevelProgressMap = {
      1: { stars: 3, bestScore: 2000, unlocked: true },
      2: { stars: 1, bestScore: 800, unlocked: true },
    };
    saveProgress(data);
    const loaded = loadProgress();
    assert.deepEqual(loaded, data);
  });

  it('uses the correct storage key', () => {
    saveProgress({ 1: { stars: 1, bestScore: 500, unlocked: true } });
    const ls = (globalThis as unknown as { window: { localStorage: { getItem: (k: string) => string | null } } }).window.localStorage;
    const raw = ls.getItem(STORAGE_KEY);
    assert.ok(raw);
    const parsed = JSON.parse(raw!) as LevelProgressMap;
    assert.equal(parsed[1].stars, 1);
  });
});
