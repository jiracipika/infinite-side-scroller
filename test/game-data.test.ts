import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CHARACTERS, BASE_CHARACTER_IDS, isBaseCharacter } from '@/game/data/characters';
import { ALL_LEVELS } from '@/game/data/levels';

// ── Character definitions ────────────────────────────────────────────

describe('character data integrity', () => {
  it('has at least 3 characters', () => {
    assert.ok(CHARACTERS.length >= 3);
  });

  it('has unique character ids', () => {
    const ids = CHARACTERS.map((c) => c.id);
    assert.equal(new Set(ids).size, ids.length, 'character ids must be unique');
  });

  it('all character ids are non-empty strings', () => {
    for (const c of CHARACTERS) {
      assert.ok(typeof c.id === 'string' && c.id.length > 0, `character id must be non-empty, got "${c.id}"`);
    }
  });

  it('all characters have positive maxHealth', () => {
    for (const c of CHARACTERS) {
      assert.ok(c.maxHealth >= 1, `${c.id} maxHealth must be >= 1`);
    }
  });

  it('all unlockCost values are non-negative', () => {
    for (const c of CHARACTERS) {
      assert.ok(c.unlockCost >= 0, `${c.id} unlockCost must be >= 0`);
    }
  });

  it('at least one character is baseUnlocked', () => {
    const baseUnlocked = CHARACTERS.filter((c) => c.baseUnlocked);
    assert.ok(baseUnlocked.length >= 1, 'at least one character must be baseUnlocked');
  });

  it('baseUnlocked characters have zero unlockCost', () => {
    for (const c of CHARACTERS) {
      if (c.baseUnlocked) {
        assert.equal(c.unlockCost, 0, `${c.id} is baseUnlocked but has non-zero cost`);
      }
    }
  });

  it('BASE_CHARACTER_IDS is non-empty and all ids exist in CHARACTERS', () => {
    assert.ok(BASE_CHARACTER_IDS.length > 0);
    const allIds = new Set(CHARACTERS.map((c) => c.id));
    for (const id of BASE_CHARACTER_IDS) {
      assert.ok(allIds.has(id), `BASE_CHARACTER_IDS contains "${id}" which is not in CHARACTERS`);
    }
  });

  it('isBaseCharacter returns true for BASE_CHARACTER_IDS', () => {
    for (const id of BASE_CHARACTER_IDS) {
      assert.equal(isBaseCharacter(id), true, `"${id}" should be a base character`);
    }
  });

  it('isBaseCharacter returns false for non-base characters', () => {
    const nonBase = CHARACTERS.filter((c) => !c.baseUnlocked);
    for (const c of nonBase) {
      assert.equal(isBaseCharacter(c.id), false, `"${c.id}" should NOT be a base character`);
    }
  });
});

// ── Level definitions ────────────────────────────────────────────────

describe('level data integrity', () => {
  it('has at least 20 levels', () => {
    assert.ok(ALL_LEVELS.length >= 20, `expected >= 20 levels, got ${ALL_LEVELS.length}`);
  });

  it('has unique level ids', () => {
    const ids = ALL_LEVELS.map((l) => l.id);
    assert.equal(new Set(ids).size, ids.length, 'level ids must be unique');
  });

  it('all levels have positive targetDistance', () => {
    for (const l of ALL_LEVELS) {
      assert.ok(l.targetDistance > 0, `level ${l.id} targetDistance must be positive`);
    }
  });

  it('all star thresholds are ascending (one <= two <= three)', () => {
    for (const l of ALL_LEVELS) {
      const { one, two, three } = l.starThresholds;
      assert.ok(
        one <= two && two <= three,
        `level ${l.id} thresholds must be ascending: ${one} <= ${two} <= ${three}`,
      );
    }
  });

  it('all densities are in [0, 1] range', () => {
    for (const l of ALL_LEVELS) {
      assert.ok(l.enemyDensity >= 0 && l.enemyDensity <= 1, `level ${l.id} enemyDensity out of range`);
      assert.ok(l.hazardDensity >= 0 && l.hazardDensity <= 1, `level ${l.id} hazardDensity out of range`);
      assert.ok(l.powerUpFrequency >= 0 && l.powerUpFrequency <= 1, `level ${l.id} powerUpFrequency out of range`);
    }
  });

  it('every level has a non-empty name and description', () => {
    for (const l of ALL_LEVELS) {
      assert.ok(typeof l.name === 'string' && l.name.length > 0, `level ${l.id} needs a name`);
      assert.ok(typeof l.description === 'string' && l.description.length > 0, `level ${l.id} needs a description`);
    }
  });
});
