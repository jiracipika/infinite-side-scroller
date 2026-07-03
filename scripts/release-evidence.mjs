#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const requiredScripts = [
  'verify:game',
  'verify:multiplayer',
  'verify:multiplayer-api',
  'verify:progression',
  'verify:achievements',
  'verify:saves',
  'verify:hud',
  'verify:codemagic',
  'verify:mobile',
  'verify:manifest',
  'verify:engine',
  'verify:touch',
  'typecheck',
  'lint',
  'build',
]

const missing = requiredScripts.filter((script) => !pkg.scripts?.[script])
if (missing.length > 0) {
  console.error(`Missing release scripts: ${missing.join(', ')}`)
  process.exit(1)
}

const files = [
  'docs/ITERATION-PLAN-2026-06-30-round3.md',
  'public/manifest.json',
  'src/app/page.tsx',
  'src/game/engine/game-engine.ts',
  'src/app/api/multiplayer/room/route.ts',
  'src/app/api/multiplayer/signal/route.ts',
  'apps/mobile/assets/game.html',
]
for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) {
    console.error(`Missing release evidence file: ${file}`)
    process.exit(1)
  }
}

console.log('Dashverse release evidence')
console.log('==========================')
console.log(`Package: ${pkg.name}@${pkg.version}`)
console.log('Required gates present:')
for (const script of requiredScripts) console.log(`- npm run ${script}`)
console.log('Evidence files present:')
for (const file of files) console.log(`- ${file}`)
console.log('Recommended release gate: npm run verify && npm run build')
