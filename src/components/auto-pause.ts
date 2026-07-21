import type { GameState } from '@/game/state/game-state';

interface AutoPauseContext {
  gameState: GameState;
  visibilityState: DocumentVisibilityState;
  multiplayerActive: boolean;
}

/**
 * Decide whether a visibility transition should pause gameplay.
 *
 * Solo runs pause when the app is backgrounded so a phone call, app switch,
 * or locked screen cannot cost the player health. Multiplayer stays live to
 * avoid freezing only one participant while the shared session continues.
 */
export function shouldAutoPause({
  gameState,
  visibilityState,
  multiplayerActive,
}: AutoPauseContext): boolean {
  return (
    gameState === 'playing'
    && visibilityState === 'hidden'
    && !multiplayerActive
  );
}
