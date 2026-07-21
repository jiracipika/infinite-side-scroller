#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const pagePath = path.join(root, 'src/app/page.tsx')
const hudPath = path.join(root, 'src/components/HUD.tsx')
const startPath = path.join(root, 'src/components/StartScreen.tsx')
const touchControlsPath = path.join(root, 'src/components/TouchControls.tsx')
const errors = []

function read(file) {
  if (!fs.existsSync(file)) {
    errors.push(`${path.relative(root, file)} missing`)
    return ''
  }
  return fs.readFileSync(file, 'utf8')
}

function requireMarker(source, label, marker) {
  if (!source.includes(marker)) errors.push(`${label} missing marker: ${marker}`)
}

const page = read(pagePath)
const hud = read(hudPath)
const start = read(startPath)
const touchControls = read(touchControlsPath)

for (const marker of [
  'Pause button',
  'handlePause',
  '<TouchControls',
  'hapticsEnabled={settings.hapticsEnabled}',
]) {
  requireMarker(page, 'page.tsx', marker)
}

for (const marker of ['stats.lives', 'stats.health', 'stats.coins', 'stats.distance']) {
  requireMarker(hud, 'HUD.tsx', marker)
}

for (const marker of ['dash-tester-checklist-v2', 'Recommended play plan', 'Same-Wi-Fi']) {
  requireMarker(start, 'StartScreen.tsx', marker)
}

for (const marker of ['onPointerDown', 'setPointerCapture', 'onLostPointerCapture', 'aria-pressed']) {
  requireMarker(touchControls, 'TouchControls.tsx', marker)
}

for (const marker of ['jump-press', 'dash-press', 'attack-press', 'carry-press', 'Carry teammate']) {
  requireMarker(touchControls, 'TouchControls.tsx', marker)
}

for (const marker of ['navigator.vibrate', 'visibilitychange', 'pagehide']) {
  requireMarker(touchControls, 'TouchControls.tsx', marker)
}

if (!touchControls.includes("style={{ touchAction: 'none' }}")) {
  errors.push('TouchControls overlay must use touchAction:none so browser gestures do not delay game input')
}
if (!touchControls.includes("emit('jump-press', true); setJumpHeld(true)")) {
  errors.push('TouchControls must emit jump before React state/haptic work')
}

const legacyKeyboardShim = page.includes('new KeyboardEvent') || page.includes('pressVirtualControl')
if (legacyKeyboardShim) errors.push('page.tsx still contains legacy KeyboardEvent touch shim')

const ariaLabels = [...touchControls.matchAll(/aria-label=/g)].length
if (ariaLabels < 5) errors.push(`expected at least 5 aria-labels in TouchControls.tsx, found ${ariaLabels}`)

const touchControlPointerHandlers = [...touchControls.matchAll(/onPointer(?:Down|Up|Cancel)|onLostPointerCapture/g)].length
if (touchControlPointerHandlers < 4) {
  errors.push(`expected pointer-capture handlers in TouchControls.tsx, found ${touchControlPointerHandlers}`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Touch controls verified: canonical TouchControls mounted, ${touchControlPointerHandlers} touch button pointer handlers, ${ariaLabels} aria labels, jump/dash/attack/carry/start checklist/HUD markers present, no legacy KeyboardEvent shim.`)
