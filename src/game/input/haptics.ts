/**
 * Gameplay haptics — event-driven vibration patterns.
 *
 * TouchControls already fires a short tap haptic on every button press. That
 * covers input acknowledgement but misses the *consequences* of play — the
 * moments where mobile juice matters most: getting hit, low-health tension,
 * coin pickups, combo milestones, and death.
 *
 * This module owns two things:
 *
 *  1. A pure resolver (`resolveHapticPattern`) that maps a gameplay event to a
 *     `navigator.vibrate` pattern (number | number[]). Pure so it can be unit
 *     tested without a DOM.
 *  2. A React hook (`useGameHaptics`) that watches a stream of `GameStats`
 *     snapshots and fires the right pattern through `navigator.vibrate`,
 *     gracefully no-oping on browsers without the Vibration API (desktop
 *     Safari/Firefox, iOS Safari — which silently ignores vibrate()).
 *
 * Design notes:
 *  - All event patterns are short (≤ 60ms total) so they never feel laggy or
 *    block the next input. Death is the one longer, dramatic exception.
 *  - Low-health uses a repeating two-pulse heartbeat; it is retriggered (not
 *    looped) so it stops the instant health recovers.
 *  - The resolver returns `0` for "no vibration" rather than null, so callers
 *    can pass it straight to `navigator.vibrate` without a null check.
 */

import { useEffect, useRef } from 'react';
import { type GameStats } from '@/game/state/game-state';

/**
 * Gameplay events that should produce haptic feedback.
 * Kept as a string union so the resolver is exhaustive and typo-proof.
 */
export type HapticEvent =
  | 'damage' // took a hit (lost 1+ health)
  | 'heal' // gained health back
  | 'low-health' // dropped to 1 heart — urgency heartbeat
  | 'coin' // picked up a coin
  | 'combo-milestone' // crossed a 10x combo boundary
  | 'combo-break' // combo window expired
  | 'death' // run ended
  | 'extra-life' // picked up a 1-up
  | 'power-up'; // picked up a power-up

/**
 * Vibration patterns (milliseconds). `navigator.vibrate` alternates
 * vibrate/pause for arrays: [vibrate, pause, vibrate, ...].
 *
 * Tuned to be felt, not heard:
 *  - damage: sharp double-tap (like a sting)
 *  - low-health: two soft thumps ~ a heartbeat
 *  - coin: single tiny tick (fires often, must stay subtle)
 *  - combo-milestone: rising triple (da-da-DUM)
 *  - death: long dramatic fade
 */
export const HAPTIC_PATTERNS: Record<HapticEvent, number | number[]> = {
  damage: [18, 40, 28],
  heal: 12,
  'low-health': [14, 90, 14],
  coin: 6,
  'combo-milestone': [10, 30, 10, 30, 22],
  'combo-break': 20,
  death: [60, 50, 40, 50, 30, 60, 120],
  'extra-life': [12, 40, 12, 40, 24],
  'power-up': [10, 24, 16],
};

/**
 * Pure resolver: gameplay event -> vibration pattern.
 *
 * Returns the pattern (number | number[]) to feed to `navigator.vibrate`, or
 * `0` when haptics should be suppressed (unknown event, or `enabled === false`
 * so callers can gate without re-implementing the guard).
 *
 * Extracted as a pure function so the patterns can be unit tested without a
 * browser/DOM, and so non-React callers (engine code, mobile native bridge)
 * can reuse the same definitions.
 */
export function resolveHapticPattern(
  event: HapticEvent,
  enabled: boolean = true,
): number | number[] {
  if (!enabled) return 0;
  return HAPTIC_PATTERNS[event] ?? 0;
}

/**
 * True when the Vibration API is available *and* the document is visible.
 * We suppress haptics when the tab is hidden (pause/switch) so a backgrounded
 * run does not buzz the phone in the user's pocket.
 */
function hapticsAvailable(): boolean {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  return true;
}

/**
 * Fire a single haptic event. Safe to call from anywhere (engine, UI, tests).
 * No-ops on unsupported browsers or when the document is hidden.
 */
export function fireHaptic(event: HapticEvent, enabled: boolean = true): void {
  if (!enabled || !hapticsAvailable()) return;
  const pattern = resolveHapticPattern(event, true);
  if (pattern === 0) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* Some browsers throw on cross-origin iframes; ignore. */
  }
}

/**
 * Combo milestones (every 10x). Crossing any boundary fires a celebration
 * haptic. Defined here so the hook and any future UI badge share one source.
 */
export const COMBO_MILESTONE_STEP = 10;

function nearestComboMilestone(combo: number): number {
  if (combo <= 0) return 0;
  return Math.floor(combo / COMBO_MILESTONE_STEP) * COMBO_MILESTONE_STEP;
}

/**
 * React hook: subscribe to a `GameStats` stream and emit haptics for the
 * gameplay events that matter on mobile.
 *
 * Mount this once in the in-game HUD (or any component that lives for the
 * whole run). It tracks previous values in refs and only fires on transitions,
 * so steady-state frames do zero work.
 *
 * @param stats   Latest GameStats snapshot from the engine.
 * @param enabled Master switch — wire to a settings flag to let players turn
 *                gameplay haptics off independently of input haptics.
 */
export function useGameHaptics(stats: GameStats, enabled: boolean = true): void {
  const prev = useRef<GameStats>(stats);
  // Throttle for the sustained low-health heartbeat (see below). Lives for the
  // hook's lifetime; declared before the effect so hook order is stable.
  const nextLowHealthAllowedRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      prev.current = stats;
      return;
    }

    const p = prev.current;

    // Health transitions ------------------------------------------------
    if (stats.health < p.health) {
      // Dropped to exactly 1 -> lead with the urgency heartbeat, which is
      // more informative than the generic damage sting.
      if (stats.health === 1) fireHaptic('low-health');
      else fireHaptic('damage');
    } else if (stats.health > p.health) {
      fireHaptic('heal');
    } else if (stats.health === 1 && p.health === 1) {
      // Sustained low-health: retrigger the heartbeat on a coarse cadence so
      // it reads as urgency, not a constant buzz. We piggyback on score ticks
      // (which fire roughly every frame the player earns points) and emit at
      // most once per ~1.1s using a ref timestamp.
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const LOW_HEALTH_INTERVAL = 1100;
      if (nextLowHealthAllowedRef.current === 0 || now >= nextLowHealthAllowedRef.current) {
        fireHaptic('low-health');
        nextLowHealthAllowedRef.current = now + LOW_HEALTH_INTERVAL;
      }
    }

    // Lives (1-up pickup) ----------------------------------------------
    if (stats.lives > p.lives) {
      fireHaptic('extra-life');
    }

    // Coins ------------------------------------------------------------
    if (stats.coins > p.coins) {
      fireHaptic('coin');
    }

    // Combo milestones -------------------------------------------------
    const prevMilestone = nearestComboMilestone(p.comboCount ?? 0);
    const currMilestone = nearestComboMilestone(stats.comboCount ?? 0);
    if (currMilestone > prevMilestone && currMilestone >= COMBO_MILESTONE_STEP) {
      fireHaptic('combo-milestone');
    }

    // Combo break: had a combo, now the window reads 0 and count reset.
    if ((p.comboCount ?? 0) >= COMBO_MILESTONE_STEP && (stats.comboCount ?? 0) === 0) {
      fireHaptic('combo-break');
    }

    prev.current = stats;
  }, [stats, enabled]);
}
