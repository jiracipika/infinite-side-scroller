/**
 * Gameplay haptics — event-driven vibration patterns.
 *
 * TouchControls already fires a short tap haptic on every button press. That
 * covers input acknowledgement but misses the *consequences* of play — the
 * moments where mobile juice matters most: getting hit, low-health tension,
 * coin pickups, combo milestones, and death.
 *
 * This module owns three things:
 *
 *  1. A pure resolver (`resolveHapticPattern`) that maps a gameplay event to a
 *     `navigator.vibrate` pattern (number | number[]). Pure so it can be unit
 *     tested without a DOM.
 *  2. A React hook (`useGameHaptics`) that watches a stream of `GameStats`
 *     snapshots and fires the right pattern through `navigator.vibrate`,
 *     gracefully no-oping on browsers without the Vibration API (desktop
 *     Safari/Firefox, iOS Safari — which silently ignores vibrate()).
 *  3. A gamepad bridge (`resolveRumbleEffect` + fan-out inside `fireHaptic`)
 *     that expresses the same events as dual-rumble on connected controllers,
 *     whose pads lack the Vibration API entirely.
 *
 * Design notes:
 *  - All event patterns are short (≤ 100ms total) so they never feel laggy or
 *    block the next input. Death is the one longer, dramatic exception.
 *  - Low-health uses a repeating two-pulse heartbeat; it is retriggered (not
 *    looped) so it stops the instant health recovers.
 *  - The resolver returns `0` for "no vibration" rather than null, so callers
 *    can pass it straight to `navigator.vibrate` without a null check.
 *  - Beyond gameplay, the module carries a small UI vocabulary — `success`,
 *    `error`, `milestone` — for the consequence moments OUTSIDE the run
 *    (purchase / redeem outcomes, level complete, achievements, records).
 *    Deliberately NOT wired to plain button clicks: buzzing every tap is
 *    annoying; only results buzz.
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
  | 'power-up' // picked up a power-up
  | 'success' // UI confirmation — purchase / coin-code redeem went through
  | 'error' // UI rejection — purchase / redeem failed
  | 'milestone'; // meta victory — level complete, achievement, record broken

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
  // UI confirmations — a light double-tick (tick...TICK), kin of `heal` but
  // doubled so a shop buy reads as "done" and not as incidental feedback.
  success: [10, 30, 20],
  // Rejections — one heavier buzz, unmistakably "no" next to the coin tick.
  error: 45,
  // Meta victories — rising triple (da-da-DUM), the combo-milestone shape
  // stretched slightly longer because these fire once, not every 10x combo.
  milestone: [12, 26, 12, 26, 24],
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

/* ------------------------------------------------------------------ */
/* Gamepad rumble — the same events, felt through the controller.       */
/*                                                                      */
/* Desktop pads have no Vibration API; they expose the Gamepad          */
/* Haptics Actuator (dual-rumble) instead. The bridge below keeps the   */
/* event vocabulary single-sourced: durations are DERIVED from          */
/* HAPTIC_PATTERNS so a retuned phone pattern retunes the pad with it,  */
/* while strong/weak magnitudes are authored per event character        */
/* (damage = heavy-thump low motor, coin = light high-motor tick).      */
/* ------------------------------------------------------------------ */

export interface GamepadRumbleEffect {
  durationMs: number;
  /** Low-frequency motor 0..1 — the big weights. */
  strongMagnitude: number;
  /** High-frequency motor 0..1 — the fine buzz. */
  weakMagnitude: number;
}

const RUMBLE_MAGNITUDES: Record<HapticEvent, { strong: number; weak: number }> = {
  damage: { strong: 1.0, weak: 0.4 },
  heal: { strong: 0.25, weak: 0.35 },
  'low-health': { strong: 0.7, weak: 0.3 },
  coin: { strong: 0.1, weak: 0.5 },
  'combo-milestone': { strong: 0.5, weak: 0.8 },
  'combo-break': { strong: 0.35, weak: 0.2 },
  death: { strong: 1.0, weak: 0.6 },
  'extra-life': { strong: 0.4, weak: 0.7 },
  'power-up': { strong: 0.3, weak: 0.6 },
  success: { strong: 0.3, weak: 0.7 }, // light + bright, like extra-life
  error: { strong: 0.75, weak: 0.25 }, // heavy low-motor thump
  milestone: { strong: 0.6, weak: 0.8 }, // celebratory, like combo-milestone
};

function patternTotalMs(pattern: number | number[]): number {
  if (typeof pattern === 'number') return pattern;
  return pattern.reduce((sum, ms) => sum + ms, 0);
}

/**
 * Pure resolver: gameplay event -> dual-rumble effect parameters.
 * Returns `0` when feedback is suppressed (disabled or unknown event), so
 * callers can gate without re-implementing the guard. Durations come from
 * HAPTIC_PATTERNS; magnitudes are bounded to [0, 1] as the API requires.
 */
export function resolveRumbleEffect(
  event: HapticEvent,
  enabled: boolean = true,
): GamepadRumbleEffect | 0 {
  if (!enabled) return 0;
  const magnitudes = RUMBLE_MAGNITUDES[event];
  if (!magnitudes) return 0;
  return {
    durationMs: patternTotalMs(HAPTIC_PATTERNS[event] ?? 0),
    strongMagnitude: Math.max(0, Math.min(1, magnitudes.strong)),
    weakMagnitude: Math.max(0, Math.min(1, magnitudes.weak)),
  };
}

interface DualRumbleActuator {
  playEffect(
    type: 'dual-rumble',
    params: { duration: number; strongMagnitude: number; weakMagnitude: number },
  ): Promise<string> | undefined;
}

/**
 * Fire a rumble on every connected controller. Safe no-op on browsers
 * without the Gamepad API, pads without an actuator, or when disabled.
 * Never awaited — rumble is fire-and-forget by design.
 */
export function fireGamepadRumble(event: HapticEvent, enabled: boolean = true): void {
  if (!enabled) return;
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return;
  const effect = resolveRumbleEffect(event, true);
  if (effect === 0) return;
  try {
    for (const gamepad of navigator.getGamepads()) {
      if (!gamepad?.connected) continue;
      const actuator = (gamepad as Gamepad & { vibrationActuator?: DualRumbleActuator })
        .vibrationActuator;
      if (actuator && typeof actuator.playEffect === 'function') {
        try {
          void actuator.playEffect('dual-rumble', {
            duration: effect.durationMs,
            strongMagnitude: effect.strongMagnitude,
            weakMagnitude: effect.weakMagnitude,
          });
        } catch {
          /* Some actuators reject unsupported effects; keep the run smooth. */
        }
      }
    }
  } catch {
    // Some embedded webviews expose getGamepads but reject access.
  }
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
 * No-ops on unsupported browsers or when the document is hidden. Fans out to
 * BOTH feedback channels: the Vibration API (phones) and dual-rumble on any
 * connected gamepad, so a controller player feels the same consequences.
 */
export function fireHaptic(event: HapticEvent, enabled: boolean = true): void {
  if (!enabled) return;
  fireGamepadRumble(event, true);
  if (!hapticsAvailable()) return;
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
