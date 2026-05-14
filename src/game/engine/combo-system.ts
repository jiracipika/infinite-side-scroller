/**
 * Combo System — tracks chained kills and provides score multipliers.
 * Kills within a time window increase the combo counter.
 * Higher combos = higher score multiplier + bonus effects.
 */

export interface ComboState {
  count: number;
  multiplier: number;
  timer: number;
  maxCombo: number;
  /** Whether the combo just increased (for visual feedback) */
  justIncreased: boolean;
  /** Best multiplier achieved this run */
  bestMultiplier: number;
}

const COMBO_TIMEOUT = 3.0; // seconds before combo resets
const MAX_MULTIPLIER = 8;
const MULTIPLIER_TIERS = [
  { min: 0, mult: 1 },
  { min: 3, mult: 1.5 },
  { min: 5, mult: 2 },
  { min: 10, mult: 3 },
  { min: 15, mult: 4 },
  { min: 25, mult: 5 },
  { min: 35, mult: 6 },
  { min: 50, mult: 8 },
];

/** Get the multiplier for a given combo count */
function getMultiplier(count: number): number {
  let mult = 1;
  for (const tier of MULTIPLIER_TIERS) {
    if (count >= tier.min) mult = tier.mult;
  }
  return Math.min(mult, MAX_MULTIPLIER);
}

export class ComboSystem {
  private state: ComboState = {
    count: 0,
    multiplier: 1,
    timer: 0,
    maxCombo: 0,
    justIncreased: false,
    bestMultiplier: 1,
  };

  /** Called when an enemy is killed */
  onKill(): void {
    this.state.count++;
    this.state.timer = COMBO_TIMEOUT;
    this.state.multiplier = getMultiplier(this.state.count);
    this.state.justIncreased = true;
    if (this.state.count > this.state.maxCombo) {
      this.state.maxCombo = this.state.count;
    }
    if (this.state.multiplier > this.state.bestMultiplier) {
      this.state.bestMultiplier = this.state.multiplier;
    }
  }

  /** Called each frame */
  update(dt: number): void {
    if (this.state.timer > 0) {
      this.state.timer -= dt;
      if (this.state.timer <= 0) {
        this.state.count = 0;
        this.state.multiplier = 1;
        this.state.timer = 0;
      }
    }
    // Reset flag after one frame
    this.state.justIncreased = false;
  }

  /** Get current combo state (read-only snapshot) */
  getState(): ComboState {
    return { ...this.state };
  }

  /** Check if combo just increased (for triggering effects) */
  wasJustIncreased(): boolean {
    return this.state.justIncreased;
  }

  /** Apply combo multiplier to a score value */
  applyMultiplier(baseScore: number): number {
    return Math.round(baseScore * this.state.multiplier);
  }

  /** Reset combo (on death or game restart) */
  reset(): void {
    this.state = {
      count: 0,
      multiplier: 1,
      timer: 0,
      maxCombo: 0,
      justIncreased: false,
      bestMultiplier: 1,
    };
  }
}
