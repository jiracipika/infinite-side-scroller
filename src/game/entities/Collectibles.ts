/**
 * Collectible types: coins, health, speed boost, double jump
 */

import type { EnemyType } from './Enemy';

export type CollectibleType = 'coin' | 'health' | 'speedBoost' | 'doubleJump' | 'shield' | 'magnet';

export interface Collectible {
  x: number;
  y: number;
  width: number;
  height: number;
  type: CollectibleType;
  chunkId: number;
  collected: boolean;
  animTimer: number;
  value: number; // score value for coins, duration for boosts
}

const ENEMY_HEIGHTS: Record<string, number> = {
  slime: 24,
  beetle: 16,
  wisp: 18,
  bat: 20,
  mite: 18,
  jumper: 28,
  skeleton: 44,
  alien: 34,
  ufo: 28,
  boss: 64,
};

const ENEMY_WIDTHS: Record<string, number> = {
  slime: 28,
  beetle: 22,
  wisp: 18,
  bat: 28,
  mite: 20,
  jumper: 24,
  skeleton: 28,
  alien: 26,
  ufo: 58,
  boss: 56,
};

/** Create a collectible */
export function createCollectible(
  x: number, y: number, type: CollectibleType, chunkId: number
): Collectible {
  const sizes: Record<CollectibleType, { w: number; h: number; value: number }> = {
    coin: { w: 16, h: 16, value: 10 },
    health: { w: 18, h: 18, value: 1 },
    speedBoost: { w: 20, h: 20, value: 5 },
    doubleJump: { w: 20, h: 20, value: 10 },
    shield: { w: 20, h: 20, value: 1 },
    magnet: { w: 20, h: 20, value: 8 },
  };
  const s = sizes[type];
  return { x, y, width: s.w, height: s.h, type, chunkId, collected: false, animTimer: 0, value: s.value };
}

/** Spawn collectibles for a chunk based on seed */
export function spawnCollectiblesForChunk(
  chunkId: number,
  chunkX: number,
  chunkWidth: number,
  platforms: { x: number; y: number; width: number }[],
  rng: (seed: number) => number,
  terrainHeights?: number[],
): Collectible[] {
  const collectibles: Collectible[] = [];
  // Simple seeded RNG based on chunk
  const base = chunkId * 13337;

  // Spawn 2-5 coin groups
  const numGroups = 2 + Math.abs(Math.floor(rng(base + 1) * 4));
  for (let g = 0; g < numGroups; g++) {
    // Determine type
    const typeRoll = rng(base + g * 10 + 3);
    let type: CollectibleType = 'coin';
    if (typeRoll > 0.94) type = 'shield';
    else if (typeRoll > 0.89) type = 'magnet';
    else if (typeRoll > 0.84) type = 'health';
    else if (typeRoll > 0.79) type = 'speedBoost';
    else if (typeRoll > 0.75) type = 'doubleJump';

    const count = type === 'coin' ? 3 + Math.floor(rng(base + g * 10 + 4) * 4) : 1;

    // Try platform placement first
    if (platforms.length > 0) {
      const platIdx = Math.floor(rng(base + g * 10 + 2) * platforms.length);
      if (platIdx < platforms.length) {
        const plat = platforms[platIdx];
        const startX = plat.x + (rng(base + g * 10 + 5) * (plat.width - count * 20));
        for (let i = 0; i < count; i++) {
          collectibles.push(createCollectible(startX + i * 20, plat.y - 20, type, chunkId));
        }
        continue;
      }
    }

    // Ground placement using terrain heights
    if (terrainHeights && terrainHeights.length > 0) {
      const startX = rng(base + g * 10 + 6) * (chunkWidth - count * 20 - 40) + 20;
      for (let i = 0; i < count; i++) {
        const px = startX + i * 20;
        const heightIdx = Math.min(Math.floor(px / 4), terrainHeights.length - 1);
        const groundY = terrainHeights[Math.max(heightIdx, 0)];
        collectibles.push(createCollectible(chunkX + px, groundY - 20, type, chunkId));
      }
    }
  }

  return collectibles;
}

/** Spawn enemies for a chunk.
 *  Enemies are placed on ground terrain by default (using terrainHeights).
 *  If platforms are available, some enemies (bats, ranged types) can be placed on them.
 */
export function spawnEnemiesForChunk(
  chunkId: number,
  platforms: { x: number; y: number; width: number }[],
  rng: (seed: number) => number,
  terrainHeights?: number[],
  chunkWorldX?: number,
  progressionLevel: number = Math.max(0, Math.floor(((chunkWorldX ?? chunkId * 800) / 4000))),
): { type: EnemyType; x: number; y: number; chunkId: number }[] {
  const enemies: { type: EnemyType; x: number; y: number; chunkId: number }[] = [];
  const base = chunkId * 7777;
  const count = 2 + Math.floor(rng(base + 100) * 4) + Math.min(3, Math.floor(progressionLevel / 2));
  const enemyPool: EnemyType[] = ['slime', 'beetle'];
  if (progressionLevel >= 1) enemyPool.push('wisp');
  if (progressionLevel >= 1) enemyPool.push('jumper');
  if (progressionLevel >= 2) enemyPool.push('skeleton');
  if (progressionLevel >= 2) enemyPool.push('mite');
  if (progressionLevel >= 3) enemyPool.push('alien');
  if (progressionLevel >= 3) enemyPool.push('bat');
  if (progressionLevel >= 4) enemyPool.push('ufo');

  for (let i = 0; i < count; i++) {
    const roll = rng(base + i * 20 + 102);
    const type = enemyPool[Math.min(enemyPool.length - 1, Math.floor(roll * enemyPool.length))];

    // Place on platform if available and enemy type benefits from it
    if (platforms.length > 0 && (type === 'bat' || type === 'wisp' || type === 'ufo' || rng(base + i * 20 + 104) < 0.3)) {
      const platIdx = Math.floor(rng(base + i * 20 + 101) * platforms.length);
      if (platIdx < platforms.length) {
        const plat = platforms[platIdx];
        enemies.push({
          type,
          x: plat.x + rng(base + i * 20 + 103) * Math.max(1, plat.width - (ENEMY_WIDTHS[type] ?? 28)),
          y: type === 'ufo' ? plat.y - 140 : type === 'wisp' ? plat.y - 72 : plat.y - (ENEMY_HEIGHTS[type] ?? 30),
          chunkId,
        });
        continue;
      }
    }

    // Ground placement using terrain heights
    if (terrainHeights && terrainHeights.length > 0 && chunkWorldX !== undefined) {
      const CHUNK_WIDTH = 800;
      const x = rng(base + i * 20 + 105) * (CHUNK_WIDTH - 100) + 50;
      const heightIdx = Math.floor(x / 4);
      const safeIdx = Math.min(Math.max(heightIdx, 0), terrainHeights.length - 1);
      const groundY = terrainHeights[safeIdx];

      enemies.push({
        type,
        x: chunkWorldX + x,
        y: type === 'ufo' ? groundY - 165 : type === 'wisp' ? groundY - 95 : groundY - (ENEMY_HEIGHTS[type] ?? 30),
        chunkId,
      });
    }
  }

  // Boss every 50 chunks
  if (chunkId > 0 && chunkId % 50 === 0) {
    const CHUNK_WIDTH = 800;
    if (platforms.length > 0) {
      const plat = platforms[0];
      enemies.push({
        type: 'boss',
        x: plat.x + plat.width / 2 - 28,
        y: plat.y - ENEMY_HEIGHTS.boss,
        chunkId,
      });
    } else if (terrainHeights && terrainHeights.length > 0 && chunkWorldX !== undefined) {
      // Place boss on ground if no platforms
      const midIdx = Math.floor(terrainHeights.length / 2);
      enemies.push({
        type: 'boss',
        x: chunkWorldX + CHUNK_WIDTH / 2 - 28,
        y: terrainHeights[midIdx] - ENEMY_HEIGHTS.boss,
        chunkId,
      });
    }
  }

  return enemies;
}
