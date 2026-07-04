import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  createCollectible,
  spawnCollectiblesForChunk,
  spawnEnemiesForChunk,
  type CollectibleType,
} from '@/game/entities/Collectibles';

// Deterministic seeded RNG for reproducible spawn tests.
// Matches the (seed: number) => number signature used by the game.
function makeSeededRng(seedValue: number): (seed: number) => number {
  return (_seed: number): number => {
    // Simple LCG — deterministic per seedValue
    seedValue = (seedValue * 1664525 + 1013904223) % 0xffffffff;
    return (seedValue >>> 0) / 0xffffffff;
  };
}

// ── createCollectible ────────────────────────────────────────────────

describe('createCollectible', () => {
  const ALL_TYPES: CollectibleType[] = [
    'coin', 'health', 'speedBoost', 'doubleJump', 'shield',
    'magnet', 'slingshot', 'bow', 'healingAura', 'portal',
  ];

  for (const type of ALL_TYPES) {
    it(`creates valid collectible for type "${type}"`, () => {
      const c = createCollectible(100, 200, type, 5);
      assert.equal(c.x, 100);
      assert.equal(c.y, 200);
      assert.equal(c.type, type);
      assert.equal(c.chunkId, 5);
      assert.equal(c.collected, false);
      assert.equal(c.animTimer, 0);
      assert.ok(c.width > 0, `${type} width should be positive`);
      assert.ok(c.height > 0, `${type} height should be positive`);
      assert.ok(c.value > 0, `${type} value should be positive`);
    });
  }

  it('sets portal-specific properties to undefined by default', () => {
    const c = createCollectible(0, 0, 'portal', 1);
    assert.equal(c.portalTargetX, undefined);
    assert.equal(c.portalFlavor, undefined);
  });
});

// ── spawnCollectiblesForChunk ────────────────────────────────────────

describe('spawnCollectiblesForChunk', () => {
  it('produces at least some collectibles for a normal chunk', () => {
    const rng = makeSeededRng(42);
    const collectibles = spawnCollectiblesForChunk(
      1, // chunkId
      0, // chunkX
      800, // chunkWidth
      [{ x: 100, y: 300, width: 200 }], // platforms
      rng,
      [300, 300, 310, 310], // terrainHeights
      0, // progressionLevel
    );
    assert.ok(collectibles.length > 0, 'should spawn at least one collectible');
  });

  it('assigns correct chunkId to all spawned collectibles', () => {
    const rng = makeSeededRng(99);
    const chunkId = 7;
    const collectibles = spawnCollectiblesForChunk(
      chunkId,
      chunkId * 800,
      800,
      [{ x: 100, y: 300, width: 200 }],
      rng,
      [300, 300, 310],
      0,
    );
    for (const c of collectibles) {
      assert.equal(c.chunkId, chunkId);
    }
  });

  it('coins always spawn in groups (minimum 3 per chunk)', () => {
    // Each coin group has 3-6 coins; a chunk has 2-5 groups.
    // If a chunk has any coins, there should be at least 3.
    const rng = makeSeededRng(1);
    let checkedAnyChunk = false;
    for (let trial = 0; trial < 30; trial++) {
      const collectibles = spawnCollectiblesForChunk(
        trial + 1, trial * 800, 800,
        [], rng, [300, 300, 300, 300], 0,
      );
      const coins = collectibles.filter((c) => c.type === 'coin');
      if (coins.length > 0) {
        assert.ok(
          coins.length >= 3,
          `chunk with coins should have >= 3, got ${coins.length}`,
        );
        checkedAnyChunk = true;
      }
    }
    assert.ok(checkedAnyChunk, 'should have found at least one chunk with coins');
  });

  it('respects progressionLevel gating for advanced items', () => {
    // healingAura requires progressionLevel >= 3; bow >= 2; slingshot >= 1
    const rng = makeSeededRng(50);
    const lowLevel = spawnCollectiblesForChunk(
      1, 0, 800, [{ x: 100, y: 300, width: 200 }], rng, [300], 0,
    );
    // At progressionLevel 0, should never see advanced items
    const advanced = lowLevel.filter(
      (c) => c.type === 'healingAura' || c.type === 'bow' || c.type === 'slingshot',
    );
    assert.equal(advanced.length, 0, 'should not spawn advanced items at level 0');
  });
});

// ── spawnEnemiesForChunk ─────────────────────────────────────────────

describe('spawnEnemiesForChunk', () => {
  it('spawns enemies for a normal chunk with terrain', () => {
    const rng = makeSeededRng(200);
    const enemies = spawnEnemiesForChunk(
      3, // chunkId
      [{ x: 100, y: 300, width: 200 }], // platforms
      rng,
      [300, 300, 310, 310, 320, 320], // terrainHeights
      3 * 800, // chunkWorldX
      0, // progressionLevel
    );
    assert.ok(enemies.length > 0, 'should spawn at least one enemy');
    for (const e of enemies) {
      assert.equal(e.chunkId, 3);
      assert.ok(e.x >= 0, 'enemy x should be non-negative');
    }
  });

  it('only spawns basic enemies (slime/beetle) at progressionLevel 0', () => {
    const rng = makeSeededRng(300);
    const enemies = spawnEnemiesForChunk(
      1, [], rng, [300, 300, 300, 300], 0, 0,
    );
    const types = new Set(enemies.map((e) => e.type));
    for (const t of types) {
      assert.ok(
        t === 'slime' || t === 'beetle',
        `progressionLevel 0 should only have basic enemies, got "${t}"`,
      );
    }
  });

  it('spawns a boss every 50 chunks', () => {
    const rng = makeSeededRng(400);
    // chunkId 50 should trigger boss
    const enemies = spawnEnemiesForChunk(
      50, [{ x: 100, y: 300, width: 200 }], rng,
      [300, 300, 300, 300], 50 * 800, 2,
    );
    const bosses = enemies.filter((e) => e.type === 'boss');
    assert.ok(bosses.length >= 1, 'chunk 50 should spawn a boss');
  });

  it('does NOT spawn a boss on non-50 chunks', () => {
    const rng = makeSeededRng(500);
    const enemies = spawnEnemiesForChunk(
      49, [{ x: 100, y: 300, width: 200 }], rng,
      [300, 300, 300], 49 * 800, 2,
    );
    const bosses = enemies.filter((e) => e.type === 'boss');
    assert.equal(bosses.length, 0, 'chunk 49 should not spawn a boss');
  });

  it('introduces advanced enemy types at higher progression levels', () => {
    const rng = makeSeededRng(600);
    // progressionLevel >= 4 unlocks UFO; try multiple chunks to find variety
    const allTypes = new Set<string>();
    for (let chunk = 10; chunk < 20; chunk++) {
      const enemies = spawnEnemiesForChunk(
        chunk, [], rng, [300, 300, 300, 300], chunk * 800, 4,
      );
      for (const e of enemies) allTypes.add(e.type);
    }
    // At progressionLevel 4, we should see more than just slime+beetle
    assert.ok(allTypes.size > 2, `expected >2 enemy types at level 4, got ${[...allTypes].join(', ')}`);
  });
});
