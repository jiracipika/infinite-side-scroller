/**
 * Seeded PRNG using the mulberry32 algorithm.
 * Deterministic: same seed always produces same sequence.
 */

export function createRng(seed: number) {
  let state = seed | 0; // Ensure integer

  /** Returns a float in [0, 1) */
  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [min, max] inclusive */
  function nextInt(min: number, max: number): number {
    return Math.floor(next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max) */
  function nextFloat(min: number, max: number): number {
    return next() * (max - min) + min;
  }

  /** Returns true with the given probability (0-1) */
  function chance(probability: number): boolean {
    return next() < probability;
  }

  return { next, nextInt, nextFloat, chance, seed };
}
