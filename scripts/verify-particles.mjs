#!/usr/bin/env node
// Particle system invariants:
//  1. update() must use in-place compaction, NOT .filter() — avoids
//     per-frame array allocation at 60fps (GC pressure).
//  2. spawnHitFlash must exist and be wired into all player-damage sites.
//  3. spawnHitFlash must respect reducedParticles (fewer particles).

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const particlesPath = path.join(root, 'src/game/entities/particles.ts')
const enginePath = path.join(root, 'src/game/engine/game-engine.ts')

const errors = []

const particles = fs.readFileSync(particlesPath, 'utf8')
const engine = fs.readFileSync(enginePath, 'utf8')

// 1. update() must NOT use .filter() for dead-particle removal
//    (the old code did this.particles = this.particles.filter(p => p.life > 0))
const updateFilterPattern = /this\.particles\s*=\s*this\.particles\.filter\s*\(/
if (updateFilterPattern.test(particles)) {
  errors.push('ParticleSystem.update() must not use this.particles.filter() — use in-place compaction to avoid per-frame allocation')
}

// Must use in-place compaction (writeIdx / list.length truncation)
if (!/list\.length\s*=\s*writeIdx/.test(particles)) {
  errors.push('ParticleSystem.update() must truncate via list.length = writeIdx for in-place compaction')
}

// 2. spawnHitFlash method exists
if (!/spawnHitFlash\s*\(\s*x\s*:\s*number\s*,\s*y\s*:\s*number\s*\)/.test(particles)) {
  errors.push('ParticleSystem must define spawnHitFlash(x: number, y: number)')
}

// 3. spawnHitFlash respects reducedParticles
const hitFlashBlock = particles.match(/spawnHitFlash[\s\S]*?^  \}/m)
if (hitFlashBlock) {
  if (!/reducedParticles/.test(hitFlashBlock[0])) {
    errors.push('spawnHitFlash must check reducedParticles to cap particle count')
  }
} else {
  errors.push('Could not locate spawnHitFlash method body')
}

// 4. spawnHitFlash is called at every player-damage site in game-engine
//    There are 4 known damage sites: enemy collision, enemy projectile,
//    spike hazard, UFO abduction beam.
const hitFlashCalls = [...engine.matchAll(/spawnHitFlash\s*\(/g)]
if (hitFlashCalls.length < 4) {
  errors.push(`Expected spawnHitFlash at 4 damage sites, found ${hitFlashCalls.length}`)
}

if (errors.length > 0) {
  console.error(`${errors.length} particle system check(s) failed:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(`Particle system verified: in-place compaction (no .filter allocation), spawnHitFlash present with reducedParticles guard, wired into ${hitFlashCalls.length} damage sites.`)
