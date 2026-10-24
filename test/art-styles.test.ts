import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  addRunRewards,
  characterArtStyle,
  loadActiveSaveSlotId,
  loadSaveSlots,
  resetSaveSlot,
  setActiveSaveSlotId,
  setCharacterArtStyle,
  type SaveSlotId,
} from '@/lib/progression';
import {
  preferredArtStyle,
  setPreferredArtStyle,
  sheetFrameForPose,
  SHEET_FRAME,
} from '@/game/rendering/sprite-sheet';

// ── localStorage polyfill for Node test environment ──────────────────

const MEMORY: Record<string, string> = {};

const localStorageStub = {
  getItem: (key: string): string | null => MEMORY[key] ?? null,
  setItem: (key: string, value: string): void => { MEMORY[key] = value; },
  removeItem: (key: string, ): void => { delete MEMORY[key]; },
  clear: (): void => { for (const k of Object.keys(MEMORY)) delete MEMORY[k]; },
};

const globalAny = globalThis as Record<string, unknown>;
if (!globalAny.window) globalAny.window = globalAny;
globalAny.localStorage = localStorageStub;

function freshStorage(): void {
  localStorageStub.clear();
  setActiveSaveSlotId('slot1');
  resetSaveSlot('slot1');
}

const slot = (id: SaveSlotId = 'slot1') => {
  const slots = loadSaveSlots();
  const found = slots.find((s) => s.id === id);
  assert.ok(found, 'slot exists');
  return found;
};

// ── Per-character run history ─────────────────────────────────────────

describe('per-character run history', () => {
  beforeEach(freshStorage);

  it('counts rounds per character, not globally', () => {
    addRunRewards('slot1', { coins: 0, score: 0, distance: 0 }, 'ninja');
    addRunRewards('slot1', { coins: 0, score: 0, distance: 0 }, 'knight');
    const s = slot();
    assert.equal(s.roundsByCharacter['ninja'], 1);
    assert.equal(s.roundsByCharacter['knight'], 1);
  });

  it('stays backward compatible when a run ships no character id', () => {
    const before = slot().totalRuns;
    addRunRewards('slot1', { coins: 5, score: 10, distance: 20 });
    const s = slot();
    assert.equal(s.totalRuns, before + 1);
    assert.deepEqual(s.roundsByCharacter, {});
  });

  it('normalizes legacy slot data missing the new fields', () => {
    localStorageStub.setItem('iss-save-slots-v1', JSON.stringify([{
      id: 'slot1', name: 'Old save', createdAt: 0, updatedAt: 0,
      bankCoins: 10, spentCoins: 0, lifetimeCoinsCollected: 0,
      bestScore: 0, bestDistance: 0, bestCombo: 0, bestKills: 0, totalRuns: 3,
      unlockedUpgradeIds: [], unlockedCharacterIds: [], checkpoint: null,
    }]));
    const s = slot();
    assert.deepEqual(s.roundsByCharacter, {});
    assert.deepEqual(s.artStyleByCharacter, {});
    // Default identity: absent preference rides the full-art redesign.
    assert.equal(characterArtStyle(s, 'knight'), 'fullart');
  });
});

// ── Style choice + guards ────────────────────────────────────────────

describe('character art style choice', () => {
  beforeEach(freshStorage);

  it('defaults to the full-art redesign', () => {
    assert.equal(characterArtStyle(slot(), 'ninja'), 'fullart');
  });

  it('accepts ink immediately and remembers the choice', () => {
    assert.equal(setCharacterArtStyle('slot1', 'ninja', 'ink').ok, true);
    assert.equal(characterArtStyle(slot(), 'ninja'), 'ink');
  });

  it('always allows switching to pixel and back', () => {
    assert.equal(setCharacterArtStyle('slot1', 'knight', 'pixel').ok, true);
    assert.equal(characterArtStyle(slot(), 'knight'), 'pixel');
    assert.equal(setCharacterArtStyle('slot1', 'knight', 'ink').ok, true);
    assert.equal(characterArtStyle(slot(), 'knight'), 'ink');
  });

  it('returns to the full-art default after an alternative was chosen', () => {
    assert.equal(setCharacterArtStyle('slot1', 'knight', 'pixel').ok, true);
    assert.equal(setCharacterArtStyle('slot1', 'knight', 'fullart').ok, true);
    assert.equal(characterArtStyle(slot(), 'knight'), 'fullart');
  });

  it('rejects unknown styles and missing slots', () => {
    // @ts-expect-error bad style on purpose
    assert.equal(setCharacterArtStyle('slot1', 'knight', 'crayon').ok, false);
    assert.equal(setCharacterArtStyle('slot9' as SaveSlotId, 'knight', 'ink').ok, false);
  });
});

// ── Renderer preference plumbing ─────────────────────────────────────

describe('sprite-sheet art-style preference', () => {
  it('defaults to the full-art lane and honors explicit switches', () => {
    assert.equal(preferredArtStyle('ninja'), 'fullart');
    setPreferredArtStyle('ninja', 'pixel');
    assert.equal(preferredArtStyle('ninja'), 'pixel');
    setPreferredArtStyle('ninja', 'ink');
    assert.equal(preferredArtStyle('ninja'), 'ink');
    // 'fullart' clears the explicit choice back to the character default.
    setPreferredArtStyle('ninja', 'fullart');
    assert.equal(preferredArtStyle('ninja'), 'fullart');
  });

  it('keeps the pose→frame mapping stable', () => {
    assert.equal(sheetFrameForPose({ tumble: 0.5, dashing: true }), SHEET_FRAME.tumble);
    assert.equal(sheetFrameForPose({ airborne: true }), SHEET_FRAME.air);
  });
});
