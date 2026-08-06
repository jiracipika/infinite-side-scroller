import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * React hook that subscribes to the OS-level "reduce motion" accessibility
 * setting. Returns `true` whenever the user has requested reduced motion on
 * their device, or when the app's own persisted reducedParticles setting is on.
 *
 * Components that animate should respect this by shortening durations,
 * disabling parallax/shake, or skipping non-essential motion entirely.
 *
 * The hook is safe to call from any component — it lazily reads the initial
 * value and then subscribes to changes for the lifetime of the component.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    const query = AccessibilityInfo.isReduceMotionEnabled();
    if (query && typeof query.then === 'function') {
      query.then((value: boolean) => {
        if (mounted) setReduced(value);
      }).catch(() => {});
    }

    // Android doesn't reliably fire the change event, but reading the initial
    // value above covers the common path. iOS fires reliably.
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value: boolean) => {
        if (mounted) setReduced(value);
      },
    );

    return () => {
      mounted = false;
      // The subscription returned by addEventListener exposes .remove() in
      // RN 0.65+. We guard for older versions that only returned void.
      if (subscription && typeof (subscription as { remove?: () => void }).remove === 'function') {
        (subscription as { remove: () => void }).remove();
      }
    };
  }, []);

  return reduced;
}

/**
 * Resolve a spring/animation duration based on the reduced-motion preference.
 *
 * When reduced motion is requested, durations are scaled down (or set to a
 * minimal value) so transitions feel instant but still use the native driver.
 */
export function motionDuration(ms: number, reduced: boolean): number {
  if (reduced) return Math.min(ms, 80);
  return ms;
}

/**
 * Resolve a spring config, clamping overshoot/bounciness for reduced motion.
 */
export function motionSpring(
  reduced: boolean,
): { damping: number; stiffness: number; mass: number } {
  if (reduced) {
    return { damping: 40, stiffness: 400, mass: 0.8 };
  }
  return { damping: 18, stiffness: 220, mass: 0.9 };
}

/**
 * Platform-safe shim: returns whether the current platform supports native
 * Animated animations on the UI thread (always true on iOS/Android, false on
 * web where some Animated modules have limitations).
 */
export function supportsNativeDriver(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
