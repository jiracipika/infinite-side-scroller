#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const progressionPath = path.join(root, 'src/lib/progression.ts')
const charactersPath = path.join(root, 'src/game/data/characters.ts')

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8')
}

function fail(message) {
  throw new Error(message)
}

function extractNumbers(source, pattern) {
  return [...source.matchAll(pattern)].map((match) => Number(match[1]))
}

function assertUnique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) fail(`${label} has duplicate value: ${value}`)
    seen.add(value)
  }
}

function assertRange(values, label, min, max) {
  for (const value of values) {
    if (!Number.isFinite(value) || value < min || value > max) {
      fail(`${label} value ${value} is outside ${min}-${max}`)
    }
  }
}

function verifyProgression(source) {
  // Extract shop upgrade costs
  const upgradeCosts = extractNumbers(source, /cost:\s*(\d+)\s*\}/g)
  const upgradeIds = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((m) => m[1]).filter((id) =>
    !['slot1', 'slot2', 'slot3', 'knight', 'ninja', 'tank', 'mage', 'ranger', 'cyborg', 'spirit', 'healer'].includes(id)
  )

  if (upgradeCosts.length < 5) fail(`expected at least 5 shop upgrades, found ${upgradeCosts.length}`)
  assertRange(upgradeCosts, 'upgrade cost', 1, 10000)

  // Verify DEFAULT_PROGRESSION_BONUSES has all required fields
  const requiredBonusFields = [
    'speedMultiplier',
    'jumpMultiplier',
    'extraMaxHealth',
    'coinMultiplier',
    'magnetRadiusBonus',
    'magnetDurationMultiplier',
    'shieldDurationMultiplier',
    'dashCooldownMultiplier',
    'projectileDamageBonus',
    'projectileSpeedMultiplier',
    'autoReviveOnce',
    'healOnCoinChance',
  ]

  for (const field of requiredBonusFields) {
    if (!source.includes(field)) fail(`DEFAULT_PROGRESSION_BONUSES missing field: ${field}`)
  }

  // Verify slot IDs
  if (!source.includes("'slot1'") || !source.includes("'slot2'") || !source.includes("'slot3'")) {
    fail('save slot IDs slot1/slot2/slot3 must exist')
  }

  return { upgradeCount: upgradeCosts.length }
}

function verifyCharacterCosts(source) {
  const unlockCosts = extractNumbers(source, /\bunlockCost:\s*(\d+),/g)
  assertRange(unlockCosts, 'character unlockCost', 0, 10000)

  const healthValues = extractNumbers(source, /\bmaxHealth:\s*(\d+),/g)
  assertRange(healthValues, 'maxHealth', 1, 10)

  const baseUnlockedCount = [...source.matchAll(/\bbaseUnlocked:\s*true/g)].length
  if (baseUnlockedCount === 0) fail('at least one character must be baseUnlocked')

  return { characterCount: unlockCosts.length, baseUnlockedCount }
}

const progressionSummary = verifyProgression(read(progressionPath))
const characterSummary = verifyCharacterCosts(read(charactersPath))

console.log(`Progression verified: ${progressionSummary.upgradeCount} shop upgrades, ${characterSummary.characterCount} characters, ${characterSummary.baseUnlockedCount} base-unlocked, all bonus fields present.`);
