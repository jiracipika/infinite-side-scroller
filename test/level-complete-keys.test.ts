import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveLevelCompleteKey } from '@/components/level-complete-keys';

/**
 * Level-complete keyboard shortcut resolver.
 *
 * Enter advances when the player earned ≥1 star (and a next level exists),
 * otherwise Enter retries — matching "confirm / go forward" intent. KeyR
 * always retries. Escape always returns to level select.
 *
 * All bindings are suppressed when any modifier (Ctrl/Cmd/Alt/Shift) is held
 * so the overlay cannot hijack browser/OS shortcuts. Space is never bound
 * (it is the jump key).
 */
describe('resolveLevelCompleteKey', () => {
  describe('when advancement is eligible (canAdvance = true)', () => {
    it('Enter -> next', () => {
      assert.equal(resolveLevelCompleteKey('Enter', false, true), 'next');
    });

    it('KeyR -> retry', () => {
      assert.equal(resolveLevelCompleteKey('KeyR', false, true), 'retry');
    });

    it('Escape -> back', () => {
      assert.equal(resolveLevelCompleteKey('Escape', false, true), 'back');
    });
  });

  describe('when advancement is NOT eligible (0 stars or no next level)', () => {
    it('Enter falls back to retry (confirm / go-forward intent)', () => {
      // After a failed run (0 stars) there is no Next button; Enter should
      // still feel like "confirm" and replay the level rather than do nothing.
      assert.equal(resolveLevelCompleteKey('Enter', false, false), 'retry');
    });

    it('KeyR -> retry', () => {
      assert.equal(resolveLevelCompleteKey('KeyR', false, false), 'retry');
    });

    it('Escape -> back', () => {
      assert.equal(resolveLevelCompleteKey('Escape', false, false), 'back');
    });
  });

  it('returns null for unbound keys', () => {
    assert.equal(resolveLevelCompleteKey('Space', false, true), null);
    assert.equal(resolveLevelCompleteKey('KeyA', false, true), null);
    assert.equal(resolveLevelCompleteKey('ArrowUp', false, false), null);
    assert.equal(resolveLevelCompleteKey('Tab', false, true), null);
    assert.equal(resolveLevelCompleteKey('', false, false), null);
  });

  it('ignores all bindings when any modifier is held (no browser-shortcut hijacking)', () => {
    // Ctrl/Cmd/Alt/Shift+Enter, +KeyR, +Escape must all pass through.
    assert.equal(resolveLevelCompleteKey('Enter', true, true), null);
    assert.equal(resolveLevelCompleteKey('KeyR', true, false), null);
    assert.equal(resolveLevelCompleteKey('Escape', true, true), null);
  });

  it('never binds Space — the jump key — to avoid accidental actions', () => {
    // A reflexive Space press as the complete sheet appears must not skip the
    // star/score reveal or silently retry/advance the level.
    assert.equal(resolveLevelCompleteKey('Space', false, true), null);
    assert.equal(resolveLevelCompleteKey('Space', false, false), null);
  });
});
