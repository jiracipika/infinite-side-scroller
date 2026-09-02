/**
 * Pure pose solvers for the two visually silent power-ups: magnet and
 * speedBoost. The engine renders these FX in world space using these
 * deterministic outputs (seeded by run time, never by an RNG) so multiplayer
 * clients render identical FX at the same game time.
 */

/** Coil pulse speed in pulses per second. */
const MAGNET_PULSE_HZ = 1.6;
/** Fraction of the magnet radius the outer ring occupies. */
const MAGNET_RING_SPAN = 0.32;
/** Streak window across the speed-boost body, in pixels. */
const SPEED_STREAK_SPAN = 26;

export interface MagnetFieldPose {
  /** Outer ring radius in px (inner rings interpolate toward 0.6 * this). */
  ringRadius: number;
  /** 0..1..0 pulse envelope (sin) at the current time. */
  pulse: number;
  /** Ring alphas: [inner, mid, outer] scaled 0..1. */
  ringAlphas: [number, number, number];
  /** Deterministic shimmer offsets per ring (px), seeded by time. */
  ringShimmer: [number, number, number];
  /** Inner ring radius (px). */
  inner: number;
  /** Middle ring radius (px). */
  mid: number;
}

/**
 * Resolved magnet-field geometry: a triple pulsing ring filling the actual
 * pull radius, fading with radius and breathing at MAGNET_PULSE_HZ.
 */
export function resolveMagnetFieldPose(
  radius: number,
  time: number,
): MagnetFieldPose {
  const pulse = 0.5 + 0.5 * Math.sin(time * MAGNET_PULSE_HZ * Math.PI * 2);
  const outer = radius;
  const inner = radius * (1 - MAGNET_RING_SPAN);
  const mid = radius * (1 - MAGNET_RING_SPAN * 0.5);
  // Deterministic shimmer: ±2px per ring, distinct phases.
  const shimmer = (phase: number): number =>
    Math.sin(time * MAGNET_PULSE_HZ * Math.PI * 2 + phase) * 2;
  return {
    ringRadius: outer,
    pulse,
    ringAlphas: [0.10 + pulse * 0.08, 0.08 + pulse * 0.06, 0.06 + pulse * 0.05],
    ringShimmer: [shimmer(0), shimmer(2.1), shimmer(4.2)],
    inner,
    mid,
  };
}

export interface SpeedLinesPose {
  /** Per-streak state: x offset behind player (-span..0), y offset, len, alpha. */
  streaks: Array<{ x: number; y: number; len: number; alpha: number }>;
}

/**
 * Resolved speed-line streaks while speedBoost is active: 4 deterministic
 * streaks trailing the player, cycling with a phase offset per lane.
 */
export function resolveSpeedLinesPose(
  bodyWidth: number,
  bodyHeight: number,
  time: number,
): SpeedLinesPose {
  const streaks: SpeedLinesPose['streaks'] = [];
  const lanes = 4;
  for (let i = 0; i < lanes; i++) {
    const phase = (time * 2.2 + i / lanes) % 1;
    const x = -phase * SPEED_STREAK_SPAN - bodyWidth * 0.55;
    const y = bodyHeight * (0.18 + (i / (lanes - 1)) * 0.64);
    const len = 6 + phase * 12;
    streaks.push({ x, y, len, alpha: Math.sin(phase * Math.PI) * 0.35 });
  }
  return { streaks };
}

/**
 * Intensity ramp shared by both FX: 0→1 over the first 0.25s of the effect
 * and 1→0 over the final 0.4s, so effects never pop in/out.
 */
export function powerFxIntensity(remaining: number, duration: number): number {
  const fadeIn = Math.min(1, (duration - remaining) / 0.25);
  const fadeOut = Math.min(1, remaining / 0.4);
  return Math.max(0, Math.min(1, Math.min(fadeIn, fadeOut)));
}
