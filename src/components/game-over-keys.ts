/**
 * Keyboard → action mapping for the game-over overlay.
 *
 * Extracted into its own module (rather than living inside GameOverScreen.tsx)
 * for two reasons:
 *   1. Pure logic has no business inside a React component file.
 *   2. It keeps the resolver unit-testable under Node's type-stripping test
 *      runner, which handles .ts natively without a JSX transform.
 *
 * Returns null for unhandled keys and whenever a modifier (Ctrl/Cmd/Alt/Shift)
 * is held, so the overlay never hijacks browser/OS shortcuts (Ctrl+Enter,
 * Cmd+Space, Shift+Esc, etc.).
 *
 * Deliberately does NOT bind Space: Space is the primary jump key, and binding
 * it here would let a reflexive re-press skip the count-up score animation the
 * instant the screen appears. Enter is an intentional "confirm" gesture.
 */
export type GameOverKeyAction = 'restart' | 'quit';

export function resolveGameOverKey(
  code: string,
  modifiersActive: boolean,
): GameOverKeyAction | null {
  if (modifiersActive) return null;
  if (code === 'Enter') return 'restart';
  if (code === 'Escape') return 'quit';
  return null;
}
