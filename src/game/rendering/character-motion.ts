import type { CharacterArtPose } from './character-art';

export interface CharacterMotionState { x: number; time: number; phase: number; stride: number; moving: boolean }
export interface CharacterMotionInput {
  x: number; width: number; onGround: boolean; dashing: boolean; vy: number;
  melee: number; ranged: number; tumble: number;
}
export function createCharacterMotion(x: number, time: number): CharacterMotionState {
  return { x, time, phase: 0, stride: 0, moving: false };
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
  let { phase, stride, moving } = previous;
  if (reset) { phase = 0; stride = 0; moving = false; }
  else if (dt > 0) {
    moving = input.onGround && !input.dashing && dx / dt > 8;
    if (moving) phase = (phase + dx / Math.max(60, input.width * 2.8)) % 1;
    const target = moving ? Math.sin(phase * Math.PI * 2) * 2.4 : 0;
    // Rapid but continuous settle avoids freezing in a split when input stops.
    stride += (target - stride) * (1 - Math.exp(-dt * 28));
    if (Math.abs(stride) < .005) stride = 0;
  }
  const state = { x: input.x, time, phase, stride, moving };
  return {
    state,
    pose: {
      phase, stride, moving, time: reducedMotion ? 0 : time,
      airborne: !input.onGround, dashing: input.dashing, verticalVelocity: input.vy,
      melee: input.melee, ranged: input.ranged, tumble: reducedMotion ? 0 : input.tumble,
    },
    // Boots stay on the collision surface; body bob belongs to the painter's
    // torso/cloth only. Translating the whole sprite made planted feet float.
    bob: 0,
  };
}
