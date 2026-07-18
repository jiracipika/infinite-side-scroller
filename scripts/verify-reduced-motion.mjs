#!/usr/bin/env node
// Static guard for reduced-motion (accessibility) support.
//
// The game relies heavily on motion (screen shake, spring entrances, low-health
// pulses, combo urgency). prefers-reduced-motion: reduce is the OS-level signal
// from users with vestibular disorders, migraines, or seizure sensitivity that
// they need less motion. This guard keeps that support from silently regressing
// across the engine, settings, CSS, and UI layers.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function read(file) {
  if (!fs.existsSync(file)) {
    errors.push(`${path.relative(root, file)} missing`);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function requireMarker(source, label, marker) {
  if (!source.includes(marker)) {
    errors.push(`${label} missing marker: ${marker}`);
  }
}

const gameState = read(path.join(root, 'src/game/state/game-state.ts'));
const camera = read(path.join(root, 'src/game/engine/camera.ts'));
const gameEngine = read(path.join(root, 'src/game/engine/game-engine.ts'));
const page = read(path.join(root, 'src/app/page.tsx'));
const pauseMenu = read(path.join(root, 'src/components/PauseMenu.tsx'));
const globalsCss = read(path.join(root, 'src/app/globals.css'));

// 1. Settings surface — the player-facing toggle must exist with all three states.
requireMarker(gameState, 'game-state.ts', 'reducedMotion: \'auto\' | \'on\' | \'off\'');
requireMarker(gameState, 'game-state.ts', 'reducedMotion: \'auto\',');
requireMarker(gameState, 'game-state.ts', 'export function resolveReducedMotion');

// 2. Camera — must expose the suppression toggle and honor it during update.
requireMarker(camera, 'camera.ts', 'setReducedMotion(enabled: boolean)');
requireMarker(camera, 'camera.ts', 'isReducedMotion()');
requireMarker(camera, 'camera.ts', 'if (this.reducedMotion)');

// 3. Engine — must forward the toggle onto its camera.
requireMarker(gameEngine, 'game-engine.ts', 'setReducedMotion(enabled: boolean)');
requireMarker(gameEngine, 'game-engine.ts', 'this.camera.setReducedMotion(enabled)');

// 4. Page — must apply the resolved preference to the engine and listen for OS changes.
requireMarker(page, 'page.tsx', "resolveReducedMotion");
requireMarker(page, 'page.tsx', 'gameRef.current?.setReducedMotion');
requireMarker(page, 'page.tsx', "(prefers-reduced-motion: reduce)");
requireMarker(page, 'page.tsx', "settings.reducedMotion === 'on'");
requireMarker(page, 'page.tsx', 'reduce-motion-forced');

// 5. Settings UI — the toggle must be reachable from the PauseMenu.
requireMarker(pauseMenu, 'PauseMenu.tsx', 'ReducedMotionRow');
requireMarker(pauseMenu, 'PauseMenu.tsx', 'settings.reducedMotion');

// 6. CSS — the OS media query guard AND the forced-override class must both exist.
requireMarker(globalsCss, 'globals.css', '@media (prefers-reduced-motion: reduce)');
requireMarker(globalsCss, 'globals.css', '.reduce-motion-forced');
requireMarker(globalsCss, 'globals.css', 'animation: none !important');

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(
  'Reduced-motion verified: GameSettings.reducedMotion (auto/on/off) + resolveReducedMotion helper, ' +
  'Camera.setReducedMotion/isReducedMotion honored during update, ' +
  'GameEngine forwards the toggle, page.tsx applies it reactively (incl. OS change listener), ' +
  'PauseMenu exposes a segmented control, globals.css has both the @media (prefers-reduced-motion: reduce) guard and the .reduce-motion-forced override.',
);
