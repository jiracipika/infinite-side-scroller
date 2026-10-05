/**
 * Daily Dash seed derivation — the date → deterministic-world-seed hash that
 * powers the once-per-day ranked run. One shared world per UTC day for every
 * player: the same mulberry32 chunk stream, the same leaderboard race (the
 * online API binds run tokens to {mode, seed}, so this must never drift).
 *
 * FNV-1a over the ISO day string, folded into a 6-digit seed. Pure and
 * dependency-free so determinism is verifiable without a browser.
 */
export function getDailySeed(dayIso: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dayIso.length; i++) {
    hash ^= dayIso.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 900000) + 100000;
}
