#!/usr/bin/env node
// Phase 2 (ITERATION-PLAN round3): engine call-site verifier.
// Scans every GameEngine instantiation site and ref declaration outside
// src/game, collects `<recv>.<method>(` calls, and asserts each called
// method exists on the engine class body. Targets the historical bug
// class where UI code calls engine methods that do not exist (silent
// runtime crashes behind feature flags).
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const failures = []

function read(p) {
  return fs.readFileSync(p, 'utf8')
}

function walk(dir, exts, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'dist') continue
      walk(p, exts, out)
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(p)
    }
  }
  return out
}

// ── 1. Method names defined on the GameEngine class body ──
const engineSrc = read(path.join(root, 'src/game/engine/game-engine.ts'))
const classStart = engineSrc.indexOf('export class GameEngine')
if (classStart < 0) {
  console.error('GameEngine class not found in src/game/engine/game-engine.ts')
  process.exit(1)
}
// Class body ends at the next top-level export or EOF.
const rest = engineSrc.slice(classStart)
const nextExport = rest.indexOf('\nexport ', 1)
const body = nextExport < 0 ? rest : rest.slice(0, nextExport)

const JS_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'constructor'])
const methods = new Set()
// 2-space-indented method definitions inside the class body.
const defRe = /^  (?:public |private |protected |readonly |static )?(?:async )?([a-zA-Z_]\w*)\s*\(/gm
let m
while ((m = defRe.exec(body))) {
  if (!JS_KEYWORDS.has(m[1])) methods.add(m[1])
}
if (methods.size < 10) {
  console.error(`suspiciously few engine methods parsed (${methods.size}) — class-body regex drifted`)
  process.exit(1)
}

// ── 2. Receivers typed as GameEngine, outside src/game ──
const uiFiles = walk(path.join(root, 'src'), ['.ts', '.tsx']).filter((p) => !p.includes(`${path.sep}game${path.sep}`))
const receivers = new Set()
for (const p of uiFiles) {
  const src = read(p)
  for (const mm of src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*new\s+GameEngine\b/g)) receivers.add(mm[1])
  for (const mm of src.matchAll(/useRef<\s*GameEngine[^>]*>\s*\(\s*null\s*\)/g)) {
    // useRef<GameEngine | null>(null) — receiver name is the LHS identifier.
    const lineStart = src.lastIndexOf('\n', mm.index) + 1
    const line = src.slice(lineStart, mm.index)
    const nameMatch = line.match(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*$/)
    if (nameMatch) receivers.add(nameMatch[1])
  }
}
if (receivers.size === 0) {
  console.error('no GameEngine receivers found — receiver detection drifted')
  process.exit(1)
}

// ── 3. Every receiver call must hit a real method ──
const recvRe = new RegExp(
  `\\b(${[...receivers].map((r) => r.replace(/\$/g, '\\$')).join('|')})\\.([a-zA-Z_]\\w*)\\s*\\(`,
  'g',
)
let callSites = 0
for (const p of uiFiles) {
  const src = read(p)
  for (const mm of src.matchAll(recvRe)) {
    callSites += 1
    const method = mm[2]
    if (!methods.has(method)) {
      failures.push(`${path.relative(root, p)}: receiver '${mm[1]}' calls missing GameEngine method '${method}'`)
    }
  }
}

// ── report ──
console.log(`engine methods on class: ${methods.size}`)
console.log(`GameEngine receivers: ${[...receivers].sort().join(', ')}`)
console.log(`call sites checked: ${callSites}`)
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`)
  console.error(`ENGINE CALLS: ${failures.length} missing method(s)`)
  process.exit(1)
}
console.log('ENGINE CALLS: ALL PASS')
