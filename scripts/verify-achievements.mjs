#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const achievementsPath = path.join(process.cwd(), 'src/lib/achievements.ts')
const source = fs.readFileSync(achievementsPath, 'utf8')

function fail(message) {
  throw new Error(message)
}

// Extract achievement IDs from the source
const idMatches = [...source.matchAll(/\bid:\s*'([^']+)'/g)]
const ids = idMatches.map((m) => m[1])

if (ids.length < 5) fail(`expected at least 5 achievements, found ${ids.length}`)

// Check for duplicate IDs
const seen = new Set()
for (const id of ids) {
  if (seen.has(id)) fail(`duplicate achievement ID: ${id}`)
  seen.add(id)
}

// Check that every achievement has a title and desc
const titleMatches = [...source.matchAll(/\btitle:\s*'([^']+)'/g)]
const descMatches = [...source.matchAll(/\bdesc:\s*'([^']+)'/g)]

if (titleMatches.length < ids.length) fail(`found ${titleMatches.length} titles for ${ids.length} achievements`)
if (descMatches.length < ids.length) fail(`found ${descMatches.length} descriptions for ${ids.length} achievements`)

for (const title of titleMatches) {
  if (!title[1].trim()) fail('achievement title is empty')
}
for (const desc of descMatches) {
  if (!desc[1].trim()) fail('achievement description is empty')
}

// Check that every achievement has a condition function
const conditionMatches = [...source.matchAll(/\bcondition:\s*\(/g)]
if (conditionMatches.length < ids.length) fail(`found ${conditionMatches.length} conditions for ${ids.length} achievements`)

// Verify the default stats object has all required fields
const requiredStatFields = ['totalGames', 'highScore', 'totalDistance', 'totalCoins', 'bestDistance', 'bestCoins']
for (const field of requiredStatFields) {
  if (!source.includes(field)) fail(`AchievementStats missing field: ${field}`)
}

// Verify persistence functions exist
const requiredFunctions = ['loadUnlockedAchievements', 'saveUnlockedAchievements', 'loadLifetimeStats']
for (const fn of requiredFunctions) {
  if (!source.includes(`function ${fn}`) && !source.includes(`${fn}(`)) {
    fail(`missing persistence function: ${fn}`)
  }
}

console.log(`Achievements verified: ${ids.length} achievements, ${conditionMatches.length} condition functions, all persistence functions present.`);
