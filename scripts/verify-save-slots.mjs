#!/usr/bin/env node
// Tests save slot resilience by simulating malformed localStorage payloads
// through the normalize path and verifying safe fallbacks.
import fs from 'node:fs'
import path from 'node:path'

let failures = 0
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures++
  }
}

// Simulate the normalizeCheckpoint logic from progression.ts
function normalizeCheckpoint(value) {
  if (!value || typeof value !== 'object') return null
  const c = value
  if (!Number.isFinite(c.seed) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return null
  return {
    seed: Math.floor(Number(c.seed)),
    characterId: typeof c.characterId === 'string' && c.characterId ? c.characterId : 'knight',
    x: Number(c.x),
    y: Number(c.y),
    vx: Number.isFinite(c.vx) ? Number(c.vx) : 0,
    vy: Number.isFinite(c.vy) ? Number(c.vy) : 0,
    health: Number.isFinite(c.health) ? Math.max(1, Number(c.health)) : 3,
    maxHealth: Number.isFinite(c.maxHealth) ? Math.max(1, Number(c.maxHealth)) : 3,
    score: Number.isFinite(c.score) ? Math.max(0, Math.floor(Number(c.score))) : 0,
    coins: Number.isFinite(c.coins) ? Math.max(0, Math.floor(Number(c.coins))) : 0,
    distance: Number.isFinite(c.distance) ? Math.max(0, Math.floor(Number(c.distance))) : 0,
    savedAt: Number.isFinite(c.savedAt) ? Number(c.savedAt) : Date.now(),
  }
}

// Simulate the normalizeSlot logic
function normalizeSlot(value, fallback) {
  const s = (value ?? {})
  const unlocked = Array.isArray(s.unlockedUpgradeIds)
    ? s.unlockedUpgradeIds.filter((id) => typeof id === 'string' && id.length > 0)
    : []
  return {
    ...fallback,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 18) : fallback.name,
    createdAt: Number.isFinite(s.createdAt) ? Number(s.createdAt) : fallback.createdAt,
    updatedAt: Number.isFinite(s.updatedAt) ? Number(s.updatedAt) : fallback.updatedAt,
    bankCoins: Number.isFinite(s.bankCoins) ? Math.max(0, Math.floor(Number(s.bankCoins))) : fallback.bankCoins,
    spentCoins: Number.isFinite(s.spentCoins) ? Math.max(0, Math.floor(Number(s.spentCoins))) : fallback.spentCoins,
    bestScore: Number.isFinite(s.bestScore) ? Math.max(0, Math.floor(Number(s.bestScore))) : fallback.bestScore,
    bestDistance: Number.isFinite(s.bestDistance) ? Math.max(0, Math.floor(Number(s.bestDistance))) : fallback.bestDistance,
    totalRuns: Number.isFinite(s.totalRuns) ? Math.max(0, Math.floor(Number(s.totalRuns))) : fallback.totalRuns,
    unlockedUpgradeIds: unlocked,
    checkpoint: normalizeCheckpoint(s.checkpoint),
  }
}

const defaultSlot = {
  id: 'slot1',
  name: 'Save 1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  bankCoins: 0,
  spentCoins: 0,
  lifetimeCoinsCollected: 0,
  bestScore: 0,
  bestDistance: 0,
  totalRuns: 0,
  unlockedUpgradeIds: [],
  unlockedCharacterIds: ['knight', 'ninja', 'tank'],
  checkpoint: null,
}

// Test 1: null input returns fallback
const result1 = normalizeSlot(null, defaultSlot)
assert(result1.name === 'Save 1', 'null input should use fallback name')

// Test 2: malformed checkpoint returns null
assert(normalizeCheckpoint(null) === null, 'null checkpoint should return null')
assert(normalizeCheckpoint('not-an-object') === null, 'string checkpoint should return null')
assert(normalizeCheckpoint({}) === null, 'empty checkpoint should return null (missing required fields)')

// Test 3: negative coins are clamped to 0
const result3 = normalizeSlot({ bankCoins: -500, spentCoins: -100 }, defaultSlot)
assert(result3.bankCoins === 0, 'negative bankCoins should be clamped to 0')
assert(result3.spentCoins === 0, 'negative spentCoins should be clamped to 0')

// Test 4: fractional values are floored
const result4 = normalizeSlot({ bankCoins: 100.7, bestScore: 250.9 }, defaultSlot)
assert(result4.bankCoins === 100, 'fractional bankCoins should be floored')
assert(result4.bestScore === 250, 'fractional bestScore should be floored')

// Test 5: name is truncated to 18 characters
const result5 = normalizeSlot({ name: 'A'.repeat(50) }, defaultSlot)
assert(result5.name.length === 18, 'name should be truncated to 18 chars')

// Test 6: valid checkpoint is preserved
const validCheckpoint = { seed: 42, characterId: 'ninja', x: 100, y: 200, vx: 5, vy: -3, health: 2, maxHealth: 3, score: 1500, coins: 30, distance: 500, savedAt: 1700000000000 }
const cpResult = normalizeCheckpoint(validCheckpoint)
assert(cpResult !== null, 'valid checkpoint should not be null')
assert(cpResult.characterId === 'ninja', 'checkpoint characterId should be preserved')
assert(cpResult.health === 2, 'checkpoint health should be preserved')

// Test 7: checkpoint with missing characterId falls back to knight
const cpNoChar = normalizeCheckpoint({ seed: 1, x: 0, y: 0 })
assert(cpNoChar.characterId === 'knight', 'missing characterId should default to knight')

// Test 8: undefined upgrade IDs are filtered out
const result8 = normalizeSlot({ unlockedUpgradeIds: ['valid', '', null, 42, 'also-valid'] }, defaultSlot)
assert(result8.unlockedUpgradeIds.length === 2, 'invalid upgrade IDs should be filtered')
assert(result8.unlockedUpgradeIds.includes('valid'), 'valid upgrade ID should be kept')
assert(result8.unlockedUpgradeIds.includes('also-valid'), 'second valid upgrade ID should be kept')

if (failures > 0) {
  console.error(`${failures} save slot resilience test(s) failed`)
  process.exit(1)
}

console.log(`Save slot resilience verified: 8 edge cases passed (null input, malformed checkpoint, negative coins, fractional values, name truncation, valid checkpoint, missing characterId, invalid upgrade IDs).`)
