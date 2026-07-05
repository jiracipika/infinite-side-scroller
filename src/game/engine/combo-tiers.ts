/**
 * Combo multiplier tier thresholds.
 *
 * Pure data — no imports — so it can be safely imported by both the engine
 * (browser/DOM context) and the zero-dependency Node test runner.
 *
 * Each value is the kill count at which the multiplier increases by 1.
 * The base multiplier is 1; each cleared tier adds 1.
 *   kills < 3   → x1
 *   kills < 6   → x2
 *   kills < 10  → x3
 *   kills < 15  → x4
 *   kills >= 15 → x5
 *
 * Kept in ascending order. Milestone logic in game-engine.ts detects when
 * a kill crosses a threshold to fire a celebration popup.
 */
export const COMBO_TIERS = [3, 6, 10, 15] as const;

/**
 * Returns the combo multiplier for a given consecutive kill count.
 *
 * Exported so tests (and any future HUD preview) can validate the schedule
 * without instantiating a full GameEngine.
 */
export function comboMultiplierFor(kills: number): number {
  let mult = 1;
  for (const tier of COMBO_TIERS) {
    if (kills >= tier) mult += 1;
  }
  return mult;
}
