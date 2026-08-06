import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion, motionDuration } from '../hooks/useReducedMotion';

/**
 * LoadingSpinner — a premium loading indicator shown while the WebView game
 * HTML is loading. Features three orbiting dots that pulse in sequence plus a
 * progress bar that animates continuously, giving the impression of progress.
 *
 * Honours reduce-motion: shows a static icon + "Loading…" text instead.
 */

interface LoadingSpinnerProps {
  label?: string;
  size?: number;
  color?: string;
}

export function LoadingSpinner({
  label = 'Loading',
  size = 40,
  color = '#0A84FF',
}: LoadingSpinnerProps) {
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <View style={styles.staticContainer}>
        <Ionicons name="hourglass" size={size * 0.6} color={color} />
        {label ? <Text style={[styles.labelStatic, { color }] as object}>{label}…</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OrbitingDots size={size} color={color} />
      {label ? <PulsingLabel label={label} color={color} /> : null}
    </View>
  );
}

/**
 * OrbitingDots — three dots that orbit a center point, each offset in phase
 * by 120 degrees, creating a flowing circular pattern.
 */
function OrbitingDots({ size, color }: { size: number; color: string }) {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rotation]);

  const radius = size * 0.45;
  const dotSize = size * 0.18;

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          width: size,
          height: size,
          transform: [{ rotate: spin }],
        }}
      >
        {/* Three orbiting dots, each at a different phase. */}
        {[0, 120, 240].map((phase, i) => {
          const angle = (phase * Math.PI) / 180;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;
          // Counter-rotate so dots stay upright. We approximate by not
          // rotating — the orbiting motion is the primary effect.
          return (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  width: dotSize,
                  height: dotSize,
                  borderRadius: dotSize / 2,
                  backgroundColor: color,
                  opacity: 1 - i * 0.2,
                  position: 'absolute',
                  top: size / 2 - dotSize / 2 + dy,
                  left: size / 2 - dotSize / 2 + dx,
                },
              ]}
            />
          );
        })}
      </Animated.View>
      {/* Center glow */}
      <View
        style={[
          styles.centerGlow,
          {
            width: dotSize * 0.7,
            height: dotSize * 0.7,
            borderRadius: dotSize * 0.35,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  );
}

/**
 * PulsingLabel — text that pulses opacity in a loop.
 */
function PulsingLabel({ label, color }: { label: string; color: string }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.9,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.Text style={[styles.label, { color, opacity }]}>{label}…</Animated.Text>
  );
}

/**
 * LoadingProgressBar — an indeterminate progress bar that slides across the
 * track, useful for the WebView loading state.
 */
interface LoadingProgressBarProps {
  width?: number;
  height?: number;
  color?: string;
  trackColor?: string;
}

export function LoadingProgressBar({
  width = 200,
  height = 3,
  color = '#0A84FF',
  trackColor = 'rgba(255,255,255,0.1)',
}: LoadingProgressBarProps) {
  const reduced = useReducedMotion();
  const translateX = useRef(new Animated.Value(-width * 0.4)).current;

  useEffect(() => {
    if (reduced) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: width,
          duration: motionDuration(1400, reduced),
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -width * 0.4,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [translateX, width, reduced]);

  return (
    <View style={[styles.progressTrack, { width, height, backgroundColor: trackColor }]}>
      {reduced ? (
        <View style={[styles.progressFillStatic, { width: width * 0.3, height, backgroundColor: color }]} />
      ) : (
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: width * 0.4,
              height,
              backgroundColor: color,
              transform: [{ translateX }],
            },
          ]}
        />
      )}
    </View>
  );
}

// We need Text import for the loading label — already imported at the top.

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  staticContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  labelStatic: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  dot: {
    position: 'absolute',
  },
  centerGlow: {
    position: 'absolute',
    opacity: 0.3,
  },
  progressTrack: {
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 99,
  },
  progressFillStatic: {
    borderRadius: 99,
  },
});
