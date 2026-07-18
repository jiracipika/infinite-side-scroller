/**
 * Keyboard → action mapping for the pause overlay.
 *
 * Mirrors game-over-keys.ts: pure logic extracted out of the React component so
 * it is unit-testable under Node's type-stripping test runner (.ts handled
 * natively, no JSX transform required).
 *
 * Bindings (active only while the pause sheet is mounted):
 *   - KeyR → restart the current run
 *   - KeyQ → quit to the main menu
 *
 * Escape is deliberately NOT bound here: page.tsx already owns the global
 * Escape toggle (playing ⇄ paused), so binding it again would double-fire the
 * resume action. When the menu is open, that global handler resumes on Esc,
 * which is the desired behavior, so we leave it to the page.
 *
 * Returns null for unhandled keys and whenever a modifier (Ctrl/Cmd/Alt/Shift)
 * is held, so the overlay never hijacks browser/OS shortcuts (Ctrl+Q close
 * window, Cmd+R hard reload, Alt+Q, Shift+R, etc.). Modifier-guarded Ctrl+R /
 * Cmd+R must pass through to the browser so players can still hard-reload.
 *
 * Space is never bound: it is the jump key, and a reflexive press should never
 * silently restart or quit a run from the pause screen.
 */
export type PauseKeyAction = 'restart' | 'quit';

export function resolvePauseKey(
  code: string,
  modifiersActive: boolean,
): PauseKeyAction | null {
  if (modifiersActive) return null;
  if (code === 'KeyR') return 'restart';
  if (code === 'KeyQ') return 'quit';
  return null;
}
