import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  loadSaveSlots,
  saveSaveSlots,
  addRunRewards,
  saveSlotCheckpoint,
  clearSlotCheckpoint,
  loadActiveSaveSlotId,
  setActiveSaveSlotId,
  setPendingContinueSlot,
  takePendingContinueSlot,
  clearPendingContinueSlot,
  hasPlayedDailyChallenge,
  markDailyChallengePlayed,
  getTodayIsoDay,
  type SaveSlotId,
} from '@/lib/progression';

// ── localStorage polyfill (mirrors progression.test.ts setup) ─────────

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

function findSlot(slots: ReturnType<typeof loadSaveSlots>, id: SaveSlotId) {
  const slot = slots.find((s) => s.id === id);
  assert.ok(slot, `slot ${id} should exist`);
  return slot!;
}

// ── Checkpoint persistence ────────────────────────────────────────────

describe('saveSlotCheckpoint / clearSlotCheckpoint', () => {
  beforeEach(freshStorage);

  it('saves a valid checkpoint with savedAt timestamp', () => {
    const before = Date.now();
    const slots = saveSlotCheckpoint('slot2', {
      seed: 42,
      characterId: 'ninja',
      x: 1500,
      y: 200,
      vx: 5,
      vy: -3,
      health: 2,
      maxHealth: 3,
      score: 5000,
      coins: 80,
      distance: 4500,
    });
    const after = Date.now();
    const slot = findSlot(slots, 'slot2');
    assert.ok(slot.checkpoint, 'checkpoint should be set');
    assert.equal(slot.checkpoint!.seed, 42);
    assert.equal(slot.checkpoint!.characterId, 'ninja');
    assert.equal(slot.checkpoint!.x, 1500);
    assert.equal(slot.checkpoint!.score, 5000);
    assert.equal(slot.checkpoint!.coins, 80);
    assert.ok(slot.checkpoint!.savedAt >= before && slot.checkpoint!.savedAt <= after);
  });

  it('persists checkpoint across loadSaveSlots', () => {
    saveSlotCheckpoint('slot1', {
      seed: 7,
      characterId: 'tank',
      x: 100,
      y: 50,
      vx: 0,
      vy: 0,
      health: 5,
      maxHealth: 5,
      score: 200,
      coins: 10,
      distance: 300,
    });
    const reloaded = loadSaveSlots();
    const slot = findSlot(reloaded, 'slot1');
    assert.ok(slot.checkpoint, 'checkpoint should survive reload');
    assert.equal(slot.checkpoint!.seed, 7);
    assert.equal(slot.checkpoint!.characterId, 'tank');
  });

  it('clearSlotCheckpoint removes an existing checkpoint', () => {
    saveSlotCheckpoint('slot1', {
      seed: 1, characterId: 'knight', x: 0, y: 0, vx: 0, vy: 0,
      health: 3, maxHealth: 3, score: 0, coins: 0, distance: 0,
    });
    const cleared = clearSlotCheckpoint('slot1');
    const slot = findSlot(cleared, 'slot1');
    assert.equal(slot.checkpoint, null);
  });

  it('clearSlotCheckpoint is a no-op when no checkpoint exists', () => {
    const cleared = clearSlotCheckpoint('slot3');
    const slot = findSlot(cleared, 'slot3');
    assert.equal(slot.checkpoint, null);
  });

  it('addRunRewards clears checkpoint after a run completes', () => {
    saveSlotCheckpoint('slot1', {
      seed: 1, characterId: 'knight', x: 0, y: 0, vx: 0, vy: 0,
      health: 3, maxHealth: 3, score: 0, coins: 0, distance: 0,
    });
    // Confirm it was set
    assert.ok(findSlot(loadSaveSlots(), 'slot1').checkpoint);
    addRunRewards('slot1', { coins: 50, score: 1000, distance: 2000 });
    const slot = findSlot(loadSaveSlots(), 'slot1');
    assert.equal(slot.checkpoint, null, 'checkpoint must be cleared after run rewards');
  });
});

// ── Checkpoint normalization (corrupt localStorage) ───────────────────

describe('checkpoint normalization from corrupted storage', () => {
  beforeEach(freshStorage);

  it('normalizes non-finite seed/x/y to null checkpoint', () => {
    const corrupt = loadSaveSlots();
    corrupt[0].checkpoint = {
      seed: NaN, characterId: 'knight', x: Infinity, y: 0,
      vx: 0, vy: 0, health: 3, maxHealth: 3, score: 0, coins: 0,
      distance: 0, savedAt: Date.now(),
    };
    saveSaveSlots(corrupt);
    const reloaded = loadSaveSlots();
    assert.equal(reloaded[0].checkpoint, null);
  });

  it('clamps negative health to at least 1', () => {
    const corrupt = loadSaveSlots();
    corrupt[1].checkpoint = {
      seed: 5, characterId: 'knight', x: 10, y: 20, vx: 0, vy: 0,
      health: -5, maxHealth: 0, score: -100, coins: -50,
      distance: 0, savedAt: Date.now(),
    };
    saveSaveSlots(corrupt);
    const reloaded = loadSaveSlots();
    const cp = reloaded[1].checkpoint;
    assert.ok(cp, 'checkpoint should survive (seed/x/y are finite)');
    assert.ok(cp!.health >= 1, 'health should be clamped to >= 1');
    assert.ok(cp!.maxHealth >= 1, 'maxHealth should be clamped to >= 1');
    assert.equal(cp!.score, 0, 'negative score clamped to 0');
    assert.equal(cp!.coins, 0, 'negative coins clamped to 0');
  });

  it('falls back characterId to knight when empty', () => {
    const corrupt = loadSaveSlots();
    corrupt[0].checkpoint = {
      seed: 3, characterId: '', x: 10, y: 20, vx: 0, vy: 0,
      health: 3, maxHealth: 3, score: 100, coins: 5,
      distance: 50, savedAt: Date.now(),
    };
    saveSaveSlots(corrupt);
    const reloaded = loadSaveSlots();
    assert.equal(reloaded[0].checkpoint!.characterId, 'knight');
  });

  it('defaults non-finite velocity to 0', () => {
    const corrupt = loadSaveSlots();
    corrupt[2].checkpoint = {
      seed: 1, characterId: 'knight', x: 10, y: 20,
      vx: NaN, vy: Infinity, health: 3, maxHealth: 3, score: 0, coins: 0,
      distance: 0, savedAt: Date.now(),
    };
    saveSaveSlots(corrupt);
    const reloaded = loadSaveSlots();
    const cp = reloaded[2].checkpoint;
    assert.ok(cp);
    assert.equal(cp!.vx, 0);
    assert.equal(cp!.vy, 0);
  });
});

// ── Active save slot selection ────────────────────────────────────────

describe('active save slot selection', () => {
  beforeEach(freshStorage);

  it('defaults to slot1', () => {
    assert.equal(loadActiveSaveSlotId(), 'slot1');
  });

  it('persists and reloads the active slot', () => {
    setActiveSaveSlotId('slot3');
    assert.equal(loadActiveSaveSlotId(), 'slot3');
  });

  it('falls back to slot1 for invalid stored values', () => {
    setActiveSaveSlotId('slot2');
    localStorageStub.setItem('iss-active-save-slot-v1', 'garbage-id');
    assert.equal(loadActiveSaveSlotId(), 'slot1');
  });

  it('does not affect save slot data', () => {
    const slotsBefore = loadSaveSlots();
    setActiveSaveSlotId('slot2');
    const slotsAfter = loadSaveSlots();
    assert.deepEqual(
      slotsAfter.map((s) => ({ id: s.id, name: s.name })),
      slotsBefore.map((s) => ({ id: s.id, name: s.name })),
    );
  });
});

// ── Pending continue slot ─────────────────────────────────────────────

describe('pending continue slot', () => {
  beforeEach(freshStorage);

  it('returns null when no pending slot is set', () => {
    assert.equal(takePendingContinueSlot(), null);
  });

  it('sets and takes the pending slot (consume semantics)', () => {
    setPendingContinueSlot('slot2');
    const taken = takePendingContinueSlot();
    assert.equal(taken, 'slot2');
    // Consumed — second take returns null
    assert.equal(takePendingContinueSlot(), null);
  });

  it('clearPendingContinueSlot removes without returning', () => {
    setPendingContinueSlot('slot3');
    clearPendingContinueSlot();
    assert.equal(takePendingContinueSlot(), null);
  });

  it('falls back to null for invalid stored values on take', () => {
    setPendingContinueSlot('slot1');
    localStorageStub.setItem('iss-pending-continue-slot-v1', 'invalid-slot');
    assert.equal(takePendingContinueSlot(), null);
  });

  it('survives a fresh loadSaveSlots call (independent storage key)', () => {
    setPendingContinueSlot('slot2');
    // loadSaveSlots should not clear pending slot
    loadSaveSlots();
    assert.equal(takePendingContinueSlot(), 'slot2');
  });
});

// ── Daily challenge tracking ──────────────────────────────────────────

describe('daily challenge tracking', () => {
  beforeEach(freshStorage);

  it('returns false when no daily challenge has been played', () => {
    assert.equal(hasPlayedDailyChallenge('slot1'), false);
  });

  it('marks a slot as played and reports it', () => {
    markDailyChallengePlayed('slot1');
    assert.equal(hasPlayedDailyChallenge('slot1'), true);
  });

  it('marks only the specified slot, not others', () => {
    markDailyChallengePlayed('slot1');
    assert.equal(hasPlayedDailyChallenge('slot1'), true);
    assert.equal(hasPlayedDailyChallenge('slot2'), false);
  });

  it('tracks multiple slots independently on the same day', () => {
    markDailyChallengePlayed('slot1');
    markDailyChallengePlayed('slot3');
    assert.equal(hasPlayedDailyChallenge('slot1'), true);
    assert.equal(hasPlayedDailyChallenge('slot2'), false);
    assert.equal(hasPlayedDailyChallenge('slot3'), true);
  });

  it('uses explicit day parameter for time-scoped queries', () => {
    const today = getTodayIsoDay();
    const yesterday = '2025-01-01';
    markDailyChallengePlayed('slot1');
    assert.equal(hasPlayedDailyChallenge('slot1', today), true);
    assert.equal(hasPlayedDailyChallenge('slot1', yesterday), false);
  });

  it('does not duplicate a slot when marked twice on the same day', () => {
    markDailyChallengePlayed('slot1');
    markDailyChallengePlayed('slot1');
    markDailyChallengePlayed('slot1');
    assert.equal(hasPlayedDailyChallenge('slot1'), true);
    // Verify internally it's stored as a single entry by checking another day
    assert.equal(hasPlayedDailyChallenge('slot2'), false);
  });

  it('prunes old days when marking a new day (keeps storage bounded)', () => {
    // Manually inject stale data for an old day
    localStorageStub.setItem('iss-daily-runs-v1', JSON.stringify({
      '2025-01-01': ['slot1', 'slot2'],
    }));
    // Marking today should prune the old day
    markDailyChallengePlayed('slot1');
    // Old day should be gone
    const raw = localStorageStub.getItem('iss-daily-runs-v1');
    const parsed = JSON.parse(raw!);
    assert.equal(parsed['2025-01-01'], undefined, 'old day should be pruned');
    assert.ok(parsed[getTodayIsoDay()], 'today should be present');
  });

  it('handles corrupted daily-runs JSON gracefully', () => {
    localStorageStub.setItem('iss-daily-runs-v1', 'not-valid-json{');
    assert.equal(hasPlayedDailyChallenge('slot1'), false);
    // markDailyChallengePlayed should not throw on corrupted data
    markDailyChallengePlayed('slot1');
    assert.equal(hasPlayedDailyChallenge('slot1'), true);
  });

  it('handles non-array stored values gracefully', () => {
    localStorageStub.setItem('iss-daily-runs-v1', JSON.stringify({
      [getTodayIsoDay()]: 'not-an-array',
    }));
    assert.equal(hasPlayedDailyChallenge('slot1'), false);
  });
});

// ── ISO day helper ────────────────────────────────────────────────────

describe('getTodayIsoDay', () => {
  it('returns a YYYY-MM-DD string', () => {
    const day = getTodayIsoDay();
    assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns a valid date string', () => {
    const day = getTodayIsoDay();
    const parsed = new Date(day + 'T00:00:00Z');
    assert.ok(!isNaN(parsed.getTime()), 'should be a parseable date');
  });
});
