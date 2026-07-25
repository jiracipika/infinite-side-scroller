#!/usr/bin/env node
/**
 * Verifies the hit-stop (freeze-frame) and distance milestone systems in
 * the game engine. Checks:
 *
 *  1. triggerHitStop / isHitStopActive are defined and public.
 *  2. Hit-stop timer is drained in the fixed-step loop (not real-time).
 *  3. Hit-stop is triggered from awardEnemyDefeat (scaled by enemy weight)
 *     and from the player damage handler.
 *  4. Hit-stop respects reduced-motion (duration halved when enabled).
 *  5. Distance milestones fire every 500m with a score popup + sfx cue.
 *  6. Both timers are reset on level restart/prepareOpeningFrame.
 *  7. Hit-stop visual accent is rendered during freeze (but not in
 *     reduced-motion mode).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const enginePath = path.join(root, 'src/game/engine/game-engine.ts')
const source = fs.readFileSync(enginePath, 'utf8')
const errors = []

function mustContain(pattern, label) {
  if (!pattern.test(source)) errors.push(`Missing: ${label}`)
}

// ── Hit-stop: public API ──────────────────────────────────────────
mustContain(/triggerHitStop\s*\(/, 'triggerHitStop method')
mustContain(/isHitStopActive\s*\(\s*\)\s*:\s*boolean/, 'isHitStopActive method')

// ── Hit-stop: timer field ─────────────────────────────────────────
mustContain(/private\s+hitStopTimer\s*=\s*0/, 'hitStopTimer field initialized to 0')

// ── Hit-stop: drained in the fixed-step loop ─────────────────────
mustContain(
  /hitStopTimer\s*=\s*Math\.max\s*\(\s*0\s*,\s*this\.hitStopTimer\s*-\s*FIXED_DT\s*\)/,
  'hit-stop timer drained by FIXED_DT in the loop',
)

// ── Hit-stop: called from enemy defeat (scaled by weight) ────────
mustContain(
  /enemyWeight\s*=\s*KILL_SCORES/,
  'enemy weight lookup from KILL_SCORES for hit-stop scaling',
)
mustContain(
  /enemyWeight\s*>=\s*500\s*\?\s*0\.08/,
  'boss-weight hit-stop duration (0.08s)',
)
mustContain(
  /enemyWeight\s*>=\s*200\s*\?\s*0\.05/,
  'mid-weight hit-stop duration (0.05s)',
)
mustContain(
  /0\.03\s*;\s*\/\/\s*common/,
  'common enemy hit-stop (0.03s) — fallback in ternary',
)

// ── Hit-stop: called from player damage handler ──────────────────
mustContain(
  /triggerHitStop\s*\(\s*0\.06\s*\)/,
  'player-damage hit-stop (0.06s)',
)

// ── Hit-stop: called from shield-break handler ───────────────────
mustContain(
  /triggerHitStop\s*\(\s*0\.07\s*\)/,
  'shield-break hit-stop (0.07s)',
)

// ── Hit-stop: reduced-motion contract ────────────────────────────
mustContain(
  /private\s+reducedMotion\s*=\s*false/,
  'reducedMotion field on GameEngine',
)
mustContain(
  /this\.reducedMotion\s*=\s*enabled/,
  'setReducedMotion sets the engine-level flag',
)
mustContain(
  /this\.reducedMotion\s*\?\s*duration\s*\*\s*0\.5/,
  'triggerHitStop halves duration when reducedMotion is active',
)

// ── Hit-stop: visual accent in render ────────────────────────────
mustContain(
  /this\.hitStopTimer\s*>\s*0\s*&&\s*!this\.reducedMotion/,
  'hit-stop visual accent rendered only during freeze and when not reduced-motion',
)

// ── Distance milestones: tracker + popup ─────────────────────────
mustContain(
  /private\s+lastDistanceMilestone\s*=\s*0/,
  'lastDistanceMilestone field initialized to 0',
)
mustContain(
  /MILESTONE_INTERVAL\s*=\s*500/,
  'milestone interval constant (500m)',
)
mustContain(
  /spawnScorePopup\s*\([^)]*milestoneReached/,
  'milestone popup using spawnScorePopup',
)
mustContain(
  /milestoneReached\s*>=\s*5000\s*\?\s*["']#FFD60A["']\s*:\s*["']#5AC8FA["']/,
  'milestone popup color: gold at 5000m+, blue below',
)

// ── Reset on restart ─────────────────────────────────────────────
mustContain(
  /this\.hitStopTimer\s*=\s*0/,
  'hitStopTimer reset to 0 on restart',
)
mustContain(
  /this\.lastDistanceMilestone\s*=\s*0/,
  'lastDistanceMilestone reset to 0 on restart',
)

if (errors.length > 0) {
  console.error('Hit-stop / milestone verification failed:')
  errors.forEach((e) => console.error('  ✗ ' + e))
  process.exit(1)
}

console.log(
  'Hit-stop & milestone verified: triggerHitStop/isHitStopActive API, ' +
  'enemy-defeat weight scaling, damage hit-stop, shield-break hit-stop, ' +
  'reduced-motion halving, distance milestone popups (500m interval), and restart resets.',
)
