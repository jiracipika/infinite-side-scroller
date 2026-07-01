#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const enginePath = path.join(root, 'src/game/engine/game-engine.ts')
const callsiteFiles = [
  path.join(root, 'src/app/page.tsx'),
  path.join(root, 'src/components/SplitScreenMode.tsx'),
]

const engineSource = fs.readFileSync(enginePath, 'utf8')
const callsiteSource = callsiteFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n')
const errors = []

const requiredMethods = [
  'setMultiplayerEnabled',
  'setMultiplayerHostId',
  'getLocalPlayerSnapshot',
  'setRemotePlayerState',
  'reconcileLocalAuthoritative',
  'killEnemiesById',
  'grantLocalPlayerLife',
  'setInterpolationDelay',
]

for (const method of requiredMethods) {
  const methodPattern = new RegExp(`\\b${method}\\s*\\(`)
  if (!methodPattern.test(engineSource)) errors.push(`GameEngine missing method: ${method}`)
}

const uiCalls = [...callsiteSource.matchAll(/(?:gameRef\.current\?\.|game\.|topGame\.|bottomGame\.)([a-zA-Z_$][\w$]*)\s*\(/g)].map((match) => match[1])
const uniqueUiCalls = Array.from(new Set(uiCalls)).sort()
for (const method of uniqueUiCalls) {
  if (!new RegExp(`\\b${method}\\s*\\(`).test(engineSource)) {
    errors.push(`React call site invokes missing GameEngine method: ${method}`)
  }
}

if (!/export class GameEngine/.test(engineSource)) errors.push('GameEngine class export marker missing')
if (!/NetPlayerSnapshot/.test(engineSource)) errors.push('GameEngine should use NetPlayerSnapshot for multiplayer state')

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Engine API verified: ${requiredMethods.length} required multiplayer/gameplay methods present; ${uniqueUiCalls.length} React call-site methods resolved.`)
