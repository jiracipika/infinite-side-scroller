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
  'onPointerDown',
  'onPointerUp',
  'TouchControls',
  'jump',
  'dash',
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

const pointerHandlers = [...page.matchAll(/onPointer(?:Down|Up|Cancel)/g)].length
if (pointerHandlers < 4) errors.push(`expected at least 4 pointer handlers for touch controls, found ${pointerHandlers}`)

const ariaLabels = [...page.matchAll(/aria-label=/g)].length
if (ariaLabels < 3) errors.push(`expected at least 3 aria-labels in page controls, found ${ariaLabels}`)

const touchControlPointerHandlers = [...touchControls.matchAll(/onPointer(?:Down|Up|Cancel)|onLostPointerCapture/g)].length
if (touchControlPointerHandlers < 4) {
  errors.push(`expected pointer-capture handlers in TouchControls.tsx, found ${touchControlPointerHandlers}`)
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(`Touch controls verified: ${pointerHandlers} page pointer handlers, ${touchControlPointerHandlers} touch button pointer handlers, ${ariaLabels} aria labels, pause/jump/dash/start checklist/HUD markers present.`)
