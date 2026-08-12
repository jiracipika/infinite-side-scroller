import React, { useRef } from 'react';
import { Pressable, Animated } from 'react-native';
import { useReducedMotion } from '../hooks/useReducedMotion';
import { selectionHaptic } from '../lib/haptics';

export interface PressableScaleProps {
  onPress?: () => void;
  children: React.ReactNode;
  style?: object;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: 'button';
  /** When true (default), a selection haptic fires on press. */
  haptic?: boolean;
}

/**
 * Press feedback component with scale animation and optional haptic.
 *
 * Respects the OS-level "reduce motion" accessibility setting: when enabled,
 * the scale animation is skipped entirely.
 *
 * Used across the Game, Settings, and Leaderboard screens.
 */
export const PressableScale: React.FC<PressableScaleProps> = ({
  onPress,
  children,
  style,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  haptic = true,
}) => {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: 0.97,
      damping: 30,
      stiffness: 600,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: 1,
      damping: 20,
      stiffness: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={() => {
        if (haptic) selectionHaptic();
        onPress?.();
      }}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};
