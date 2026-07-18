import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolvePauseKey } from '@/components/pause-keys';

/**
 * Pause-menu keyboard shortcut resolver.
 *
 * While the pause sheet is mounted, KeyR -> Restart and KeyQ -> Main Menu, but
 * ONLY when no modifier keys are held. This prevents the overlay from hijacking
 * browser/OS shortcuts (Ctrl+R reload, Cmd+Q quit browser, Alt+Q, Shift+R) and
 * keeps the binding deterministic for unit testing without a DOM.
 *
 * Escape is intentionally not bound by the resolver: page.tsx owns the global
 * Escape toggle, so the resolver need not (and must not) handle it.
 */
describe('resolvePauseKey', () => {
  it('KeyR (no modifiers) -> restart', () => {
    assert.equal(resolvePauseKey('KeyR', false), 'restart');
  });

  it('KeyQ (no modifiers) -> quit', () => {
    assert.equal(resolvePauseKey('KeyQ', false), 'quit');
  });

  it('returns null for unbound keys', () => {
    assert.equal(resolvePauseKey('Space', false), null);
    assert.equal(resolvePauseKey('KeyA', false), null);
    assert.equal(resolvePauseKey('ArrowUp', false), null);
    assert.equal(resolvePauseKey('Tab', false), null);
    assert.equal(resolvePauseKey('', false), null);
  });

  it('ignores KeyR when any modifier is held (no browser-shortcut hijacking)', () => {
    // Ctrl+R / Cmd+R must pass through to the browser so players can hard-reload.
    assert.equal(resolvePauseKey('KeyR', true), null);
  });

  it('ignores KeyQ when any modifier is held', () => {
    // Ctrl+Q / Cmd+Q must pass through so the browser/OS can quit.
    assert.equal(resolvePauseKey('KeyQ', true), null);
  });

  it('never binds Space — the jump key — to avoid accidental restart/quit', () => {
    assert.equal(resolvePauseKey('Space', false), null);
  });

  it('does not bind Escape — page.tsx owns the global Escape toggle', () => {
    // Binding Escape here would double-fire the resume action because page.tsx
    // already resumes on Escape when state === "paused".
    assert.equal(resolvePauseKey('Escape', false), null);
  });

  it('does not bind Enter — reserved for the game-over overlay and confirm buttons', () => {
    assert.equal(resolvePauseKey('Enter', false), null);
  });
});
