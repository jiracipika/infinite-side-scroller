import { CHARACTER_SHEETS, CHARACTER_SHEET_LAYOUTS } from './character-sheets-data';
import type { CharacterArtPose } from './character-art';

/**
 * Sprite-sheet lane: pixel strips baked from the original character designs replace
 * the procedural ink painters per character, activated purely by asset
 * presence. A strip holds six frames with a shared body origin, in the order
 * idle, run, air, dash, melee, tumble (mirrors design/sheet pose taxonomy).
 * Until the data-URL image finishes loading — or for characters with no
 * sheet at all — drawCharacterArt falls back to the procedural painter,
 * which stays the test surface and the graceful-degradation path.
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
const listeners = new Map<string, Set<() => void>>();

function notifyCharacterArtChanged(id: string): void {
  listeners.get(id)?.forEach(listener => listener());
}

/** Menu canvases redraw when their image loads or their equipped style changes. */
export function subscribeCharacterArt(id: string, listener: () => void): () => void {
  const subscribers = listeners.get(id) ?? new Set<() => void>();
  subscribers.add(listener);
  listeners.set(id, subscribers);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(id);
  };
}

/** Kick one-shot async loads for every embedded sheet. Idempotent, never throws. */
export function ensureCharacterSheetsLoading(): void {
  if (loadStarted) return;
  if (typeof Image === 'undefined') return; // node/test or SSR context
  loadStarted = true;
  for (const [id, src] of Object.entries(CHARACTER_SHEETS)) {
    const img = new Image();
    img.onload = () => { images.set(id, img); notifyCharacterArtChanged(id); };
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

// Art-style preference: the ink (procedural) alternative unlocks per character
// through progression; when preferred, drawCharacterSheet declines so the
// procedural painter takes over. Module-level because the renderer path is
// synchronous and both the game page and the menus share one document.
const inkPreferred = new Set<string>();

export function setPreferredArtStyle(characterId: string, style: 'pixel' | 'ink'): void {
  const previous = preferredArtStyle(characterId);
  if (style === 'ink') inkPreferred.add(characterId);
  else inkPreferred.delete(characterId);
  if (previous !== style) notifyCharacterArtChanged(characterId);
}

export function preferredArtStyle(characterId: string): 'pixel' | 'ink' {
  return inkPreferred.has(characterId) ? 'ink' : 'pixel';
}

/**
 * Draw the character's sheet frame into the local 0..width / 0..height box.
 * The renderer's transform (facing flip, screen placement, bob) already wraps
 * this call. Returns false (drawing nothing) when the sheet is absent or not
 * loaded yet, so the caller falls back to the procedural painter. The sheet's
 * authored body origin stays aligned with the collision box in every pose;
 * capes, hair and weapons overhang it, just like the original ink masters.
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
  if (inkPreferred.has(characterId)) return false; // ink alternative unlocked + chosen
  const frame = sheetFrameForPose(pose);
  const layout = CHARACTER_SHEET_LAYOUTS[characterId];
  if (!layout) return false;
  const scaleX = width / layout.bodyWidth / layout.density;
  const scaleY = height / layout.bodyHeight / layout.density;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, frame * layout.frameWidth, 0, layout.frameWidth, layout.frameHeight,
    -layout.originX * scaleX, -layout.originY * scaleY,
    layout.frameWidth * scaleX, layout.frameHeight * scaleY);
  ctx.restore();
  return true;
}
