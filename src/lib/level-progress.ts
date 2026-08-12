/**
 * Level progress persistence — stars, best scores, and unlock chains.
 *
 * Centralised so that the game-over callback in page.tsx and the
 * LevelSelectScreen component share the exact same read/write logic.
 * Previously, page.tsx inlined its own localStorage writes that diverged
 * from the LevelSelectScreen exports, causing two bugs:
 *
 *  1. Star regression: a replay that scored below 3 stars could overwrite
 *     a previously-earned 3-star rating in certain edge cases.
 *  2. Cross-mode unlock leak: finding the "next level" via ALL_LEVELS
 *     index could jump from the last adventure level to the first
 *     time-attack level (and vice-versa), unlocking the wrong chain.
 */

import {
  ADVENTURE_LEVELS,
  TIME_ATTACK_LEVELS,
  COIN_RUSH_LEVELS,
  GAUNTLET_LEVELS,
  type LevelConfig,
} from "@/game/data/levels";

export interface LevelProgress {
  stars: number; // 0-3
  bestScore: number;
  unlocked: boolean;
}

export type LevelProgressMap = Record<number, LevelProgress>;

const STORAGE_KEY = "iss-level-progress";

/**
 * Parse and normalise persisted progress. Missing entries are not created
 * here — callers use {@link ensureDefault} for that.
 */
export function loadProgress(): LevelProgressMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LevelProgressMap) : {};
  } catch {
    return {};
  }
}

/** Persist progress map to localStorage. Swallows quota / private-mode errors. */
export function saveProgress(data: LevelProgressMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

/**
 * Ensure a progress entry exists for the given level id, initialising it
 * with default values. Mutates the map in place AND returns the entry so
 * callers can chain.
 *
 * The first level of each mode is
 * unlocked by default; all others start locked.
 */
export function ensureDefault(
  progress: LevelProgressMap,
  id: number,
): LevelProgress {
  if (!progress[id]) {
    progress[id] = {
      stars: 0,
      bestScore: 0,
      unlocked: id === 1 || id === 21 || id === 31 || id === 41,
    };
  }
  return progress[id];
}

/**
 * Determine how many stars a score earns on a level (0-3).
 * Pure function — exported for testability and reuse.
 */
export function calcStars(level: LevelConfig, score: number): number {
  if (score >= level.starThresholds.three) return 3;
  if (score >= level.starThresholds.two) return 2;
  if (score >= level.starThresholds.one) return 1;
  return 0;
}

/**
 * Find the next level in the SAME mode as the given level.
 *
 * Uses the level's own mode list (ADVENTURE_LEVELS or TIME_ATTACK_LEVELS)
 * rather than ALL_LEVELS, which interleaves both modes and could cross
 * chains.
 *
 * Returns null if this is the last level in its mode.
 */
export function findNextLevel(level: LevelConfig): LevelConfig | null {
  const modeList = level.mode === "time-attack"
    ? TIME_ATTACK_LEVELS
    : level.mode === "coin-rush"
      ? COIN_RUSH_LEVELS
      : level.mode === "gauntlet"
        ? GAUNTLET_LEVELS
        : ADVENTURE_LEVELS;
  const idx = modeList.findIndex((l) => l.id === level.id);
  if (idx < 0 || idx >= modeList.length - 1) return null;
  return modeList[idx + 1] ?? null;
}

/**
 * Record a completed level run: update stars (monotonic — never downgrade),
 * update best score, and unlock the next level in the same mode if at
 * least 1 star was earned.
 *
 * @returns the updated progress map so callers can react (e.g. force a
 *          re-render) without a second localStorage round-trip.
 */
export function recordLevelResult(
  level: LevelConfig,
  score: number,
): LevelProgressMap {
  const progress = loadProgress();
  const entry = ensureDefault(progress, level.id);

  const stars = calcStars(level, score);

  // Monotonic star update: never downgrade an existing rating.
  entry.stars = Math.max(entry.stars, stars);
  entry.bestScore = Math.max(entry.bestScore, score);
  entry.unlocked = true;

  // Unlock next level in the same mode if the player earned ≥1 star.
  if (stars >= 1) {
    const next = findNextLevel(level);
    if (next) {
      ensureDefault(progress, next.id).unlocked = true;
    }
  }

  saveProgress(progress);
  return progress;
}

export { STORAGE_KEY };
