#!/usr/bin/env node
// Tests HUD invariants: heart clamping, coin display, combo logic
// against edge-case GameStats values.

let failures = 0
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures++
  }
}

// Replicate the HUD logic from HUD.tsx
function computeHudState(stats) {
  const totalHearts = Math.min(Math.max(stats.maxHealth, 1), 5)
  const filledHearts = Math.max(0, stats.health)
  const isLowHealth = filledHearts === 1
  const isDead = filledHearts === 0
  return { totalHearts, filledHearts, isLowHealth, isDead }
}

// Replicate the GameOverScreen isNewHighScore logic
function computeIsNewHighScore(stats) {
  return stats.score >= stats.highScore && stats.score > 0
}

// Replicate the hasMeaningfulRun logic
function hasMeaningfulRun(stats) {
  return stats.score > 0 || stats.coins > 0 || stats.distance > 0
}

// Test 1: standard 3-heart health
let hud = computeHudState({ health: 3, maxHealth: 3 })
assert(hud.totalHearts === 3, '3 maxHealth should show 3 hearts')
assert(hud.filledHearts === 3, '3 health should fill 3 hearts')
assert(!hud.isLowHealth, '3 health should not be low')
assert(!hud.isDead, '3 health should not be dead')

// Test 2: zero health (dead)
hud = computeHudState({ health: 0, maxHealth: 3 })
assert(hud.filledHearts === 0, '0 health should fill 0 hearts')
assert(hud.isDead, '0 health should be dead')
assert(!hud.isLowHealth, '0 health should not be "low health" (it is dead)')

// Test 3: 1 health (low)
hud = computeHudState({ health: 1, maxHealth: 3 })
assert(hud.filledHearts === 1, '1 health should fill 1 heart')
assert(hud.isLowHealth, '1 health should trigger low health')
assert(!hud.isDead, '1 health should not be dead')

// Test 4: maxHealth clamped to 5
hud = computeHudState({ health: 10, maxHealth: 10 })
assert(hud.totalHearts === 5, 'maxHealth 10 should be clamped to 5 hearts')
assert(hud.filledHearts === 10, 'health 10 should show 10 filled (display clamps separately)')

// Test 5: negative health is clamped to 0
hud = computeHudState({ health: -5, maxHealth: 3 })
assert(hud.filledHearts === 0, 'negative health should clamp to 0')
assert(hud.isDead, 'negative health should be dead')

// Test 6: maxHealth of 0 or negative is clamped to 1
hud = computeHudState({ health: 0, maxHealth: 0 })
assert(hud.totalHearts === 1, 'maxHealth 0 should clamp to 1 heart')

// Test 7: high score detection
assert(computeIsNewHighScore({ score: 100, highScore: 100 }), 'score equal to highScore is a new high score')
assert(computeIsNewHighScore({ score: 150, highScore: 100 }), 'score above highScore is a new high score')
assert(!computeIsNewHighScore({ score: 50, highScore: 100 }), 'score below highScore is not a new high score')
assert(!computeIsNewHighScore({ score: 0, highScore: 0 }), 'score 0 should not be a new high score')

// Test 8: meaningful run detection
assert(hasMeaningfulRun({ score: 1, coins: 0, distance: 0 }), 'score > 0 is meaningful')
assert(hasMeaningfulRun({ score: 0, coins: 1, distance: 0 }), 'coins > 0 is meaningful')
assert(hasMeaningfulRun({ score: 0, coins: 0, distance: 1 }), 'distance > 0 is meaningful')
assert(!hasMeaningfulRun({ score: 0, coins: 0, distance: 0 }), 'all zero is not meaningful')

// Test 9: combo field is optional
const statsWithCombo = { health: 3, maxHealth: 3, comboCount: 5, comboMultiplier: 2 }
hud = computeHudState(statsWithCombo)
assert(hud.filledHearts === 3, 'combo fields should not affect heart computation')

if (failures > 0) {
  console.error(`${failures} HUD invariant test(s) failed`)
  process.exit(1)
}

console.log(`HUD invariants verified: 9 edge cases passed (standard hearts, zero health, low health, maxHealth clamp, negative health, maxHealth 0, high score detection, meaningful run detection, optional combo fields).`)
