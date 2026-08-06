import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Animated,
  Easing,
  Text,
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducedMotion, motionDuration } from '../hooks/useReducedMotion';

/**
 * AnimatedScore — a score counter that smoothly ramps from the previous value
 * to the new value over a short duration. Uses Animated.timing on an
 * Animated.Value and renders the rounded number in a Text.
 *
 * When reduce-motion is enabled, the number snaps instantly.
 *
 * Honours the score scale property so the font can be customized.
 */

interface AnimatedScoreProps {
  value: number;
  duration?: number;
  style?: ViewStyle | ViewStyle[];
  textStyle?: object;
  format?: (v: number) => string;
}

export function AnimatedScore({
  value,
  duration = 400,
  style,
  textStyle,
  format,
}: AnimatedScoreProps) {
  const reduced = useReducedMotion();
  const displayValue = useRef(new Animated.Value(value)).current;
  const [displayText, setDisplayText] = useState(format ? format(value) : value.toLocaleString());
  const lastValue = useRef(value);

  useEffect(() => {
    if (reduced) {
      lastValue.current = value;
      setDisplayText(format ? format(value) : value.toLocaleString());
      return;
    }

    const dur = motionDuration(duration, reduced);
    const listener = displayValue.addListener(({ value: v }) => {
      setDisplayText(format ? format(Math.round(v)) : Math.round(v).toLocaleString());
    });

    Animated.timing(displayValue, {
      toValue: value,
      duration: dur,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      lastValue.current = value;
      displayValue.removeListener(listener);
    });

    return () => {
      displayValue.removeListener(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text style={textStyle}>{displayText}</Text>
  );
}

/**
 * AnimatedHeart — a single heart icon that scales and pulses when it becomes
 * empty (damage taken). Uses a spring animation with overshoot for a juicy feel.
 */
interface AnimatedHeartProps {
  filled: boolean;
  size?: number;
  color?: string;
  emptyColor?: string;
}

export function AnimatedHeart({
  filled,
  size = 16,
  color = '#f87171',
  emptyColor = 'rgba(255,255,255,0.15)',
}: AnimatedHeartProps) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }

    // Pulse the heart whenever it empties.
    if (!filled) {
      Animated.sequence([
        Animated.spring(scale, {
          toValue: 1.35,
          damping: 4,
          stiffness: 300,
          mass: 0.6,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 12,
          stiffness: 200,
          mass: 0.6,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Gentle scale-up on heal.
      Animated.spring(scale, {
        toValue: 1,
        damping: 10,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [filled, scale, reduced]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Ionicons name={filled ? 'heart' : 'heart-outline'} size={size} color={color} />
    </Animated.View>
  );
}

/**
 * AnimatedHealthBar — a smooth health bar that animates width changes with a
 * spring. Shows a fill bar and a delayed "shadow" bar for a trailing effect.
 */
interface AnimatedHealthBarProps {
  health: number;
  maxHealth: number;
  width?: number;
  height?: number;
  color?: string;
  trackColor?: string;
}

export function AnimatedHealthBar({
  health,
  maxHealth,
  width = 80,
  height = 6,
  color = '#f87171',
  trackColor = 'rgba(255,255,255,0.12)',
}: AnimatedHealthBarProps) {
  const reduced = useReducedMotion();
  const fillWidth = useRef(new Animated.Value(width * (health / maxHealth))).current;
  const shadowWidth = useRef(new Animated.Value(width * (health / maxHealth))).current;

  const ratio = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
  const targetWidth = width * ratio;

  useEffect(() => {
    if (reduced) {
      fillWidth.setValue(targetWidth);
      shadowWidth.setValue(targetWidth);
      return;
    }

    Animated.spring(fillWidth, {
      toValue: targetWidth,
      damping: 20,
      stiffness: 200,
      mass: 0.8,
      useNativeDriver: false,
    }).start();

    // Shadow trail — lags behind by 200ms for a damage-leeching effect.
    const timeout = setTimeout(() => {
      Animated.timing(shadowWidth, {
        toValue: targetWidth,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: false,
      }).start();
    }, reduced ? 0 : 150);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetWidth, reduced]);

  return (
    <View style={[{ width, height, borderRadius: height / 2, backgroundColor: trackColor, overflow: 'hidden' }]}>
      {/* Shadow trail (damage indicator) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            width: shadowWidth,
            backgroundColor: 'rgba(255,255,255,0.18)',
          },
        ]}
      />
      {/* Main fill */}
      <Animated.View
        style={{
          width: fillWidth,
          height: '100%',
          backgroundColor: color,
          borderRadius: height / 2,
        }}
      />
    </View>
  );
}

/**
 * StaggeredEntry — wraps a list of children and staggers their entrance with
 * a fade+slide-up animation. Each child appears delayed by `stepDelay` ms.
 *
 * Usage:
 *   <StaggeredEntry count={items.length} stepDelay={60}>
 *     {items.map((item, i) => <Row key={i} />)}
 *   </StaggeredEntry>
 */
interface StaggeredEntryProps {
  children: React.ReactNode;
  stepDelay?: number;
  duration?: number;
  slideDistance?: number;
  trigger?: number | string;
}

export function StaggeredEntry({
  children,
  stepDelay = 60,
  duration = 350,
  slideDistance = 20,
  trigger = 'init',
}: StaggeredEntryProps) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Each trigger change re-runs the stagger.
    opacity.setValue(reduced ? 1 : 0);
    setVisible(false);

    if (reduced) {
      setVisible(true);
      return;
    }

    const timeout = setTimeout(() => {
      setVisible(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: motionDuration(duration, reduced),
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    }, 30);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  // We wrap the children in individual Animated views with staggered delays.
  const childArray = React.Children.toArray(children);

  return (
    <Animated.View style={{ opacity }}>
      {visible &&
        childArray.map((child, i) => (
          <StaggeredItem
            key={i}
            index={i}
            stepDelay={stepDelay}
            duration={duration}
            slideDistance={slideDistance}
            reduced={reduced}
            trigger={trigger}
          >
            {child}
          </StaggeredItem>
        ))}
    </Animated.View>
  );
}

interface StaggeredItemProps {
  index: number;
  stepDelay: number;
  duration: number;
  slideDistance: number;
  reduced: boolean;
  trigger: number | string;
  children: React.ReactNode;
}

const StaggeredItem: React.FC<StaggeredItemProps> = ({
  index,
  stepDelay,
  duration,
  slideDistance,
  reduced,
  trigger,
  children,
}) => {
  const translateY = useRef(new Animated.Value(reduced ? 0 : slideDistance)).current;
  const opacity = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      translateY.setValue(0);
      opacity.setValue(1);
      return;
    }

    translateY.setValue(slideDistance);
    opacity.setValue(0);

    const delay = index * stepDelay;
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motionDuration(duration, reduced),
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: motionDuration(duration, reduced),
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }, delay);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
};
