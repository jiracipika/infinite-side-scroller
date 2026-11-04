import type { CharacterArtPose } from './character-art';
import { CHARACTER_ANIMATIONS } from './character-animation-data';

/** Complete authored poses: limbs, clothing and props stay together. */
export function characterAnimationFrame(pose: CharacterArtPose): number {
  const attack = Math.max(pose.melee ?? 0, pose.ranged ?? 0);
  if (attack > 0) return attack < .24 ? 9 : attack < .5 ? 10 : 11;
  if (pose.dashing) return 8;
  if (pose.airborne) return (pose.verticalVelocity ?? 0) < 0 ? 5 : 6;
  if ((pose.land ?? 0) > .25) return 7;
  if (pose.moving ?? (Math.abs(pose.stride ?? 0) > .5)) {
    // Match the contact/passing durations of the authored loop. Travel phase
    // freezes with simulation time and remains independent of display FPS.
    const phase = ((pose.phase ?? 0) % 1 + 1) % 1;
    return phase < 150 / 520 ? 0 : phase < .5 ? 1 : phase < 410 / 520 ? 2 : 3;
  }
  return 4;
}

const images = new Map<string, HTMLImageElement>();
let started = false;
export function ensureCharacterAnimationsLoading(): void {
  if (started || typeof Image === 'undefined') return;
  started = true;
  for (const [id, src] of Object.entries(CHARACTER_ANIMATIONS)) {
    const image = new Image();
    image.onload = () => {
      images.set(id, image);
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('dashverse-art-change'));
    };
    image.src = src;
  }
}

export function characterAnimationReady(id: string): boolean {
  return !(id in CHARACTER_ANIMATIONS) || images.has(id);
}

export function characterAnimationLoaded(id: string): boolean {
  return images.has(id);
}

export function drawCharacterAnimation(ctx: CanvasRenderingContext2D, id: string, width: number, height: number, pose: CharacterArtPose): boolean {
  const image = images.get(id);
  if (!image) return false;
  const size = 128, baseline = 118, scale = height * 1.3 / 108;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, characterAnimationFrame(pose) * size, 0, size, size,
    width / 2 - size * scale / 2, height - baseline * scale, size * scale, size * scale);
  return true;
}
