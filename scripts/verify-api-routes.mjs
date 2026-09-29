#!/usr/bin/env node
// Phase 3 (ITERATION-PLAN round3): multiplayer/API route guard.
// Collects every literal "/api/..." route referenced from client code
// (fetch/requestJson wrappers) and asserts a route.ts handler exists for
// it under src/app/api. Also pins the durable-state markers on the
// multiplayer room route (persistence/recovery is the contract the
// nearby-multiplayer mode depends on after a page reload).
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const apiDir = path.join(root, 'src', 'app', 'api')
const failures = []

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue
      walk(p, out)
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      out.push(p)
    }
  }
  return out
}

const allFiles = walk(path.join(root, 'src'))
const clientFiles = allFiles.filter((p) => !p.includes(`${path.sep}api${path.sep}`))

// ── 1. Existing route handlers ──
const handled = new Set()
for (const p of allFiles) {
  const norm = path.relative(apiDir, p)
  if (norm.endsWith(`route.ts`) && !norm.startsWith('..')) {
    handled.add('/' + norm.replace(/\\/g, '/').replace(/\/route\.ts$/, ''))
  }
}

// ── 2. Route literals referenced from client code ──
const referenced = new Map() // route -> first referencing file
const routeRe = /['"`](\/api\/[a-z0-9\-/_[\]$ {}.]{2,100})['"`]/g
for (const p of clientFiles) {
  const src = fs.readFileSync(p, 'utf8')
  for (const m of src.matchAll(routeRe)) {
    // Strip query strings and template interpolations: /room?x=${y} -> /room
    const route = m[1].split('?')[0].replace(/\$\{[^}]*\}.*$/, '')
    if (route.length < 5) continue
    if (!referenced.has(route)) referenced.set(route, path.relative(root, p))
  }
}

// ── 3. Every referenced route must have a handler ──
for (const [route, file] of [...referenced.entries()].sort()) {
  const handler = path.join(apiDir, route.replace(/^\/api/, ''), 'route.ts')
  if (!fs.existsSync(handler)) {
    failures.push(`client code calls ${route} (from ${file}) but no handler exists at src/app/api${route}/route.ts`)
  }
}

// ── 4. Durable-state markers on the multiplayer room route ──
const roomRoute = path.join(apiDir, 'multiplayer', 'room', 'route.ts')
if (fs.existsSync(roomRoute)) {
  const roomSrc = fs.readFileSync(roomRoute, 'utf8')
  const markers = [/persist/i, /recover/i, /durable/i, /snapshot/i, /redis/i]
  if (!markers.some((re) => re.test(roomSrc))) {
    failures.push('multiplayer room route lost its durable-state/recovery markers (persistence contract)')
  }
}

// ── report ──
console.log(`route handlers: ${[...handled].sort().join(', ') || 'none'}`)
console.log(`client-referenced routes: ${[...referenced.keys()].sort().join(', ') || 'none'}`)
if (failures.length > 0) {
  for (const f of failures) console.error(`FAIL: ${f}`)
  console.error(`API ROUTES: ${failures.length} failure(s)`)
  process.exit(1)
}
console.log('API ROUTES: ALL PASS')
