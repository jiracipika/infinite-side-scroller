import type { CharacterDef } from '../data/characters';
import { drawCharacterArt, type CharacterArtPose } from './character-art';
import { characterHasFullArt, characterFullArtReady } from './character-fullart';
import { characterSheetReady, preferredArtStyle } from './sprite-sheet';
import { characterPreviewPose, type CharacterPreviewAction } from './character-performance';

export interface ArtBounds { left: number; top: number; right: number; bottom: number }
export interface PreviewFrame { x: number; y: number; scale: number }

/** Fit the whole silhouette, including overhanging hats, hair and weapons.
 * A single action envelope keeps the framing stable while the figure moves. */
export function fitCharacterPreview(bounds: ArtBounds, size: number): PreviewFrame {
  const padding = Math.max(3, Math.min(10, size * .08));
  const scale = Math.min((size - padding * 2) / Math.max(1, bounds.right - bounds.left),
    (size - padding * 2) / Math.max(1, bounds.bottom - bounds.top));
  return { scale, x: size / 2 - (bounds.left + bounds.right) / 2 * scale,
    y: size - padding - bounds.bottom * scale };
}

const envelopes = new Map<string, ArtBounds>();
let measuring: HTMLCanvasElement | undefined;

function previewPoses(char: CharacterDef, action: CharacterPreviewAction, animated: boolean): CharacterArtPose[] {
  if (!animated) return [characterPreviewPose(char, 0, action)];
  if (action === 'run') return Array.from({ length: 24 }, (_, i) => ({
    moving: true, phase: i / 24, stride: Math.sin(i / 24 * Math.PI * 2) * 2.4, speedRatio: char.speed,
  }));
  if (action === 'attack') return Array.from({ length: 25 }, (_, i) => char.hasMelee ? { melee: i / 24 } : { ranged: i / 24 });
  if (action === 'jump') return Array.from({ length: 25 }, (_, i) => characterPreviewPose(char, i * 1.5 / 24, action));
  return Array.from({ length: 8 }, (_, i) => ({ time: i * .6 }));
}

/** Measure the actual shared painter rather than the collision rectangle.
 * Asset readiness is part of the cache key so a temporary ink fallback never
 * determines the framing of a subsequently loaded full-art figure. */
export function characterPreviewBounds(char: CharacterDef, action: CharacterPreviewAction, animated: boolean): ArtBounds {
  const style = preferredArtStyle(char.id);
  const ready = style === 'fullart' ? characterFullArtReady(char.id) : style === 'pixel' ? characterSheetReady(char.id) : true;
  const key = [char.id, style, ready, action, animated].join(':');
  const cached = envelopes.get(key);
  if (cached) return cached;
  const fallback = { left: -16, top: characterHasFullArt(char.id) ? -char.height * .4 : -8,
    right: char.width + 16, bottom: char.height + 2 };
  if (typeof document === 'undefined') return fallback;
  measuring ??= document.createElement('canvas');
  // 3 pixels per game unit, with >80 game units of clearance in every direction.
  measuring.width = 512; measuring.height = 512;
  const ctx = measuring.getContext('2d', { willReadFrequently: true });
  if (!ctx) return fallback;
  ctx.setTransform(3, 0, 0, 3, 256, 256);
  for (const pose of previewPoses(char, action, animated)) drawCharacterArt(ctx, char, char.width, char.height, pose);
  const pixels = ctx.getImageData(0, 0, 512, 512).data;
  let left = 512, top = 512, right = 0, bottom = 0;
  for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
    if (pixels[(y * 512 + x) * 4 + 3] < 8) continue;
    left = Math.min(left, x); right = Math.max(right, x + 1);
    top = Math.min(top, y); bottom = Math.max(bottom, y + 1);
  }
  const bounds = left < right ? { left: (left - 256) / 3 - 1, top: (top - 256) / 3 - 1,
    right: (right - 256) / 3 + 1, bottom: (bottom - 256) / 3 + 1 } : fallback;
  envelopes.set(key, bounds);
  return bounds;
}
