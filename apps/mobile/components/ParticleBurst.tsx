import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Easing, View, StyleSheet, Platform } from 'react-native';
import { useReducedMotion, motionDuration } from '../hooks/useReducedMotion';

/**
 * ParticleBurst — a lightweight burst of N particles that expand outward from
 * the center and fade out. Driven entirely by the native Animated driver so it
 * never blocks the JS thread during gameplay.
 *
 * Each particle is a small colored circle with random direction, distance,
 * size, and rotation. The burst is triggered by calling the `trigger` ref or
 * by changing the `burstKey` prop.
 *
 * Honours reduce-motion: renders nothing (no particles) when reduced motion is
 * requested, since bursts are purely decorative.
 */

interface ParticleConfig {
  count: number;
  colors: string[];
  /** Minimum/maximum radius for particle spread (px). */
  minRadius: number;
  maxRadius: number;
  /** Min/max particle size (px). */
  minSize: number;
  maxSize: number;
  duration: number;
}

const DEFAULT_CONFIG: ParticleConfig = {
  count: 12,
  colors: ['#facc15', '#fde68a', '#fbbf24', '#0A84FF', '#5E5CE6'],
  minRadius: 30,
  maxRadius: 90,
  minSize: 4,
  maxSize: 10,
  duration: 600,
};

interface Particle {
  id: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  size: number;
  color: string;
  rotation: number;
}

interface ParticleBurstProps {
  burstKey: number | string;
  config?: Partial<ParticleConfig>;
  style?: object;
}

function buildParticles(cfg: ParticleConfig): Particle[] {
  const particles: Particle[] = [];
  for (let i = 0; i < cfg.count; i++) {
    const angle = (i / cfg.count) * Math.PI * 2 + Math.random() * 0.6;
    const dist = cfg.minRadius + Math.random() * (cfg.maxRadius - cfg.minRadius);
    const endX = Math.cos(angle) * dist;
    const endY = Math.sin(angle) * dist;
    particles.push({
      id: i,
      startX: 0,
      startY: 0,
      endX,
      endY,
      size: cfg.minSize + Math.random() * (cfg.maxSize - cfg.minSize),
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)] ?? '#facc15',
      rotation: Math.random() * 360,
    });
  }
  return particles;
}

export function ParticleBurst({ burstKey, config, style }: ParticleBurstProps) {
  const reduced = useReducedMotion();
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationsRef = useRef<Animated.CompositeAnimation[]>([]);
  const valuesRef = useRef<{ opacity: Animated.Value; x: Animated.Value; y: Animated.Value }[]>([]);

  // Cleanup any in-flight animations on unmount.
  useEffect(() => {
    return () => {
      animationsRef.current.forEach(a => a.stop());
      animationsRef.current = [];
    };
  }, []);

  useEffect(() => {
    // Only trigger when burstKey changes to a non-zero value.
    if (burstKey === 0 || burstKey === 'init') return;

    // Stop previous animations.
    animationsRef.current.forEach(a => a.stop());
    animationsRef.current = [];

    // Respect reduce-motion: skip the effect entirely.
    if (reduced) return;

    const next = buildParticles(cfg);
    setParticles(next);

    // Build animated values for each particle.
    const values = next.map(() => ({
      opacity: new Animated.Value(0),
      x: new Animated.Value(0),
      y: new Animated.Value(0),
    }));
    valuesRef.current = values;

    const dur = motionDuration(cfg.duration, reduced);

    const running = next.map((_, i) => {
      const v = values[i]!;
      v.opacity.setValue(1);
      return Animated.parallel([
        Animated.timing(v.x, {
          toValue: next[i]!.endX,
          duration: dur,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(v.y, {
          toValue: next[i]!.endY,
          duration: dur,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(v.opacity, {
          toValue: 0,
          duration: dur,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]);
    });

    animationsRef.current = running;
    Animated.parallel(running).start();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey]);

  if (reduced || particles.length === 0) return null;

  return (
    <View pointerEvents="none" style={[styles.container, style]}>
      {particles.map((p, i) => {
        const v = valuesRef.current[i];
        if (!v) return null;
        return (
          <Animated.View
            key={p.id}
            style={[
              styles.particle,
              {
                width: p.size,
                height: p.size,
                borderRadius: p.size / 2,
                backgroundColor: p.color,
                opacity: v.opacity,
                transform: [
                  { translateX: v.x },
                  { translateY: v.y },
                  { rotate: `${p.rotation}deg` },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * useParticleBurst — returns [burstKey, trigger] for driving a ParticleBurst
 * component. Call trigger() to fire a burst; each call increments the key so
 * the burst re-renders.
 */
export function useParticleBurst(): [number, () => void] {
  const [key, setKey] = useState(0);
  const trigger = useCallback(() => {
    setKey(prev => prev + 1);
  }, []);
  return [key, trigger];
}

/**
 * ScreenShake — a wrapper view that shakes briefly when `shakeKey` changes.
 * Uses a decaying oscillation on the X axis. Honours reduce-motion (no shake).
 */
interface ScreenShakeProps {
  shakeKey: number | string;
  intensity?: number;
  duration?: number;
  children: React.ReactNode;
  style?: object;
}

export function ScreenShake({
  shakeKey,
  intensity = 8,
  duration = 400,
  children,
  style,
}: ScreenShakeProps) {
  const reduced = useReducedMotion();
  const shakeX = useRef(new Animated.Value(0)).current;
  const shakeY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (shakeKey === 0 || reduced) return;

    const steps = 6;
    const dur = motionDuration(duration, reduced);
    const stepDur = dur / steps;

    const seqX: Animated.CompositeAnimation[] = [];
    const seqY: Animated.CompositeAnimation[] = [];

    for (let i = 0; i < steps; i++) {
      const decay = (1 - i / steps) * intensity;
      const dx = (Math.random() - 0.5) * 2 * decay;
      const dy = (Math.random() - 0.5) * 2 * decay * 0.6;
      seqX.push(
        Animated.timing(shakeX, {
          toValue: dx,
          duration: stepDur,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      seqY.push(
        Animated.timing(shakeY, {
          toValue: dy,
          duration: stepDur,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
    }

    // Return to center.
    seqX.push(Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }));
    seqY.push(Animated.timing(shakeY, { toValue: 0, duration: 50, useNativeDriver: true }));

    shakeX.setValue(0);
    shakeY.setValue(0);
    Animated.parallel([Animated.sequence(seqX), Animated.sequence(seqY)]).start();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shakeKey]);

  return (
    <Animated.View
      style={[
        { flex: 1 },
        style,
        {
          transform: [{ translateX: shakeX }, { translateY: shakeY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * useScreenShake — returns [shakeKey, trigger] for driving a ScreenShake wrapper.
 */
export function useScreenShake(): [number, () => void] {
  const [key, setKey] = useState(0);
  const trigger = useCallback(() => {
    setKey(prev => prev + 1);
  }, []);
  return [key, trigger];
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  particle: {
    position: 'absolute',
  },
});
