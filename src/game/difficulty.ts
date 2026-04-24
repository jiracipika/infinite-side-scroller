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
  // Primary ramp: 0→1 over first 12000 pixels
  const t = Math.min(distanceTraveled / 12000, 1);
  // Secondary slow ramp: continues past 12000 pixels indefinitely
  const extra = Math.max(0, (distanceTraveled - 12000) / 40000);

  return {
    speedMult: 1 + t * 0.8 + extra * 0.5,
    // densityMult is a FRACTION of the max possible spawns to use (0.4 = 40%, 1.0 = 100%)
    // Used as: targetCount = ceil(spawns.length * densityMult) in spawnChunkEntities
    densityMult: Math.min(0.65 + t * 0.6 + extra * 0.3, 2.0),
    damageMult: 1 + t * 0.5 + extra * 0.3,
    healthMult: 1 + t * 0.5 + extra * 0.3,
    detectRangeMult: 1 + t * 0.5 + extra * 0.2,
    shootCooldownMult: Math.max(0.25, 1 - t * 0.5 - extra * 0.1),
  };
}
