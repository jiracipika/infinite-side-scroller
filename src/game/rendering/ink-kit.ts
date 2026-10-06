import type { CharacterArtPose } from './character-art';

/**
 * Shared authoring kit for the bespoke ink-art roster (ink-roster.ts). Same
 * drawing-only contract as ink-ninja/ink-cherry: local joints never write
 * back to Player/physics, filled bent limbs, broken contours, one accent
 * budget per character. Draw functions are authored explicitly per character
 * (see ink-ninja.ts / ink-cherry.ts) — this module only factors the pose
 * algebra and the canvas closures they all share.
 */

export type Point = readonly [number, number];

export interface InkPoseTerms {
  stride: number;
  swing: number;
  tuck: number;
  lean: number;
  lift: number;
}

/** Shared pose algebra: the exact terms the ninja/cherry art consume. */
export function inkPoseTerms(pose: CharacterArtPose): InkPoseTerms {
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
  const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
  const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * 0.35;
  const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * 0.2;
  return { stride, swing, tuck, lean, lift };
}

export interface InkHelpers {
  poly: (color: string, points: readonly Point[]) => void;
  mark: (color: string, points: readonly Point[], weight?: number) => void;
  shift: (points: readonly Point[], x?: number, y?: number) => Point[];
}

/** Canvas closures shared by every ink draw function. */
export function makeInkHelpers(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  lean: number,
  lift: number,
): InkHelpers {
  const poly = (color: string, points: readonly Point[]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
    ctx.closePath();
    ctx.fill();
  };
  const mark = (color: string, points: readonly Point[], weight = 0.55) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = weight * Math.min(sx, sy);
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
    ctx.stroke();
  };
  const shift = (points: readonly Point[], x = lean, y = lift): Point[] =>
    points.map(([px, py]) => [px + x, py + y] as Point);
  return { poly, mark, shift };
}

/** Ink material set — per character, tinted from its roster identity. */
export interface InkMaterials {
  ink: string;
  fold: string;
  edge: string;
  accent: string;
  deep: string;
  skin: string;
}

export function inkMaterials(bodyColor: string, outlineColor: string): InkMaterials {
  return {
    ink: '#141019',
    fold: '#3a2c42',
    edge: '#a78bb0',
    accent: bodyColor,
    deep: outlineColor,
    skin: '#f1c9a5',
  };
}
