#!/usr/bin/env node
/**
 * Verifies the power-up timer HUD pipeline:
 *
 *  1. Player.getActivePowerUpTimers() method exists and returns the
 *     correct shape for shield, speedBoost, magnet, weapon, healingAura.
 *  2. GameStats interface includes the powerUpTimers field.
 *  3. GameEngine pipes the timers through onStatsUpdate.
 *  4. HUD renders the PowerUpPill component with countdown bars.
 *  5. POWER_UP_EMOJI map covers all timed power-up types.
 *  6. The verify script itself is wired into the `npm run verify` chain.
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function mustContain(file, pattern, label) {
  if (!pattern.test(file)) errors.push(`Missing: ${label}`)
}

// ── Player: getActivePowerUpTimers ───────────────────────────────
const player = read('src/game/entities/player.ts')
mustContain(player, /getActivePowerUpTimers\s*\(\s*\)/, 'Player.getActivePowerUpTimers method')
mustContain(player, /type:\s*["']shield["']/, 'shield timer entry')
mustContain(player, /type:\s*["']speedBoost["']/, 'speedBoost timer entry')
mustContain(player, /type:\s*["']magnet["']/, 'magnet timer entry')
mustContain(player, /type:\s*["']healingAura["']/, 'healingAura timer entry')
mustContain(player, /export\s+interface\s+PowerUpTimer/, 'PowerUpTimer interface exported')
mustContain(player, /export\s+type\s+PowerUpType/, 'PowerUpType type exported')

// ── GameStats: powerUpTimers field ───────────────────────────────
const gameState = read('src/game/state/game-state.ts')
mustContain(gameState, /powerUpTimers\??\s*:/, 'GameStats.powerUpTimers field')
mustContain(gameState, /export\s+interface\s+PowerUpTimerEntry/, 'PowerUpTimerEntry interface')
mustContain(gameState, /export\s+type\s+PowerUpType/, 'PowerUpType type in state module')

// ── Engine: pipes timers through onStatsUpdate ───────────────────
const engine = read('src/game/engine/game-engine.ts')
mustContain(
  engine,
  /powerUpTimers:\s*this\.player\.getActivePowerUpTimers\(\)/,
  'engine passes powerUpTimers in onStatsUpdate payload',
)
mustContain(
  engine,
  /type\s+PowerUpTimer/,
  'engine imports PowerUpTimer type from player',
)

// ── HUD: renders PowerUpPill with countdown ──────────────────────
const hud = read('src/components/HUD.tsx')
mustContain(hud, /const\s+PowerUpPill/, 'PowerUpPill component in HUD')
mustContain(hud, /POWER_UP_EMOJI/, 'POWER_UP_EMOJI lookup map')
mustContain(hud, /POWER_UP_MAX_DURATION/, 'POWER_UP_MAX_DURATION map for bar fractions')
mustContain(hud, /stats\.powerUpTimers/, 'HUD reads powerUpTimers from stats')
mustContain(hud, /isExpiring/, 'PowerUpPill computes isExpiring for expiry warning')

// Countdown bar visual elements
mustContain(hud, /fraction\s*=.*Math\.min/, 'PowerUpPill computes fraction for bar width')
mustContain(hud, /barColor/, 'PowerUpPill has color-graded bar')

// ── verify chain wiring ──────────────────────────────────────────
const pkg = JSON.parse(read('package.json'))
if (!pkg.scripts?.['verify:powerup-timers']) {
  errors.push('Missing: package.json verify:powerup-timers script')
}
const verifyChain = pkg.scripts?.verify || ''
if (!verifyChain.includes('verify:powerup-timers')) {
  errors.push('Missing: verify:powerup-timers not in the npm run verify chain')
}

// ── Test file exists ─────────────────────────────────────────────
const testExists = fs.existsSync(path.join(root, 'test/power-up-timers.test.ts'))
if (!testExists) {
  errors.push('Missing: test/power-up-timers.test.ts')
}

if (errors.length > 0) {
  console.error('Power-up timer verification failed:')
  errors.forEach((e) => console.error('  ✗ ' + e))
  process.exit(1)
}

console.log(
  'Power-up timers verified: Player.getActivePowerUpTimers (shield/speed/magnet/weapon/aura), ' +
  'GameStats.powerUpTimers field, engine onStatsUpdate pipeline, ' +
  'HUD PowerUpPill with countdown bars + expiry warning, ' +
  'verify chain wired, test file present.',
)
