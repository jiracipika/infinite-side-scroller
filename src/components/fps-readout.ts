/**
 * FPS / frame-time bucketing — pure logic extracted out of HUD.tsx so it is
 * unit-testable under Node's type-stripping test runner (.ts handled natively,
 * no JSX transform required).
 *
 * Mirrors the established pattern of game-over-keys.ts / pause-keys.ts /
 * level-complete-keys.ts: keep pure helpers out of the React component file.
 *
 * Thresholds intentionally match the engine's adaptive-quality bands
 * (game-engine.ts updateAdaptiveQuality):
 *   - fps >= 50  → 'good' (engine runs at "high" quality)
 *   - 30..49     → 'ok'   (engine holds "medium" quality)
 *   - fps < 30   → 'bad'  (engine drops to "low" quality, reduces particles)
 *
 * Keeping these in sync means the on-screen color reflects what the engine is
 * actually doing, not an arbitrary visual threshold.
 */
export type FpsBucket = 'good' | 'ok' | 'bad';

export function fpsBucket(fps: number): FpsBucket {
  if (fps >= 50) return 'good';
  if (fps >= 30) return 'ok';
  return 'bad';
}
