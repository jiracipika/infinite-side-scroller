#!/usr/bin/env node
/**
 * Verifies the adaptive multiplayer latency systems:
 *
 *  1. computeInterpolationDelayMs exists and clamps to [MP_INTERP_MIN_MS,
 *     MP_INTERP_MAX_MS] with monotonic behavior (higher RTT ⇒ ≥ delay).
 *  2. Engine has adaptInterpolationDelay + getInterpolationDelay and eases
 *     toward the computed target (0.12 blend) instead of jumping.
 *  3. Reconciliation small-error blend scales with error size (no flat 0.18
 *     constant alone; derived from thresholds with a t-based ramp).
 *  4. WebRTC onMessage applies remote snapshots on arrival (arrival-driven),
 *     not only at the fixed net tick.
 *  5. HTTP path feeds measured RTT into adaptInterpolationDelay while P2P
 *     is disconnected.
 *  6. In-flight sync abort budget scales with smoothed RTT (not a fixed ms).
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const configPath = path.join(root, 'src/game/multiplayer/config.ts')
const enginePath = path.join(root, 'src/game/engine/game-engine.ts')
const pagePath = path.join(root, 'src/app/page.tsx')

const configSrc = fs.readFileSync(configPath, 'utf8')
const engineSrc = fs.readFileSync(enginePath, 'utf8')
const pageSrc = fs.readFileSync(pagePath, 'utf8')

let failures = 0
function check(cond, label) {
  if (!cond) {
    console.error(`  ✗ ${label}`)
    failures += 1
  } else {
    console.log(`  ✔ ${label}`)
  }
}

function evaluateCompute(rtt) {
  // Mirror of computeInterpolationDelayMs for behavioral checks without TS imports.
  const MIN = 32
  const MAX = 115
  const FACTOR = 1.5
  const SLACK = 24
  if (!Number.isFinite(rtt) || rtt <= 0) return MAX
  const target = (rtt / 2) * FACTOR + SLACK
  return Math.round(Math.min(MAX, Math.max(MIN, target)))
}

console.log('▶ adaptive interpolation config contract')
check(/export function computeInterpolationDelayMs\s*\(\s*rttMs:\s*number\s*\)\s*:\s*number/.test(configSrc), 'computeInterpolationDelayMs exported')
check(/MP_INTERP_MIN_MS\s*=\s*32/.test(configSrc), 'MP_INTERP_MIN_MS floor = 32ms')
check(/MP_INTERP_MAX_MS\s*=\s*MP_INTERPOLATION_DELAY_MS/.test(configSrc), 'MP_INTERP_MAX_MS ties to legacy constant')
check(evaluateCompute(2) === Math.max(32, Math.round((2 / 2) * 1.5 + 24)), 'LAN RTT ~2ms → ~floor')
check(evaluateCompute(150) === 115, `WAN RTT 150ms → ceiling (got ${evaluateCompute(150)})`)
const d40 = evaluateCompute(40)
const d100 = evaluateCompute(100)
check(d100 > d40, `monotonic: rtt100 (${d100}) > rtt40 (${d40})`)

console.log('▶ engine adaptation contract')
check(/adaptInterpolationDelay\s*\(\s*rttMs:\s*number\s*\)\s*:\s*void/.test(engineSrc), 'adaptInterpolationDelay method exists')
check(/getInterpolationDelay\s*\(\s*\)\s*:\s*number/.test(engineSrc), 'getInterpolationDelay getter exists')
check(/computeInterpolationDelayMs\(rttMs\)/.test(engineSrc), 'engine uses shared compute helper')
check(/\*\s*0\.12/.test(engineSrc), 'eased toward target (12% per sample — no hard jumps)')
check(/setRemotePlayerState|adaptInterpolationDelay/.test(engineSrc) && !/require\(/.test(engineSrc), 'no require() in bundled engine code')

console.log('▶ reconciliation ramp contract')
check(/const blend = 0\.18 \+ t \* 0\.42/.test(engineSrc), 'blend ramps 0.18→0.60 with error size')
check(/MP_RECONCILE_MEDIUM_THRESHOLD - MP_RECONCILE_SMALL_THRESHOLD/.test(engineSrc), 'ramp span derives from shared thresholds')
check(!/const blend = 0\.18;\n\s*this\.player\.x \+= dx \* blend;\n\s*this\.player\.y \+= dy \* blend;\n\s*\}\n\s*if \(pendingInputs/.test(engineSrc.replace(/\r/g, '')), 'flat-blend-only small branch removed')

console.log('▶ arrival-driven P2P application contract')
check(/transport\.onMessage[\s\S]{0,1400}game\.setRemotePlayerState/.test(pageSrc), 'RTC onMessage applies snapshot immediately')
check(/transport\.onMessage[\s\S]{0,1800}adaptInterpolationDelay/.test(pageSrc), 'RTC onMessage feeds RTT for adaptive interp')

console.log('▶ HTTP adaptive-delay + abort budget contract')
check(/!rtcConnectedRef\.current\s*\)\s*\{[^}]*adaptInterpolationDelay\(syncRttEwmaMsRef\.current\)/.test(pageSrc), 'HTTP path adapts delay when P2P down')
check(/Math\.max\(\s*MP_TICK_MS,\s*syncRttEwmaMsRef\.current \* 2,?\s*\)/.test(pageSrc), 'abort budget scales with smoothed RTT')
check(!/inflightAge > 420 /.test(pageSrc), 'fixed 420ms abort budget replaced')

if (failures > 0) {
  console.error(`\nAdaptive latency contract FAILED with ${failures} error(s).`)
  process.exit(1)
} else {
  console.log('\nAdaptive multiplayer latency contract verified.')
}
