/**
 * Keyboard → action mapping for the level-complete overlay.
 *
 * Mirrors game-over-keys.ts and pause-keys.ts: pure logic extracted out of the
 * React component so it is unit-testable under Node's type-stripping test
 * runner (.ts handled natively, no JSX transform required).
 *
 * Bindings (active only while the level-complete sheet is mounted):
 *   - Enter  → advance to the next level (when eligible, i.e. stars >= 1 and
 *              a next level exists). If the current level was failed (0 stars)
 *              Enter retries instead, matching the most likely player intent
 *              ("confirm / go forward").
 *   - KeyR   → retry the current level
 *   - Escape → back to the level-select screen
 *
 * Returns null for unhandled keys and whenever a modifier (Ctrl/Cmd/Alt/Shift)
 * is held, so the overlay never hijacks browser/OS shortcuts (Ctrl+Enter
 * submit, Cmd+Esc, Alt+R, Shift+R reload, etc.). Modifier-guarded Ctrl+R /
 * Cmd+R must pass through to the browser so players can still hard-reload.
 *
 * Space is never bound: it is the jump key, and a reflexive press should not
 * silently retry or skip the level-complete celebration animation.
 *
 * `canAdvance` is resolved by the caller (true only when the Next button would
 * be shown — at least one star earned AND a next level exists). The resolver
 * stays pure: it just combines that flag with the key state.
 */
export type LevelCompleteKeyAction = 'next' | 'retry' | 'back';

export function resolveLevelCompleteKey(
  code: string,
  modifiersActive: boolean,
  canAdvance: boolean,
): LevelCompleteKeyAction | null {
  if (modifiersActive) return null;
  if (code === 'Enter') return canAdvance ? 'next' : 'retry';
  if (code === 'KeyR') return 'retry';
  if (code === 'Escape') return 'back';
  return null;
}
