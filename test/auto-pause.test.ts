import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldAutoPause } from '@/components/auto-pause';

describe('shouldAutoPause', () => {
  it('pauses an active solo run when the page becomes hidden', () => {
    assert.equal(
      shouldAutoPause({
        gameState: 'playing',
        visibilityState: 'hidden',
        multiplayerActive: false,
      }),
      true,
    );
  });

  it('does not pause menus, already-paused runs, or visible pages', () => {
    for (const gameState of ['menu', 'paused', 'gameover'] as const) {
      assert.equal(
        shouldAutoPause({
          gameState,
          visibilityState: 'hidden',
          multiplayerActive: false,
        }),
        false,
      );
    }

    assert.equal(
      shouldAutoPause({
        gameState: 'playing',
        visibilityState: 'visible',
        multiplayerActive: false,
      }),
      false,
    );
  });

  it('does not freeze a multiplayer session when the page is hidden', () => {
    assert.equal(
      shouldAutoPause({
        gameState: 'playing',
        visibilityState: 'hidden',
        multiplayerActive: true,
      }),
      false,
    );
  });
});
