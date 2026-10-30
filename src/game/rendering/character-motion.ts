import type { CharacterArtPose } from './character-art';
import { characterPerformance } from './character-performance';

export interface CharacterMotionState {
  x: number; time: number; phase: number; stride: number; moving: boolean;
  speedRatio: number;
  /** Last observed ground contact; drives takeoff/landing impulses. */
  onGround: boolean;
  /** 1 → 0 takeoff impulse (stretch), decays over LAUNCH_TIME seconds. */
  launch: number;
  /** 1 → 0 landing impulse (squash), scaled by impact speed, decays over LAND_TIME. */
  land: number;
}
export interface CharacterMotionInput {
  characterId?: string;
  x: number; width: number; onGround: boolean; dashing: boolean; vy: number;
  melee: number; ranged: number; tumble: number;
  /** Positive px/s impact speed the physics step recorded for a just-landed player. */
  landingVy?: number;
}
/** Normalization reference for pose.speedRatio: the baseline run speed. */
export const RUN_SPEED_REFERENCE = 280;
/** Seconds a takeoff stretch impulse takes to fully decay. */
export const LAUNCH_TIME = 0.22;
/** Seconds a landing squash impulse takes to fully decay. */
export const LAND_TIME = 0.3;

export function createCharacterMotion(x: number, time: number): CharacterMotionState {
  return { x, time, phase: 0, stride: 0, moving: false, speedRatio: 0, onGround: true, launch: 0, land: 0 };
}
/** A simulation-clock / real-displacement gait, shared by local and remote players.
 * Don't use distanceTraveled (which advances during dashes and at blocked walls),
 * wall-clock time (which runs while paused), or a render-frame counter. */
export function advanceCharacterMotion(
  previous: CharacterMotionState, input: CharacterMotionInput, time: number, reducedMotion = false,
): { state: CharacterMotionState; pose: CharacterArtPose; bob: number } {
  const dt = Math.max(0, Math.min(.1, time - previous.time));
  const dx = Math.abs(input.x - previous.x);
  const reset = time < previous.time || dx > Math.max(120, input.width * 5);
  let { phase, stride, moving, launch, land } = previous;
  let onGround = input.onGround;
  if (reset) {
    phase = 0; stride = 0; moving = false; launch = 0; land = 0;
    onGround = input.onGround;
  } else if (dt > 0) {
    // Decay before detecting transitions so the impulse tick itself reports
    // a clean full-intensity 1 (the spring wrapper keys off that exact frame).
    launch = Math.max(0, launch - dt / LAUNCH_TIME);
    land = Math.max(0, land - dt / LAND_TIME);
    // Takeoff: a real jump leaves the ground with strong upward velocity — walking
    // off a ledge (vy ≈ 0) is not a takeoff and must not stretch the sprite.
    if (previous.onGround && !input.onGround && input.vy < -60) launch = 1;
    // Landing: squash scales with impact; a stair-step graze barely registers.
    if (!previous.onGround && input.onGround) {
      const impact = input.landingVy ?? 0;
      land = Math.max(0.35, Math.min(1, impact / 520));
    }
    moving = input.onGround && !input.dashing && dx / dt > 8;
    // Gait cadence: one full cycle per ~3.4 body widths of ground travel. At the
    // 280 px/s base run speed that is ~3 strides/s — a readable cartoon run,
    // not the 8+ steps/s vibration the old 2.8-width cycle produced.
    if (moving) phase = (phase + dx / (Math.max(88, input.width * 3.4) * characterPerformance(input.characterId ?? '').strideLength)) % 1;
    const target = moving ? Math.sin(phase * Math.PI * 2) * 2.4 : 0;
    // Rapid but continuous settle avoids freezing in a split when input stops.
    stride += (target - stride) * (1 - Math.exp(-dt * 28));
    if (Math.abs(stride) < .005) stride = 0;
  }
  const speedRatio = reset ? 0 : dt > 0 ? Math.max(0, Math.min(1.35, (dx / dt) / RUN_SPEED_REFERENCE)) : previous.speedRatio;
  const state = { x: input.x, time, phase, stride, moving, onGround, launch, land, speedRatio };
  return {
    state,
    pose: {
      phase, stride, moving, time: reducedMotion ? 0 : time,
      airborne: !input.onGround, dashing: input.dashing, verticalVelocity: input.vy,
      melee: input.melee, ranged: input.ranged, tumble: reducedMotion ? 0 : input.tumble,
      launch: reducedMotion ? 0 : launch, land: reducedMotion ? 0 : land, speedRatio,
    },
    // Boots stay on the collision surface; body bob belongs to the painter's
    // torso/cloth only. Translating the whole sprite made planted feet float.
    bob: 0,
  };
}
