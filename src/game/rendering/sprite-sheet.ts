import { CHARACTER_SHEETS } from './character-sheets-data';
import type { CharacterArtPose } from './character-art';

/**
 * Sprite-sheet lane of the art overhaul: hand-painted Aseprite strips are a
 * per-character alternative to the original ink painters (which are the
 * default identity), activated purely by asset presence plus the player's
 * style choice. A strip is 192x32 — six 32x32 frames in the fixed order
 * idle, run, air, dash, melee, tumble (mirrors design/sheet pose taxonomy).
 * Until the data-URL image finishes loading — or whenever ink is preferred —
 * drawCharacterSheet declines and the procedural painter draws, which stays
 * the test surface and the graceful-degradation path.
 */
export const SHEET_FRAME = { idle: 0, run: 1, air: 2, dash: 3, melee: 4, tumble: 5 } as const;

/** Pure pose→frame mapping so tests can pin the precedence without a DOM. */
export function sheetFrameForPose(pose: CharacterArtPose): number {
  if ((pose.tumble ?? 0) > 0) return SHEET_FRAME.tumble;
  if (pose.dashing) return SHEET_FRAME.dash;
  if ((pose.melee ?? 0) > 0) return SHEET_FRAME.melee;
  if (pose.airborne) return SHEET_FRAME.air;
  // drawPlayer keeps a small idle sway alive; only a real stride reads as running.
  return Math.abs(pose.stride ?? 0) > 0.5 ? SHEET_FRAME.run : SHEET_FRAME.idle;
}

const images = new Map<string, HTMLImageElement>();
let loadStarted = false;

/** Kick one-shot async loads for every embedded sheet. Idempotent, never throws. */
export function ensureCharacterSheetsLoading(): void {
  if (loadStarted) return;
  loadStarted = true;
  if (typeof Image === 'undefined') return; // node/test or SSR context
  for (const [id, src] of Object.entries(CHARACTER_SHEETS)) {
    const img = new Image();
    img.onload = () => { images.set(id, img); };
    img.src = src;
  }
}

export function characterSheetReady(id: string): boolean {
  return images.has(id);
}

/** True when a painted strip ships for this character (drives the style toggle UI). */
export function characterHasSheet(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHARACTER_SHEETS, id);
}

// Art-style preference: the original ink painters are the default identity;
// characters that ship a painted sheet may opt into it per character. Module-
// level because the renderer path is synchronous and both the game page and
// the menus share one document.
const pixelPreferred = new Set<string>();

export function setPreferredArtStyle(characterId: string, style: 'pixel' | 'ink'): void {
  if (style === 'pixel') pixelPreferred.add(characterId);
  else pixelPreferred.delete(characterId);
}

export function preferredArtStyle(characterId: string): 'pixel' | 'ink' {
  return pixelPreferred.has(characterId) ? 'pixel' : 'ink';
}

/**
 * Draw the character's sheet frame into the local 0..width / 0..height box.
 * The renderer's transform (facing flip, screen placement, bob) already wraps
 * this call. Returns false (drawing nothing) when the sheet is absent or not
 * loaded yet, so the caller falls back to the procedural painter. The square
 * frame is drawn at height×height centered on the narrower hitbox: the
 * silhouette may overhang the collision box — pixels, never physics.
 */
export function drawCharacterSheet(
  ctx: CanvasRenderingContext2D,
  characterId: string,
  width: number,
  height: number,
  pose: CharacterArtPose = {},
): boolean {
  const img = images.get(characterId);
  if (!img) return false;
  if (pixelPreferred.has(characterId)) return false; // painted sheets opted out — ink painter draws
  const frame = sheetFrameForPose(pose);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * 32, 0, 32, 32, -(height - width) / 2, 0, height, height);
  return true;
}
