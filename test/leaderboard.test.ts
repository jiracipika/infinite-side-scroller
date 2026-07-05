import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  AVATAR_PRESETS,
  addLeaderboardEntry,
  clearLeaderboard,
  getAvatarPreset,
  loadLeaderboard,
  loadLeaderboardAvatarId,
  loadLeaderboardName,
  sanitizeAvatarId,
  sanitizeLeaderboardName,
  saveLeaderboard,
  saveLeaderboardAvatarId,
  saveLeaderboardName,
  type LeaderboardEntry,
} from '@/lib/leaderboard';

// ── localStorage polyfill for Node test environment ──────────────────

const MEMORY: Record<string, string> = {};

const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  removeItem: (key: string): void => { delete MEMORY[key]; },
  clear: (): void => { for (const k of Object.keys(MEMORY)) delete MEMORY[k]; },
};

// Make it available on globalThis so source modules see it.
const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalAny;
globalAny.localStorage = localStorageStub;

function freshStorage(): void {
  localStorageStub.clear();
}

/** Helper: build a valid entry with sensible defaults for ranking tests. */
function mkEntry(score: number, distance = 0, coins = 0, createdAt = 0): LeaderboardEntry {
  return {
    id: `e-${score}-${distance}-${createdAt}`,
    name: 'Tester',
    avatarId: 'robot_blue',
    score,
    distance,
    coins,
    characterId: 'knight',
    createdAt,
  };
}

// ── Name sanitization ────────────────────────────────────────────────

describe('sanitizeLeaderboardName', () => {
  it('trims leading and trailing whitespace', () => {
    assert.equal(sanitizeLeaderboardName('  ace  '), 'ace');
  });

  it('collapses internal whitespace runs into single spaces', () => {
    assert.equal(sanitizeLeaderboardName('a   b\tc'), 'a b c');
  });

  it('truncates to 20 characters', () => {
    const long = 'x'.repeat(50);
    assert.equal(sanitizeLeaderboardName(long).length, 20);
  });

  it('falls back to "Player" for empty input', () => {
    assert.equal(sanitizeLeaderboardName(''), 'Player');
    assert.equal(sanitizeLeaderboardName('   '), 'Player');
  });

  it('truncates and still collapses whitespace within limit', () => {
    // 25 chars with a gap at position 10 → after collapse 24 → truncated 20
    const result = sanitizeLeaderboardName('0123456789  0123456789012345');
    assert.ok(result.length <= 20);
    assert.ok(!result.includes('  '), 'no double spaces after sanitize');
  });
});

// ── Avatar helpers ───────────────────────────────────────────────────

describe('avatar presets', () => {
  it('AVATAR_PRESETS is non-empty with unique ids', () => {
    assert.ok(AVATAR_PRESETS.length > 0);
    const ids = AVATAR_PRESETS.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, 'avatar ids must be unique');
  });

  it('every preset has a non-empty icon and label', () => {
    for (const p of AVATAR_PRESETS) {
      assert.ok(typeof p.icon === 'string' && p.icon.length > 0);
      assert.ok(typeof p.label === 'string' && p.label.length > 0);
    }
  });
});

describe('getAvatarPreset', () => {
  it('returns the matching preset for a known id', () => {
    const p = getAvatarPreset('knight');
    assert.equal(p.id, 'knight');
  });

  it('falls back to the first preset for unknown id', () => {
    const p = getAvatarPreset('does_not_exist');
    assert.equal(p.id, AVATAR_PRESETS[0].id);
  });

  it('falls back to the first preset for empty string', () => {
    assert.equal(getAvatarPreset('').id, AVATAR_PRESETS[0].id);
  });
});

describe('sanitizeAvatarId', () => {
  it('returns the id when it is a known preset id', () => {
    const known = AVATAR_PRESETS[0].id;
    assert.equal(sanitizeAvatarId(known), known);
  });

  it('falls back to first preset for non-string input', () => {
    assert.equal(sanitizeAvatarId(null), AVATAR_PRESETS[0].id);
    assert.equal(sanitizeAvatarId(undefined), AVATAR_PRESETS[0].id);
    assert.equal(sanitizeAvatarId(42), AVATAR_PRESETS[0].id);
  });

  it('falls back to first preset for unknown string id', () => {
    assert.equal(sanitizeAvatarId('bogus'), AVATAR_PRESETS[0].id);
  });
});

// ── Name persistence ─────────────────────────────────────────────────

describe('leaderboard name persistence', () => {
  beforeEach(freshStorage);

  it('loadLeaderboardName returns "Player" when unset', () => {
    assert.equal(loadLeaderboardName(), 'Player');
  });

  it('saveLeaderboardName / loadLeaderboardName round-trip', () => {
    saveLeaderboardName('Nova');
    assert.equal(loadLeaderboardName(), 'Nova');
  });

  it('saveLeaderboardName sanitizes on write', () => {
    saveLeaderboardName('  nova prime  ');
    assert.equal(loadLeaderboardName(), 'nova prime');
  });

  it('loadLeaderboardName sanitizes corrupt raw value', () => {
    MEMORY['iss-leaderboard-name'] = '   '; // whitespace only
    assert.equal(loadLeaderboardName(), 'Player');
  });
});

// ── Avatar persistence ───────────────────────────────────────────────

describe('leaderboard avatar persistence', () => {
  beforeEach(freshStorage);

  it('loadLeaderboardAvatarId returns first preset when unset', () => {
    assert.equal(loadLeaderboardAvatarId(), AVATAR_PRESETS[0].id);
  });

  it('saveLeaderboardAvatarId / load round-trip', () => {
    const target = AVATAR_PRESETS[1].id;
    saveLeaderboardAvatarId(target);
    assert.equal(loadLeaderboardAvatarId(), target);
  });

  it('load sanitizes unknown stored avatar to first preset', () => {
    MEMORY['iss-leaderboard-avatar-v1'] = 'garbage';
    assert.equal(loadLeaderboardAvatarId(), AVATAR_PRESETS[0].id);
  });
});

// ── Leaderboard load / save / ranking ────────────────────────────────

describe('loadLeaderboard on empty storage', () => {
  beforeEach(freshStorage);

  it('returns an empty array when nothing stored', () => {
    assert.deepEqual(loadLeaderboard(), []);
  });

  it('returns an empty array when stored value is not JSON', () => {
    MEMORY['iss-leaderboard-v1'] = '{not json';
    assert.deepEqual(loadLeaderboard(), []);
  });

  it('returns an empty array when stored value is not an array', () => {
    MEMORY['iss-leaderboard-v1'] = JSON.stringify({ not: 'array' });
    assert.deepEqual(loadLeaderboard(), []);
  });
});

describe('saveLeaderboard / loadLeaderboard round-trip', () => {
  beforeEach(freshStorage);

  it('round-trips a single valid entry', () => {
    const e = mkEntry(500, 100, 3, 1000);
    saveLeaderboard([e]);
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].score, 500);
    assert.equal(loaded[0].name, 'Tester');
  });

  it('persisted entries get a generated id when missing', () => {
    const raw = [{ ...mkEntry(10), id: '' }];
    saveLeaderboard(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 1);
    assert.ok(typeof loaded[0].id === 'string' && loaded[0].id.length > 0, 'id should be generated');
  });
});

// ── Ranking logic — the most critical business rule ─────────────────

describe('ranking order', () => {
  beforeEach(freshStorage);

  it('sorts by score descending (primary)', () => {
    const entries = [mkEntry(100), mkEntry(500), mkEntry(300)];
    saveLeaderboard(entries);
    const loaded = loadLeaderboard();
    assert.deepEqual(loaded.map((e) => e.score), [500, 300, 100]);
  });

  it('breaks ties on distance descending', () => {
    const entries = [
      mkEntry(100, 50, 0, 1),
      mkEntry(100, 200, 0, 2),
      mkEntry(100, 120, 0, 3),
    ];
    saveLeaderboard(entries);
    const loaded = loadLeaderboard();
    assert.deepEqual(
      loaded.map((e) => e.distance),
      [200, 120, 50],
    );
  });

  it('breaks ties on coins descending after distance', () => {
    const entries = [
      mkEntry(100, 100, 5, 1),
      mkEntry(100, 100, 20, 2),
      mkEntry(100, 100, 10, 3),
    ];
    saveLeaderboard(entries);
    const loaded = loadLeaderboard();
    assert.deepEqual(
      loaded.map((e) => e.coins),
      [20, 10, 5],
    );
  });

  it('breaks final tie on createdAt ascending (oldest first)', () => {
    const entries = [
      mkEntry(100, 100, 5, 3000),
      mkEntry(100, 100, 5, 1000),
      mkEntry(100, 100, 5, 2000),
    ];
    saveLeaderboard(entries);
    const loaded = loadLeaderboard();
    assert.deepEqual(
      loaded.map((e) => e.createdAt),
      [1000, 2000, 3000],
    );
  });

  it('full tie-break cascade: score > distance > coins > createdAt', () => {
    // Tie-break chain: score desc → distance desc → coins desc → createdAt asc
    const entries = [
      mkEntry(50, 10, 0, 9),     // lowest score → last
      mkEntry(100, 10, 1, 5),    // tied score+dist, lowest coins → 4th
      mkEntry(100, 50, 0, 1),    // tied score, highest distance → 1st
      mkEntry(100, 10, 5, 3),    // tied score+dist+coins, newer → 3rd
      mkEntry(100, 10, 5, 2),    // tied score+dist+coins, older → 2nd
    ];
    saveLeaderboard(entries);
    const loaded = loadLeaderboard();
    assert.deepEqual(
      loaded.map((e) => [e.score, e.distance, e.coins, e.createdAt]),
      [
        [100, 50, 0, 1],
        [100, 10, 5, 2],
        [100, 10, 5, 3],
        [100, 10, 1, 5],
        [50, 10, 0, 9],
      ],
    );
  });
});

// ── MAX_ENTRIES cap ──────────────────────────────────────────────────

describe('entry cap', () => {
  beforeEach(freshStorage);

  it('load caps to 60 entries', () => {
    const many = Array.from({ length: 100 }, (_, i) => mkEntry(i, 0, 0, i));
    saveLeaderboard(many);
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 60);
  });

  it('cap keeps the top 60 by score (drops lowest scores)', () => {
    // 100 entries, scores 0..990 (index * 10). Top 60 = scores 990 down to 400.
    const many = Array.from({ length: 100 }, (_, i) => mkEntry(i * 10, 0, 0, i));
    saveLeaderboard(many);
    const loaded = loadLeaderboard();
    assert.equal(loaded[0].score, 990);
    assert.equal(loaded[loaded.length - 1].score, 400);
  });
});

// ── Corrupt / malformed data normalization ──────────────────────────

describe('corrupt entry normalization on load', () => {
  beforeEach(freshStorage);

  it('drops entries with missing or invalid name', () => {
    const raw = [
      { ...mkEntry(10), name: '' },
      { ...mkEntry(20), name: '   ' },
      { ...mkEntry(30), name: 'Valid' },
    ];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].score, 30);
  });

  it('drops entries with non-finite score', () => {
    const raw = [
      { ...mkEntry(NaN), name: 'Bad' },
      { ...mkEntry(40), name: 'Good' },
    ];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].score, 40);
  });

  it('clamps negative score/distance/coins to zero', () => {
    const raw = [{ ...mkEntry(-5, -10, -3), name: 'Neg' }];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].score, 0);
    assert.equal(loaded[0].distance, 0);
    assert.equal(loaded[0].coins, 0);
  });

  it('sanitizes unknown avatarId to first preset', () => {
    const raw = [{ ...mkEntry(10), name: 'X', avatarId: 'nonexistent' }];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded[0].avatarId, AVATAR_PRESETS[0].id);
  });

  it('preserves optional maxCombo and enemiesDefeated when valid', () => {
    const raw = [{ ...mkEntry(10), name: 'Combo', maxCombo: 12, enemiesDefeated: 7 }];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded[0].maxCombo, 12);
    assert.equal(loaded[0].enemiesDefeated, 7);
  });

  it('drops optional fields when zero or negative', () => {
    const raw = [{ ...mkEntry(10), name: 'Combo', maxCombo: 0, enemiesDefeated: -1 }];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded[0].maxCombo, undefined);
    assert.equal(loaded[0].enemiesDefeated, undefined);
  });

  it('falls back to "knight" for missing characterId', () => {
    const raw = [{ id: 'x', name: 'NC', avatarId: 'knight', score: 5, distance: 0, coins: 0, createdAt: 1 }];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    assert.equal(loaded[0].characterId, 'knight');
  });

  it('uses now() for missing createdAt', () => {
    const before = Date.now();
    const raw = [{ id: 'x', name: 'NT', avatarId: 'knight', score: 5, distance: 0, coins: 0 }];
    MEMORY['iss-leaderboard-v1'] = JSON.stringify(raw);
    const loaded = loadLeaderboard();
    const after = Date.now();
    assert.ok(loaded[0].createdAt >= before && loaded[0].createdAt <= after,
      'createdAt should fall between before and after');
  });
});

// ── addLeaderboardEntry ──────────────────────────────────────────────

describe('addLeaderboardEntry', () => {
  beforeEach(freshStorage);

  it('adds to an empty board and returns the new entry', () => {
    const added = addLeaderboardEntry({
      name: 'Rookie',
      avatarId: 'knight',
      score: 42,
      distance: 15,
      coins: 2,
      characterId: 'knight',
    });
    assert.ok(typeof added.id === 'string' && added.id.length > 0);
    assert.ok(added.createdAt > 0);
    assert.equal(loadLeaderboard().length, 1);
  });

  it('appends to existing entries', () => {
    saveLeaderboard([mkEntry(10)]);
    addLeaderboardEntry({
      name: 'Second',
      avatarId: 'knight',
      score: 99,
      distance: 0,
      coins: 0,
      characterId: 'knight',
    });
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 2);
    assert.equal(loaded[0].score, 99); // highest first
  });

  it('sanitizes name and avatar on input', () => {
    const added = addLeaderboardEntry({
      name: '  Spaced  ',
      avatarId: 'garbage',
      score: 1,
      distance: 0,
      coins: 0,
      characterId: '',
    });
    assert.equal(added.name, 'Spaced');
    assert.equal(added.avatarId, AVATAR_PRESETS[0].id);
  });

  it('clamps negative inputs to zero', () => {
    const added = addLeaderboardEntry({
      name: 'Neg',
      avatarId: 'knight',
      score: -10,
      distance: -5,
      coins: -2,
      characterId: 'knight',
    });
    assert.equal(added.score, 0);
    assert.equal(added.distance, 0);
    assert.equal(added.coins, 0);
  });

  it('respects the 60-entry cap after many additions', () => {
    for (let i = 0; i < 70; i++) {
      addLeaderboardEntry({
        name: `P${i}`,
        avatarId: 'knight',
        score: i,
        distance: 0,
        coins: 0,
        characterId: 'knight',
      });
    }
    const loaded = loadLeaderboard();
    assert.equal(loaded.length, 60);
    // Highest score should be 69
    assert.equal(loaded[0].score, 69);
  });
});

// ── clearLeaderboard ─────────────────────────────────────────────────

describe('clearLeaderboard', () => {
  beforeEach(freshStorage);

  it('removes all entries', () => {
    saveLeaderboard([mkEntry(10), mkEntry(20)]);
    assert.equal(loadLeaderboard().length, 2);
    clearLeaderboard();
    assert.deepEqual(loadLeaderboard(), []);
  });

  it('is a no-op when nothing is stored', () => {
    clearLeaderboard();
    assert.deepEqual(loadLeaderboard(), []);
  });
});
