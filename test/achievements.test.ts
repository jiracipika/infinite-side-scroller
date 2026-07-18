import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import ACHIEVEMENTS, {
  loadUnlockedAchievements,
  saveUnlockedAchievements,
  loadLifetimeStats,
  saveLifetimeStats,
  checkNewAchievements,
  emptyStats,
  type AchievementStats,
} from '@/lib/achievements';

// ── localStorage polyfill for Node test environment ──────────────────

const MEMORY: Record<string, string> = {};

const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  removeItem: (key: string): void => { delete MEMORY[key]; },
  clear: (): void => { for (const k of Object.keys(MEMORY)) delete MEMORY[k]; },
};

const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalThis;
globalAny.localStorage = localStorageStub;

function freshStorage(): void {
  localStorageStub.clear();
}

// ── Helpers ──────────────────────────────────────────────────────────

function stats(overrides: Partial<AchievementStats> = {}): AchievementStats {
  return { ...emptyStats(), ...overrides };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('emptyStats', () => {
  it('returns all-zero stats', () => {
    const s = emptyStats();
    assert.equal(s.totalGames, 0);
    assert.equal(s.highScore, 0);
    assert.equal(s.bestCombo, 0);
    assert.equal(s.bestKills, 0);
    assert.equal(s.totalKills, 0);
  });
});

describe('achievement definitions', () => {
  it('all achievements have unique ids', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('every condition is a callable function', () => {
    for (const a of ACHIEVEMENTS) {
      assert.equal(typeof a.condition, 'function');
      // Should not throw on empty stats
      a.condition(emptyStats());
    }
  });

  it('no achievement uses a permanently-false condition', () => {
    // All achievements should be unlockable in principle.
    // We verify by checking that at least some stats satisfy each condition.
    const mega = stats({
      totalGames: 200, highScore: 10000, totalDistance: 200000,
      totalCoins: 1000, bestDistance: 20000, bestCoins: 100,
      bestCombo: 100, bestKills: 100, totalKills: 1000,
    });
    // untouchable is special: it requires a great score within the first 3
    // games, so maxed-out veteran stats won't satisfy it. Test it separately.
    const earlyGreat = stats({ highScore: 5000, totalGames: 2 });
    for (const a of ACHIEVEMENTS) {
      const ok = a.id === 'untouchable' ? a.condition(earlyGreat) : a.condition(mega);
      assert.ok(ok, `Achievement "${a.id}" is not satisfiable even with maxed stats`);
    }
  });

  it('untouchable secret is achievable with a great early run', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'untouchable');
    assert.ok(a, 'untouchable achievement should exist');
    assert.ok(a!.secret, 'untouchable should be a secret');
    assert.ok(a!.condition(stats({ highScore: 1000, totalGames: 2 })));
    assert.ok(a!.condition(stats({ highScore: 5000, totalGames: 3 })));
  });

  it('untouchable is NOT granted to veteran players (totalGames > 3)', () => {
    const a = ACHIEVEMENTS.find((x) => x.id === 'untouchable')!;
    assert.ok(!a.condition(stats({ highScore: 5000, totalGames: 4 })));
    assert.ok(!a.condition(stats({ highScore: 5000, totalGames: 50 })));
  });

  it('speed-demon no longer exists (removed: timer tracking was never implemented)', () => {
    assert.ok(!ACHIEVEMENTS.some((a) => a.id === 'speed-demon'));
  });

  it('combo achievements exist with correct thresholds', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.ok(ids.includes('chain-master'));
    assert.ok(ids.includes('combo-king'));
    assert.ok(ids.includes('unstoppable'));

    const ten = ACHIEVEMENTS.find((a) => a.id === 'chain-master')!;
    assert.ok(ten.condition(stats({ bestCombo: 10 })));
    assert.ok(!ten.condition(stats({ bestCombo: 9 })));

    const twentyFive = ACHIEVEMENTS.find((a) => a.id === 'combo-king')!;
    assert.ok(twentyFive.condition(stats({ bestCombo: 25 })));
    assert.ok(!twentyFive.condition(stats({ bestCombo: 24 })));

    const fifty = ACHIEVEMENTS.find((a) => a.id === 'unstoppable')!;
    assert.ok(fifty.condition(stats({ bestCombo: 50 })));
    assert.ok(!fifty.condition(stats({ bestCombo: 49 })));
  });

  it('combat achievements exist with correct thresholds', () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    assert.ok(ids.includes('hunter'));
    assert.ok(ids.includes('slayer'));
    assert.ok(ids.includes('exterminator'));

    const hunter = ACHIEVEMENTS.find((a) => a.id === 'hunter')!;
    assert.ok(hunter.condition(stats({ bestKills: 10 })));
    assert.ok(!hunter.condition(stats({ bestKills: 9 })));

    const slayer = ACHIEVEMENTS.find((a) => a.id === 'slayer')!;
    assert.ok(slayer.condition(stats({ totalKills: 50 })));
    assert.ok(!slayer.condition(stats({ totalKills: 49 })));

    const exterminator = ACHIEVEMENTS.find((a) => a.id === 'exterminator')!;
    assert.ok(exterminator.condition(stats({ totalKills: 500 })));
    assert.ok(!exterminator.condition(stats({ totalKills: 499 })));
  });
});

describe('loadUnlockedAchievements / saveUnlockedAchievements', () => {
  beforeEach(freshStorage);

  it('returns empty array when nothing stored', () => {
    assert.deepEqual(loadUnlockedAchievements(), []);
  });

  it('round-trips through localStorage', () => {
    saveUnlockedAchievements(['first-flight', 'centurion']);
    assert.deepEqual(loadUnlockedAchievements(), ['first-flight', 'centurion']);
  });

  it('returns [] on corrupted JSON', () => {
    MEMORY['iss-achievements'] = '{broken';
    assert.deepEqual(loadUnlockedAchievements(), []);
  });
});

describe('loadLifetimeStats / saveLifetimeStats', () => {
  beforeEach(freshStorage);

  it('returns emptyStats when nothing stored', () => {
    assert.deepEqual(loadLifetimeStats(), emptyStats());
  });

  it('round-trips through localStorage', () => {
    const s = stats({ totalGames: 5, highScore: 300, bestCombo: 15 });
    saveLifetimeStats(s);
    assert.deepEqual(loadLifetimeStats(), s);
  });

  it('returns emptyStats on corrupted JSON', () => {
    MEMORY['iss-lifetime-stats'] = '{broken';
    assert.deepEqual(loadLifetimeStats(), emptyStats());
  });

  it('backfills missing combo/kill fields from legacy saves', () => {
    // Simulate a save from before bestCombo/bestKills/totalKills existed.
    MEMORY['iss-lifetime-stats'] = JSON.stringify({
      totalGames: 10, highScore: 800, totalDistance: 5000,
      totalCoins: 200, bestDistance: 1000, bestCoins: 30,
    });
    const loaded = loadLifetimeStats();
    assert.equal(loaded.totalGames, 10);
    assert.equal(loaded.highScore, 800);
    assert.equal(loaded.bestCombo, 0);
    assert.equal(loaded.bestKills, 0);
    assert.equal(loaded.totalKills, 0);
  });
});

describe('checkNewAchievements', () => {
  beforeEach(freshStorage);

  it('returns empty array when nothing new', () => {
    const result = checkNewAchievements([], emptyStats());
    // first-flight unlocks on totalGames >= 1, so empty stats unlock nothing.
    assert.equal(result.length, 0);
  });

  it('detects first-flight after first game', () => {
    const result = checkNewAchievements([], stats({ totalGames: 1 }));
    assert.ok(result.includes('first-flight'));
  });

  it('does not re-report already-unlocked achievements', () => {
    const s = stats({ totalGames: 1, highScore: 100 });
    const result = checkNewAchievements(['first-flight', 'centurion'], s);
    assert.ok(!result.includes('first-flight'));
    assert.ok(!result.includes('centurion'));
  });

  it('detects multiple new achievements at once', () => {
    const s = stats({
      totalGames: 1, highScore: 500, totalCoins: 1, bestCombo: 10,
    });
    const result = checkNewAchievements([], s);
    assert.ok(result.includes('first-flight'));
    assert.ok(result.includes('centurion'));
    assert.ok(result.includes('high-roller'));
    assert.ok(result.includes('penny'));
    assert.ok(result.includes('chain-master'));
  });

  it('detects combo milestone unlocks', () => {
    const s = stats({ bestCombo: 25 });
    const result = checkNewAchievements([], s);
    assert.ok(result.includes('chain-master'));
    assert.ok(result.includes('combo-king'));
    assert.ok(!result.includes('unstoppable'));
  });

  it('detects combat milestone unlocks', () => {
    const s = stats({ bestKills: 10, totalKills: 50 });
    const result = checkNewAchievements([], s);
    assert.ok(result.includes('hunter'));
    assert.ok(result.includes('slayer'));
    assert.ok(!result.includes('exterminator'));
  });
});

describe('achievement progress', () => {
  // Helper: find an achievement by id (throws if missing, like a test should).
  function find(id: string) {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    if (!a) throw new Error(`achievement ${id} not found`);
    return a;
  }

  it('every non-secret achievement exposes a progress callback', () => {
    const nonSecrets = ACHIEVEMENTS.filter((a) => !a.secret);
    assert.ok(nonSecrets.length >= 15, 'expected several non-secret achievements');
    for (const a of nonSecrets) {
      assert.equal(typeof a.progress, 'function', `${a.id} should expose progress`);
    }
  });

  it('secret achievements do not expose progress (would leak the target)', () => {
    for (const a of ACHIEVEMENTS) {
      if (a.secret) {
        assert.equal(a.progress, undefined, `secret ${a.id} must not expose progress`);
      }
    }
  });

  it('progress is clamped to [0, target] (never negative, never exceeds target)', () => {
    const a = find('centurion'); // target 100
    const empty = a.progress!(emptyStats())!;
    assert.equal(empty.current, 0);
    assert.equal(empty.target, 100);

    const partial = a.progress!(stats({ highScore: 40 }))!;
    assert.equal(partial.current, 40);
    assert.ok(partial.current <= partial.target, 'partial should not exceed target');

    // A run that overshoots should report current === target (clamped), not beyond.
    const overshoot = a.progress!(stats({ highScore: 9999 }))!;
    assert.equal(overshoot.current, overshoot.target, 'overshoot should clamp to target');
  });

  it('progress.current equals target exactly when condition is satisfied', () => {
    // For every non-secret achievement, when the unlock condition holds,
    // the progress bar should read 100% (current === target). This guards
    // against the two falling out of sync.
    for (const a of ACHIEVEMENTS) {
      if (a.secret || !a.progress) continue;
      const mega = stats({
        totalGames: 10_000,
        highScore: 1_000_000,
        totalDistance: 1_000_000,
        totalCoins: 1_000_000,
        bestDistance: 1_000_000,
        bestCoins: 1_000_000,
        bestCombo: 1_000,
        bestKills: 1_000,
        totalKills: 1_000_000,
      });
      const p = a.progress(mega)!;
      assert.equal(p.current, p.target, `${a.id}: progress should be at target when unlocked`);
      assert.ok(a.condition(mega), `${a.id}: condition should hold for mega stats`);
    }
  });

  it('progress reflects the stat named in the description', () => {
    // Spot-check a few to make sure each milestone tracks the right field.
    assert.equal(find('centurion').progress!(stats({ highScore: 25 }))!.current, 25);
    assert.equal(find('marathon').progress!(stats({ bestDistance: 1500 }))!.current, 1500);
    assert.equal(find('tycoon').progress!(stats({ bestCoins: 12 }))!.current, 12);
    assert.equal(find('rich').progress!(stats({ totalCoins: 200 }))!.current, 200);
    assert.equal(find('regular').progress!(stats({ totalGames: 3 }))!.current, 3);
    assert.equal(find('chain-master').progress!(stats({ bestCombo: 7 }))!.current, 7);
    assert.equal(find('slayer').progress!(stats({ totalKills: 30 }))!.current, 30);
    assert.equal(find('hunter').progress!(stats({ bestKills: 4 }))!.current, 4);
  });
});
