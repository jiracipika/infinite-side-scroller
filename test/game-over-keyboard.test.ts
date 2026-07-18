import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveGameOverKey } from '@/components/game-over-keys';

/**
 * Game-over keyboard shortcut resolver.
 *
 * The game-over overlay binds Enter -> Play Again and Escape -> Main Menu, but
 * ONLY when no modifier keys are held. This prevents the overlay from hijacking
 * browser/OS shortcuts (Ctrl+Enter submit, Cmd+Esc, Alt+Space window menu,
 * Shift+Enter, etc.) and keeps the binding deterministic for unit testing
 * without a DOM.
 */
describe('resolveGameOverKey', () => {
  it('Enter (no modifiers) -> restart', () => {
    assert.equal(resolveGameOverKey('Enter', false), 'restart');
  });

  it('Escape (no modifiers) -> quit', () => {
    assert.equal(resolveGameOverKey('Escape', false), 'quit');
  });

  it('returns null for unbound keys', () => {
    assert.equal(resolveGameOverKey('Space', false), null);
    assert.equal(resolveGameOverKey('KeyA', false), null);
    assert.equal(resolveGameOverKey('ArrowUp', false), null);
    assert.equal(resolveGameOverKey('Tab', false), null);
    assert.equal(resolveGameOverKey('', false), null);
  });

  it('ignores Enter when any modifier is held (no browser-shortcut hijacking)', () => {
    // Ctrl+Enter, Cmd+Enter, Alt+Enter, Shift+Enter must all be passed through.
    assert.equal(resolveGameOverKey('Enter', true), null);
  });

  it('ignores Escape when any modifier is held', () => {
    assert.equal(resolveGameOverKey('Escape', true), null);
  });

  it('never binds Space — the jump key — to avoid accidental restart', () => {
    // A reflexive Space press at the moment of death must not skip the
    // count-up animation or instantly restart the run.
    assert.equal(resolveGameOverKey('Space', false), null);
  });
});
