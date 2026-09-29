#!/usr/bin/env node
// Phase 4 (ITERATION-PLAN round3): touch controls + mobile affordance guard.
// Pins, at source level, the affordances mobile players depend on: the
// TouchControls component exists and exposes pause + movement controls,
// the game page actually mounts it, and the touch settings surface exists.
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(p) {
  const src = fs.readFileSync(path.join(root, p), 'utf8')
  return src
}
function mustExist(p, label) {
  if (!fs.existsSync(path.join(root, p))) failures.push(`${label}: missing file ${p}`)
}

// 1. Components exist.
mustExist('src/components/TouchControls.tsx', 'touch controls')
mustExist('src/components/TouchControlSettings.tsx', 'touch settings')
mustExist('src/components/HUD.tsx', 'HUD')

// 2. TouchControls exposes the essential affordances.
const tc = read('src/components/TouchControls.tsx')
for (const marker of [
  'aria-label="Pause game"',
  'aria-label="Movement controls"',
  'aria-label="Touch game controls"',
]) {
  if (!tc.includes(marker)) failures.push(`TouchControls lost affordance marker: ${marker}`)
}

// 3. The game page mounts TouchControls (import + JSX usage).
const page = read('src/app/page.tsx')
if (!page.includes("import TouchControls from '@/components/TouchControls'")) {
  failures.push('game page no longer imports TouchControls')
}
if (!page.includes('<TouchControls')) {
  failures.push('game page no longer renders <TouchControls>')
}

// 4. Touch settings stay reachable (mobile UX surface).
const settings = read('src/components/TouchControlSettings.tsx')
if (!settings.includes('export default') && !settings.includes('export ')) {
  failures.push('TouchControlSettings lost its export')
}

// ── report ──
console.log(`touch markers checked: 6`)
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`)
  console.error(`TOUCH GUARDS: ${failures.length} failure(s)`)
  process.exit(1)
}
console.log('TOUCH GUARDS: ALL PASS')
