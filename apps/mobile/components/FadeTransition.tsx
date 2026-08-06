import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useReducedMotion, motionDuration } from '../hooks/useReducedMotion';

/**
 * FadeTransition — a reusable overlay wrapper that fades + slides its children
 * in from the bottom (or a custom direction) using the native Animated driver.
 *
 * Honours the OS reduce-motion setting: when enabled, the transition collapses
 * to a near-instant fade with no displacement.
 *
 * Usage:
 *   <FadeTransition visible={gameState === 'menu'}>
 *     <MenuOverlay ... />
 *   </FadeTransition>
 */

type SlideDirection = 'up' | 'down' | 'none';

interface FadeTransitionProps {
  visible: boolean;
  children: React.ReactNode;
  slideDistance?: number;
  slideDirection?: SlideDirection;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
  /** Render behind a semi-transparent gradient scrim instead of a flat overlay. */
  gradientColors?: [string, string, ...string[]];
}

export function FadeTransition({
  visible,
  children,
  slideDistance = 24,
  slideDirection = 'up',
  duration = 320,
  style,
  gradientColors,
}: FadeTransitionProps) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      // Set initial displacement without animating on mount.
      if (visible && !reduced && slideDirection !== 'none') {
        translateY.setValue(slideDistance);
      }
      return;
    }

    const dur = motionDuration(duration, reduced);
    const targetOpacity = visible ? 1 : 0;
    const targetY = visible
      ? 0
      : slideDirection === 'none'
        ? 0
        : slideDirection === 'up'
          ? slideDistance
          : -slideDistance;

    // Start position before animating in.
    if (visible && !reduced && slideDirection !== 'none') {
      translateY.setValue(slideDirection === 'up' ? slideDistance : -slideDistance);
    }

    const animations: Animated.CompositeAnimation[] = [
      Animated.timing(opacity, {
        toValue: targetOpacity,
        duration: dur,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ];

    if (slideDirection !== 'none' && !reduced) {
      animations.push(
        Animated.timing(translateY, {
          toValue: targetY,
          duration: dur,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      );
    }

    Animated.parallel(animations).start();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const containerStyle: ViewStyle = {
    ...StyleSheet.absoluteFillObject,
    opacity,
    transform: [{ translateY }],
    zIndex: 30,
  };

  if (gradientColors) {
    return (
      <Animated.View style={containerStyle} pointerEvents={visible ? 'auto' : 'none'}>
        <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFillObject} />
        <View style={[styles.contentWrapper, style]}>{children}</View>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[containerStyle, style]} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  contentWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
