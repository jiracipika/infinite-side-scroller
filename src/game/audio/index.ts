/**
 * Audio barrel export.
 */

export { SfxEngine, type SfxName } from "./sfx";

/**
 * Process-wide singleton so the React layer and the game engine share one
 * AudioContext without having to thread instances through every constructor.
 * The instance is lazily created on first access in the browser.
 */

import { SfxEngine } from "./sfx";

let _instance: SfxEngine | null = null;

/** Returns the shared SfxEngine singleton (creates it on first call). */
export function getSfxEngine(): SfxEngine {
  if (!_instance) _instance = new SfxEngine();
  return _instance;
}

/** True when the singleton has been initialised. */
export function sfxEngineExists(): boolean {
  return _instance !== null;
}
