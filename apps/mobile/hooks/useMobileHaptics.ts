import { useEffect, useRef } from 'react';
import { Vibration, Platform, AppState } from 'react-native';

/**
 * Mobile gameplay haptics — React Native counterpart to the web haptics engine
 * (src/game/input/haptics.ts).
 *
 * The web engine fires vibration patterns through navigator.vibrate inside the
 * WebView. On React Native (Android especially), the WebView's navigator.vibrate
 * is either unavailable or inconsistently supported. This module takes the same
 * gameplay stats stream that the GameScreen already receives from the WebView
 * message bridge and fires native Vibration patterns for the events that matter
 * most on mobile: taking damage, low-health tension, coin pickups, combo
 * milestones, extra lives, and death.
 *
 * Pattern definitions mirror the web engine so haptics feel consistent across
 * platforms. The resolver is pure and exportable so unit tests can verify the
 * patterns without importing React Native.
 */

/** Gameplay events that should produce haptic feedback. */
export type MobileHapticEvent =
  | 'damage'
  | 'heal'
  | 'low-health'
  | 'coin'
  | 'combo-milestone'
  | 'combo-break'
  | 'death'
  | 'extra-life'
  | 'power-up';

/**
 * Vibration patterns in milliseconds.
 *
 * On Android, Vibration.vibrate accepts number[] as vibrate/pause pairs.
 * On iOS, only Vibration.vibrate(duration) with a single number is supported,
 * so we fall back to a single short pulse for complex patterns.
 */
export const HAPTIC_PATTERNS: Record<MobileHapticEvent, number[]> = {
  damage: [18, 40, 28],
  heal: [12],
  'low-health': [14, 90, 14],
  coin: [6],
  'combo-milestone': [10, 30, 10, 30, 22],
  'combo-break': [20],
  death: [60, 50, 40, 50, 30, 60, 120],
  'extra-life': [12, 40, 12, 40, 24],
  'power-up': [10, 24, 16],
};

export const COMBO_MILESTONE_STEP = 10;

function nearestComboMilestone(combo: number): number {
  if (combo <= 0) return 0;
  return Math.floor(combo / COMBO_MILESTONE_STEP) * COMBO_MILESTONE_STEP;
}

/**
 * Pure resolver: gameplay event -> vibration pattern array.
 *
 * Returns an empty array when haptics should be suppressed (unknown event or
 * disabled), so callers can pass it straight to Vibration.vibrate without a
 * guard.
 */
export function resolveMobileHapticPattern(
  event: MobileHapticEvent,
  enabled: boolean = true,
): number[] {
  if (!enabled) return [];
  return HAPTIC_PATTERNS[event] ?? [];
}

/**
 * Fire a haptic event using the native Vibration API.
 * No-ops when disabled, when the app is backgrounded, or when the pattern is empty.
 */
export function fireMobileHaptic(
  event: MobileHapticEvent,
  enabled: boolean = true,
): void {
  if (!enabled) return;
  // Suppress haptics when the app is not in the foreground — a backgrounded run
  // should not buzz the phone in the user's pocket.
  if (AppState.currentState !== 'active') return;
  const pattern = HAPTIC_PATTERNS[event];
  if (!pattern || pattern.length === 0) return;
  try {
    if (Platform.OS === 'ios') {
      // iOS Vibration API only accepts a single duration number.
      Vibration.vibrate(pattern[0]);
    } else {
      Vibration.vibrate(pattern);
    }
  } catch {
    // Vibration can fail on devices without a vibrator; ignore.
  }
}

/**
 * Stats snapshot expected by the hook — a subset of the GameStats already
 * flowing through the WebView message bridge.
 */
export interface MobileHapticStats {
  health: number;
  coins: number;
  comboCount: number;
  lives: number;
}

/**
 * React hook: subscribe to a gameplay stats stream and emit haptics for
 * the events that matter on mobile.
 *
 * Mount this once during active gameplay. It tracks previous values in refs
 * and only fires on transitions, so steady-state frames do zero work.
 *
 * @param stats   Latest stats snapshot from the WebView bridge.
 * @param enabled Master switch — wire to the persisted hapticsEnabled setting.
 */
export function useMobileHaptics(stats: MobileHapticStats, enabled: boolean = true): void {
  const prev = useRef<MobileHapticStats>(stats);
  const nextLowHealthAllowedRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      prev.current = stats;
      return;
    }

    const p = prev.current;

    // Health transitions
    if (stats.health < p.health) {
      if (stats.health <= 1) fireMobileHaptic('low-health');
      else fireMobileHaptic('damage');
    } else if (stats.health > p.health) {
      fireMobileHaptic('heal');
    } else if (stats.health === 1 && p.health === 1) {
      // Sustained low-health heartbeat — throttled to ~1.1s cadence.
      const now = Date.now();
      const LOW_HEALTH_INTERVAL = 1100;
      if (nextLowHealthAllowedRef.current === 0 || now >= nextLowHealthAllowedRef.current) {
        fireMobileHaptic('low-health');
        nextLowHealthAllowedRef.current = now + LOW_HEALTH_INTERVAL;
      }
    }

    // Lives (1-up pickup)
    if (stats.lives > p.lives) {
      fireMobileHaptic('extra-life');
    }

    // Coins
    if (stats.coins > p.coins) {
      fireMobileHaptic('coin');
    }

    // Combo milestones
    const prevMilestone = nearestComboMilestone(p.comboCount);
    const currMilestone = nearestComboMilestone(stats.comboCount);
    if (currMilestone > prevMilestone && currMilestone >= COMBO_MILESTONE_STEP) {
      fireMobileHaptic('combo-milestone');
    }

    // Combo break
    if (p.comboCount >= COMBO_MILESTONE_STEP && stats.comboCount === 0) {
      fireMobileHaptic('combo-break');
    }

    prev.current = stats;
  }, [stats, enabled]);
}
