/**
 * Per-level difficulty rating — "know before you go".
 *
 * Pure function of authored LevelConfig data (no RNG, no save state) so the
 * level-select card can explain how hard a level plays BEFORE launching it.
 * This is a coarse 3-tier read for UI, not a physics value: it weighs the
 * authored spawn pressures (enemy density, hazard density, enemy variety)
 * plus the boss flag into a single tier.
 */
import type { LevelConfig } from './data/levels';

export type DifficultyTier = 1 | 2 | 3;
export type DifficultyLabel = 'CALM' | 'STEADY' | 'WILD';

export interface LevelDifficultyRating {
  tier: DifficultyTier;
  label: DifficultyLabel;
}

/** Tier cut-offs on the weighted load score. Exported for tests/tuning. */
export const DIFFICULTY_LOAD_CUT_OFFS = { steady: 0.45, wild: 0.72 } as const;

export function rateLevelDifficulty(level: LevelConfig): LevelDifficultyRating {
  // Weights: enemies are the main pressure, hazards second, variety third
  // (more distinct enemy types = more simultaneous mechanics to read), and a
  // boss fight is worth a chunk on its own.
  const variety = Math.min(level.enemies.length, 5) / 5;
  const load =
    level.enemyDensity * 0.5 +
    level.hazardDensity * 0.3 +
    variety * 0.2 +
    (level.boss ? 0.25 : 0);

  const tier: DifficultyTier = load >= DIFFICULTY_LOAD_CUT_OFFS.wild ? 3 : load >= DIFFICULTY_LOAD_CUT_OFFS.steady ? 2 : 1;
  const label: DifficultyLabel = tier === 3 ? 'WILD' : tier === 2 ? 'STEADY' : 'CALM';
  return { tier, label };
}
