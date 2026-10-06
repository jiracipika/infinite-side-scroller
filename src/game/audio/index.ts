/**
 * Audio barrel export.
 */

export { SfxEngine, landingGainScale, type SfxName } from "./sfx";
export { MusicEngine } from "./music";

/**
 * Process-wide singletons so the React layer and the game engine share one
 * AudioContext per engine without having to thread instances through every
 * constructor. Instances are lazily created on first access in the browser.
 */

import { SfxEngine } from "./sfx";
import { MusicEngine } from "./music";

let _instance: SfxEngine | null = null;
let _musicInstance: MusicEngine | null = null;

/** Returns the shared SfxEngine singleton (creates it on first call). */
export function getSfxEngine(): SfxEngine {
  if (!_instance) _instance = new SfxEngine();
  return _instance;
}

/** True when the singleton has been initialised. */
export function sfxEngineExists(): boolean {
  return _instance !== null;
}

/** Returns the shared MusicEngine singleton (creates it on first call). */
export function getMusicEngine(): MusicEngine {
  if (!_musicInstance) _musicInstance = new MusicEngine();
  return _musicInstance;
}

/** True when the music singleton has been initialised. */
export function musicEngineExists(): boolean {
  return _musicInstance !== null;
}

/* ── UI-boundary SFX helpers ────────────────────────────────────────────
 *
 * The engine triggers gameplay sounds itself (this.sfx.play in
 * game-engine.ts). React components use these helpers instead so every
 * interactive surface shares one gated entry point. All gating stays in
 * SfxEngine.play(): nothing sounds when SFX are disabled, when sfxVolume
 * is 0, or outside a browser (ensureContext's SSR guard). Fire-and-forget
 * and never throwing, so a broken AudioContext can't take a click handler
 * down with it.
 */

/** Discrete UI click — button presses, toggle flips, tab picks. */
export function playUiClick(): void {
  try {
    getSfxEngine().play("click");
  } catch {
    /* audio must never break an interaction */
  }
}

/** Keys that adjust a range input — each keyup is one discrete change. */
const SLIDER_ADJUST_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

/**
 * Slider-keyboard variant of the UI click. Range inputs fire change for
 * every adjust key AND every drag step; wiring onKeyUp through this (and
 * onPointerUp through playUiClick) keeps the click discrete — one per
 * release, one per key press — instead of spamming per drag step.
 */
export function playUiClickOnAdjustKey(e: { key: string }): void {
  if (!SLIDER_ADJUST_KEYS.has(e.key)) return;
  playUiClick();
}

/** Secret coin code accepted — short ascending chime. */
export function playRedeemSuccess(): void {
  try {
    getSfxEngine().play("redeemSuccess");
  } catch {
    /* audio must never break an interaction */
  }
}

/** Secret coin code rejected — short low buzz. */
export function playRedeemReject(): void {
  try {
    getSfxEngine().play("redeemReject");
  } catch {
    /* audio must never break an interaction */
  }
}

/** Shop purchase succeeded — the register rings (short two-hit chime). */
export function playPurchase(): void {
  try {
    getSfxEngine().play("purchase");
  } catch {
    /* audio must never break an interaction */
  }
}
