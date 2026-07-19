/**
 * Day/night cycle — continuous, keyframe-driven tinting.
 *
 * The cycle repeats every {@link DAY_CYCLE_SECONDS} of game time. Two views:
 *
 *  - {@link getDayPhase} buckets time into four discrete phases (`dawn | day |
 *    dusk | night`) for HUD/emoji display. Phase boundaries match the original
 *    step-function implementation exactly so existing callers are unaffected.
 *
 *  - {@link getDayTint} returns a continuously interpolated RGBA overlay for the
 *    renderer. This replaces the old hard-coded step overlays (which popped
 *    visibly at every phase boundary) with smooth transitions, while preserving
 *    each phase's peak colour and the broad day/night plateaus.
 *
 * Keyframe layout (phase = (timeSec % CYCLE) / CYCLE, 0..1):
 *
 *    0.000 ─ night  ┐
 *                  │ night → dawn
 *    0.075 ─ dawn  ┐│  (dawn peak — matches original dawn overlay)
 *                  ││ dawn → day
 *    0.200 ─ day   ││ ┐
 *                  ││ │ flat day (no tint) — original day had no overlay
 *    0.450 ─ day   ││ ┘
 *                  │  │ day → dusk
 *    0.575 ─ dusk  ┐  │  (dusk peak — matches original dusk overlay)
 *                  │  │ dusk → night
 *    0.700 ─ night ┐  │
 *                  │  │ flat night
 *    0.950 ─ night ┘
 *                  │  flat (ensures wrap at 1.0 → 0.0 is continuous)
 *    1.000 ─ night ┘
 *
 * Because 0.0 and 1.0 both resolve to `NIGHT`, the wrap is gapless.
 */

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

/** Length of one full day/night cycle, in seconds. */
export const DAY_CYCLE_SECONDS = 120;

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

// Peak tint for each phase — sourced from the original step overlays in
// game-engine.ts so the visual identity of each phase is preserved.
//   dawn: rgba(80, 50, 20, 0.12)
//   day:  no overlay  → alpha 0
//   dusk: rgba(60, 30, 10, 0.18)
//   night: rgba(10, 14, 40, 0.38)
const DAWN: Rgba = { r: 80, g: 50, b: 20, a: 0.12 };
const DAY: Rgba = { r: 0, g: 0, b: 0, a: 0 };
const DUSK: Rgba = { r: 60, g: 30, b: 10, a: 0.18 };
const NIGHT: Rgba = { r: 10, g: 14, b: 40, a: 0.38 };

interface Keyframe {
  /** Position in the cycle, 0..1. Must be monotonic non-decreasing. */
  readonly p: number;
  readonly tint: Rgba;
}

// Ordered keyframes. `p` values are chosen so that:
//  - each named phase's peak sits at the centre of its original bucket, and
//  - the broad day (alpha 0) and night plateaus are preserved.
const KEYFRAMES: readonly Keyframe[] = [
  { p: 0.0, tint: NIGHT },
  { p: 0.075, tint: DAWN },
  { p: 0.2, tint: DAY },
  { p: 0.45, tint: DAY },
  { p: 0.575, tint: DUSK },
  { p: 0.7, tint: NIGHT },
  { p: 0.95, tint: NIGHT },
  { p: 1.0, tint: NIGHT },
] as const;

/**
 * Map a normalised cycle position (0..1) to a continuous RGBA tint by
 * smoothstep-interpolating between the two surrounding keyframes.
 *
 * The input is wrapped into [0,1) so callers can pass a raw phase fraction.
 */
export function getDayTintAtPhase(phase: number): Rgba {
  const t = ((phase % 1) + 1) % 1; // normalise into [0,1)

  // Find the bracketing keyframe pair. KEYFRAMES is sorted ascending with
  // first.p = 0 and last.p = 1, so every input is bracketable.
  let lo = KEYFRAMES[0];
  let hi = KEYFRAMES[KEYFRAMES.length - 1];
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    const a = KEYFRAMES[i];
    const b = KEYFRAMES[i + 1];
    if (t >= a.p && t <= b.p) {
      lo = a;
      hi = b;
      break;
    }
  }

  const span = hi.p - lo.p;
  if (span <= 0) return lo.tint; // duplicate keyframe (flat region), no interp.

  const raw = (t - lo.p) / span;
  const e = raw * raw * (3 - 2 * raw); // smoothstep — zero derivative at ends
  return {
    r: lo.tint.r + (hi.tint.r - lo.tint.r) * e,
    g: lo.tint.g + (hi.tint.g - lo.tint.g) * e,
    b: lo.tint.b + (hi.tint.b - lo.tint.b) * e,
    a: lo.tint.a + (hi.tint.a - lo.tint.a) * e,
  };
}

/**
 * Continuous tint overlay for the given game time (seconds). Returns the
 * interpolated RGBA; note the alpha may be 0 (no overlay) for the day plateau.
 */
export function getDayTint(timeSec: number): Rgba {
  const phase = (timeSec % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
  return getDayTintAtPhase(phase);
}

/**
 * Format an {@link Rgba} tint as a CSS `rgba(...)` string. Alpha is clamped to
 * a minimum that rounds to a valid, renderable alpha; values very close to 0
 * are emitted as 0 so callers can cheaply skip the overlay pass.
 */
export function rgbaToString(c: Rgba): string {
  const a = Math.max(0, Math.min(1, c.a));
  // Sub-0.0005 rounds to 0.001 — renderers can short-circuit on `=== 0`.
  const alpha = a < 0.0005 ? 0 : a;
  return `rgba(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)}, ${alpha})`;
}

/**
 * Discrete phase for HUD/display purposes. Boundaries match the original
 * step implementation exactly so existing callers (HUD emoji, engine state
 * snapshot) are unchanged.
 *
 *   dawn:  [0.00, 0.15)
 *   day:   [0.15, 0.50)
 *   dusk:  [0.50, 0.65)
 *   night: [0.65, 1.00)
 */
export function getDayPhase(timeSec: number): DayPhase {
  const phase = (timeSec % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
  if (phase < 0.15) return 'dawn';
  if (phase < 0.5) return 'day';
  if (phase < 0.65) return 'dusk';
  return 'night';
}
