#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const configPath = path.join(process.cwd(), 'src/game/multiplayer/config.ts')
const source = fs.readFileSync(configPath, 'utf8')

function constant(name) {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*([^;]+);`))
  if (!match) throw new Error(`Missing multiplayer constant ${name}`)
  const expression = match[1].trim()
  if (/^[0-9.]+$/.test(expression)) return Number(expression)
  if (expression === 'MP_TICK_RATE_HZ') return constant('MP_TICK_RATE_HZ')
  if (expression === 'MP_TICK_MS') return constant('MP_TICK_MS')
  const division = expression.match(/^1000\s*\/\s*([A-Z0-9_]+)$/)
  if (division) return 1000 / constant(division[1])
  throw new Error(`Unsupported expression for ${name}: ${expression}`)
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

const tickRate = constant('MP_TICK_RATE_HZ')
const tickMs = constant('MP_TICK_MS')
const p2pTickRate = constant('MP_P2P_TICK_RATE_HZ')
const p2pTickMs = constant('MP_P2P_TICK_MS')
const httpDivisor = constant('MP_HTTP_TICK_DIVISOR')
const interpolation = constant('MP_INTERPOLATION_DELAY_MS')
const p2pInterpolation = constant('MP_P2P_INTERPOLATION_DELAY_MS')
const maxExtrapolation = constant('MP_MAX_EXTRAPOLATION_MS')
const small = constant('MP_RECONCILE_SMALL_THRESHOLD')
const medium = constant('MP_RECONCILE_MEDIUM_THRESHOLD')
const snap = constant('MP_RECONCILE_SNAP_THRESHOLD')
const inputBuffer = constant('MP_INPUT_BUFFER_SIZE')
const historyMs = constant('MP_HISTORY_BUFFER_DURATION_MS')

assert(tickRate >= 20 && tickRate <= 30, `HTTP fallback tick rate should stay near 25Hz, got ${tickRate}`)
assert(Math.abs(tickMs - 1000 / tickRate) < 0.001, 'MP_TICK_MS must be derived from MP_TICK_RATE_HZ')
assert(p2pTickRate >= 50 && p2pTickRate <= 60, `P2P tick rate should be 50-60Hz, got ${p2pTickRate}`)
assert(Math.abs(p2pTickMs - 1000 / p2pTickRate) < 0.001, 'MP_P2P_TICK_MS must be derived from MP_P2P_TICK_RATE_HZ')
assert(httpDivisor >= 1 && httpDivisor <= 4, `HTTP divisor too aggressive: ${httpDivisor}`)
assert(interpolation >= 80 && interpolation <= 140, `HTTP interpolation should cover polling jitter, got ${interpolation}ms`)
assert(p2pInterpolation >= 16 && p2pInterpolation <= 60, `P2P interpolation should be low-latency but not zero, got ${p2pInterpolation}ms`)
assert(maxExtrapolation >= interpolation, 'max extrapolation must cover interpolation delay')
assert(small < medium && medium < snap, 'reconciliation thresholds must ascend')
assert(inputBuffer >= tickRate * 2, 'input buffer should cover at least two seconds of fallback commands')
assert(historyMs >= 1000, 'server history buffer should retain at least one second')

const httpHz = tickRate / httpDivisor
console.log(`Multiplayer tuning verified: HTTP ${httpHz.toFixed(1)}Hz @ ${interpolation}ms interpolation, P2P ${p2pTickRate}Hz @ ${p2pInterpolation}ms interpolation, history ${historyMs}ms.`)
