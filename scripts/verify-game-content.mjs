#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const levelsPath = path.join(root, 'src/game/data/levels.ts')
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

function verifyLevels(source) {
  const levelIds = extractNumbers(source, /\bid:\s*(\d+),/g)
  const targetDistances = extractNumbers(source, /\btargetDistance:\s*(\d+),/g)
  const enemyDensities = extractNumbers(source, /\benemyDensity:\s*([0-9.]+),/g)
  const hazardDensities = extractNumbers(source, /\bhazardDensity:\s*([0-9.]+),/g)
  const powerUpFrequencies = extractNumbers(source, /\bpowerUpFrequency:\s*([0-9.]+),/g)
  const thresholdMatches = [...source.matchAll(/starThresholds:\s*\{\s*one:\s*(\d+),\s*two:\s*(\d+),\s*three:\s*(\d+)\s*\}/g)]

  if (levelIds.length < 20) fail(`expected at least 20 levels, found ${levelIds.length}`)
  assertUnique(levelIds, 'level ids')
  assertRange(enemyDensities, 'enemyDensity', 0, 1)
  assertRange(hazardDensities, 'hazardDensity', 0, 1)
  assertRange(powerUpFrequencies, 'powerUpFrequency', 0, 1)

  if (targetDistances.length !== levelIds.length) fail('each level must have targetDistance')
  if (thresholdMatches.length !== levelIds.length) fail('each level must have starThresholds')

  thresholdMatches.forEach((match, index) => {
    const [one, two, three] = match.slice(1).map(Number)
    if (!(one <= two && two <= three)) {
      fail(`level ${levelIds[index] ?? index + 1} star thresholds are not ascending`)
    }
  })

  return { levelCount: levelIds.length }
}

function verifyCharacters(source) {
  const ids = [...source.matchAll(/\bid:\s*'([^']+)'/g)].map((match) => match[1])
  const unlockCosts = extractNumbers(source, /\bunlockCost:\s*(\d+),/g)
  const healthValues = extractNumbers(source, /\bmaxHealth:\s*(\d+),/g)
  const baseUnlockedCount = [...source.matchAll(/\bbaseUnlocked:\s*true/g)].length

  if (ids.length < 3) fail(`expected at least 3 characters, found ${ids.length}`)
  assertUnique(ids, 'character ids')
  assertRange(unlockCosts, 'unlockCost', 0, 10000)
  assertRange(healthValues, 'maxHealth', 1, 10)
  if (baseUnlockedCount === 0) fail('at least one character must be baseUnlocked')

  return { characterCount: ids.length, baseUnlockedCount }
}

const levelSummary = verifyLevels(read(levelsPath))
const characterSummary = verifyCharacters(read(charactersPath))

console.log(`Game content verified: ${levelSummary.levelCount} levels, ${characterSummary.characterCount} characters, ${characterSummary.baseUnlockedCount} base-unlocked character definitions.`)
