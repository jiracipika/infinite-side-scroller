/**
 * Game module - Player, Enemies, Collectibles, Combat, Input
 */

export { InputManager } from './input';
export type { InputState } from './input';

export { Player } from './entities/Player';
export { Enemy } from './entities/Enemy';
export { Slime } from './entities/Slime';
export { Bat } from './entities/Bat';
export { Skeleton } from './entities/Skeleton';
export { Boss } from './entities/Boss';
export {
  createCollectible,
  spawnCollectiblesForChunk,
  spawnEnemiesForChunk,
} from './entities/Collectibles';
export type { EnemyType, Projectile, Collectible, CollectibleType } from './entities';

export { CombatSystem } from './combat/CombatSystem';
export type { ScoreState } from './combat/CombatSystem';
