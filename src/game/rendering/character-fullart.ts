import { CHARACTER_FULL_ART } from './character-fullart-data';
import { drawSkinnedFullArt } from './fullart-mesh';
import type { CharacterArtPose } from './character-art';

/**
 * Full-art lane of the character redesign: each entry is a segmented FRONT
 * figure (transparent background) carved from the reference boards in
 * design/full-art/src. This lane is the DEFAULT identity for every character
 * that ships art — gameplay, remote players and menu previews all draw it
 * through drawCharacterArt — with the procedural ink painters and the pixel
 * sheets remaining as explicitly selectable alternatives.
 *
 * The original pixels are bound to a per-character skeletal mesh. Arms,
 * elbows, legs, knees, head and hand-owned props articulate independently;
 * skirts, capes and spectral tails receive delayed cloth follow-through.
 * The source art is never replaced or flattened back to the ink lane.
 */

const images = new Map<string, HTMLImageElement>();
let loadStarted = false;

/** Kick one-shot async loads for every embedded figure. Idempotent, never throws. */
export function ensureCharacterFullArtLoading(): void {
  if (loadStarted) return;
  if (typeof Image === 'undefined') return; // node/test or SSR context
  loadStarted = true;
  for (const [id, src] of Object.entries(CHARACTER_FULL_ART)) {
    const img = new Image();
    img.onload = () => {
      images.set(id, img);
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event('dashverse-art-change'));
    };
    img.src = src;
  }
}

/** True when a full-art figure ships for this character (drives the style toggle UI). */
export function characterHasFullArt(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHARACTER_FULL_ART, id);
}

export function characterFullArtReady(id: string): boolean {
  return images.has(id);
}

/**
 * Resolve pure pose→transform values so the animation contract is testable
 * without a DOM. Returned rotate/scale are applied around the feet pivot;
 * lungeX is forward motion in local (facing) space, in pixels at sprite
 * height ~34.
 */
export interface FullArtTransform {
  rotate: number;
  scaleX: number;
  scaleY: number;
  lungeX: number;
  liftY: number;
}

export function resolveFullArtTransform(pose: CharacterArtPose = {}): FullArtTransform {
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const t: FullArtTransform = { rotate: 0, scaleX: 1, scaleY: 1, lungeX: 0, liftY: 0 };

  // Idle breathing: a barely-there lift, two breaths per second at pose.time.
  const time = pose.time ?? 0;
  if (!pose.moving && !pose.airborne && !pose.dashing) {
    t.liftY = -Math.sin(time * 2.1) * 0.45;
  }

  if (pose.airborne) {
    // Rising stretches tall, falling spreads into the landing.
    const rising = (pose.verticalVelocity ?? 0) < 0;
    if (rising) {
      t.scaleX = 0.96; t.scaleY = 1.07;
      t.rotate = -0.05;
    } else {
      t.scaleX = 1.05; t.scaleY = 0.96;
      t.rotate = 0.04;
    }
  } else if (pose.dashing) {
    // Committed forward lean, squashed for speed.
    t.rotate = 0.14; t.scaleX = 1.1; t.scaleY = 0.93; t.lungeX = 2;
  } else if (pose.moving) {
    // Gait: constant forward lean scaled by real ground speed (matching the
    // mesh lane's torso tilt), with a lighter stride-extreme sway on top.
    const speed = Math.max(0, Math.min(1.35, pose.speedRatio ?? 1));
    t.rotate = 0.055 * speed + stride * 0.02;
    t.scaleX = 1 + Math.abs(stride) * 0.012;
    t.scaleY = 1 - Math.abs(stride) * 0.012;
  }

  // Melee lunge layers over locomotion: quick forward stab with a wind-up
  // dip, sine over the swing progress so it returns to the base pose.
  const melee = Math.max(0, Math.min(1, pose.melee ?? 0));
  if (melee > 0) {
    const swing = Math.sin(melee * Math.PI);
    t.lungeX += swing * 4;
    t.rotate += swing * 0.1;
  }

  return t;
}

/**
 * Draw the character's full-art figure into the local 0..width / 0..height
 * collision box, anchored bottom-center so the feet stay on the physics
 * baseline. The silhouette may overhang the box (head, hat, weapon) —
 * pixels, never physics. Returns false (drawing nothing) when no art ships
 * for this character or the image is still loading, so the caller falls back
 * to the procedural painter.
 */
export function drawCharacterFullArt(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  width: number,
  height: number,
  pose: CharacterArtPose = {},
): boolean {
  const img = images.get(characterId);
  if (!img) return false;

  if (drawSkinnedFullArt(ctx, characterId, img, width, height, pose)) return true;
  // SSR / unavailable Canvas fallback, also while preparing a preview.
  const transform = resolveFullArtTransform(pose);
  // 1.3× box height: chibi heads and hats reach above the collision box like
  // the ink art does, while the feet stay planted on the ground line.
  const drawH = height * 1.3;
  const drawW = drawH * (img.width / img.height);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // Pivot at the feet, mid-box; the renderer's facing flip wraps this call.
  ctx.translate(width / 2 + transform.lungeX, height + transform.liftY);
  ctx.rotate(transform.rotate);
  ctx.scale(transform.scaleX, transform.scaleY);
  ctx.drawImage(img, -drawW / 2, -drawH, drawW, drawH);
  ctx.restore();
  return true;
}
