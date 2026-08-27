/**
 * Audio barrel export.
 */

export { SfxEngine, type SfxName } from "./sfx";
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
