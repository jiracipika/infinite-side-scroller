/**
 * Difficulty scaling — increases enemy density, speed, and aggression over distance.
 */

export interface DifficultyConfig {
  /** Multiplier for enemy speed */
  speedMult: number;
  /** Multiplier for enemy count */
  densityMult: number;
  /** Multiplier for enemy damage */
  damageMult: number;
  /** Multiplier for enemy HP */
  healthMult: number;
  /** Detection range multiplier (chase distance) */
  detectRangeMult: number;
  /** Shoot cooldown multiplier (lower = more aggressive) */
  shootCooldownMult: number;
}

/** Get difficulty config based on distance traveled */
export function getDifficulty(distanceTraveled: number): DifficultyConfig {
  // Difficulty ramps up over ~10000 pixels
  const t = Math.min(distanceTraveled / 10000, 1);

  return {
    speedMult: 1 + t * 0.8,
    densityMult: 1 + t * 1.5,
    damageMult: 1 + t * 0.5,
    healthMult: 1 + t * 0.5,
    detectRangeMult: 1 + t * 0.5,
    shootCooldownMult: Math.max(0.4, 1 - t * 0.4),
  };
}
