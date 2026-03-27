/**
 * Collectible types: coins, health, speed boost, double jump
 */

export type CollectibleType = 'coin' | 'health' | 'speedBoost' | 'doubleJump';

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

/** Create a collectible */
export function createCollectible(
  x: number, y: number, type: CollectibleType, chunkId: number
): Collectible {
  const sizes: Record<CollectibleType, { w: number; h: number; value: number }> = {
    coin: { w: 16, h: 16, value: 10 },
    health: { w: 18, h: 18, value: 1 },
    speedBoost: { w: 20, h: 20, value: 5 },
    doubleJump: { w: 20, h: 20, value: 10 },
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
  rng: (seed: number) => number
): Collectible[] {
  const collectibles: Collectible[] = [];
  // Simple seeded RNG based on chunk
  const base = chunkId * 13337;

  // Spawn 2-5 coin groups
  const numGroups = 2 + Math.abs(Math.floor(rng(base + 1) * 4));
  for (let g = 0; g < numGroups; g++) {
    const platIdx = Math.floor(rng(base + g * 10 + 2) * platforms.length);
    if (platIdx >= platforms.length) continue;
    const plat = platforms[platIdx];

    // Determine type
    const typeRoll = rng(base + g * 10 + 3);
    let type: CollectibleType = 'coin';
    if (typeRoll > 0.92) type = 'health';
    else if (typeRoll > 0.86) type = 'speedBoost';
    else if (typeRoll > 0.82) type = 'doubleJump';

    // Place on platform
    const count = type === 'coin' ? 3 + Math.floor(rng(base + g * 10 + 4) * 4) : 1;
    const startX = plat.x + (rng(base + g * 10 + 5) * (plat.width - count * 20));

    for (let i = 0; i < count; i++) {
      collectibles.push(createCollectible(
        startX + i * 20,
        plat.y - 20,
        type,
        chunkId
      ));
    }
  }

  return collectibles;
}

/** Spawn enemies for a chunk */
export function spawnEnemiesForChunk(
  chunkId: number,
  platforms: { x: number; y: number; width: number }[],
  rng: (seed: number) => number
): { type: string; x: number; y: number; chunkId: number }[] {
  const enemies: { type: string; x: number; y: number; chunkId: number }[] = [];
  const base = chunkId * 7777;
  const count = 2 + Math.floor(rng(base + 100) * 4);

  for (let i = 0; i < count; i++) {
    const platIdx = Math.floor(rng(base + i * 20 + 101) * platforms.length);
    if (platIdx >= platforms.length) continue;
    const plat = platforms[platIdx];
    const roll = rng(base + i * 20 + 102);

    let type: string;
    if (roll < 0.5) type = 'slime';
    else if (roll < 0.75) type = 'bat';
    else type = 'skeleton';

    enemies.push({
      type,
      x: plat.x + rng(base + i * 20 + 103) * plat.width,
      y: plat.y - 30,
      chunkId,
    });
  }

  // Boss every 50 chunks
  if (chunkId > 0 && chunkId % 50 === 0 && platforms.length > 0) {
    const plat = platforms[0];
    enemies.push({
      type: 'boss',
      x: plat.x + plat.width / 2 - 28,
      y: plat.y - 70,
      chunkId,
    });
  }

  return enemies;
}
