import { Vibration } from 'react-native';

/**
 * Fire a light selection haptic — used by buttons, sliders, and toggles
 * across all screens to provide consistent press feedback.
 */
export function selectionHaptic(): void {
  Vibration.vibrate(8);
}
