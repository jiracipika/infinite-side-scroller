#!/usr/bin/env node
// Visual texture system invariants:
//  1. All world texture/background randomness must be deterministic
//     (seeded hash) — Math.random would break chunk caching and
//     multiplayer sky parity.
//  2. The renderer must delegate sky/parallax to the layered background
//     painter and ground detail to the texture painter.
//  3. The engine must drive fidelity (setBackgroundDetail) from its
//     adaptive-quality branches and pin finite-level palettes
//     (setWorldBiomeOverride) on both setSeed and setLevel.
//  4. Grass tufts must never be baked into the static chunk cache
//     (isCacheContext guard).

import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')

const errors = []

const textures = read('src/game/rendering/textures.ts')
const background = read('src/game/rendering/background.ts')
const color = read('src/game/rendering/color.ts')
const renderer = read('src/game/rendering/renderer.ts')
const engine = read('src/game/engine/game-engine.ts')
const pkg = JSON.parse(read('package.json'))

// 1. Determinism — no Math.random in world-texture/background code
for (const [name, src] of [['textures.ts', textures], ['background.ts', background]]) {
  if (/Math\.random/.test(src)) {
    errors.push(`${name} must not use Math.random — world visuals are seeded via textureHash for cache safety and multiplayer parity`)
  }
}
if (!/export function textureHash/.test(textures)) {
  errors.push('textures.ts must export textureHash(i, seed)')
}

// 2. Renderer delegation
if (!/drawBackgroundSky\s*\(/.test(renderer) || !/drawBackgroundParallax\s*\(/.test(renderer)) {
  errors.push('renderer.ts must delegate drawSky/drawParallax to the background painter')
}
if (!/paintGroundTexture\s*\(/.test(renderer)) {
  errors.push('renderer.ts must call paintGroundTexture for the ground detail pass')
}
if (!/tuftsForChunk\s*\(/.test(renderer) || !/drawTuft\s*\(/.test(renderer)) {
  errors.push('renderer.ts must draw animated grass tufts via tuftsForChunk/drawTuft')
}
if (!/paintPlatformDetail\s*\(/.test(renderer)) {
  errors.push('renderer.ts must give platforms a floating-island underside via paintPlatformDetail')
}
for (const removed of ['drawChromaticRibbons', 'drawMountains', 'private drawClouds']) {
  if (renderer.includes(removed)) {
    errors.push(`renderer.ts still contains legacy background code: ${removed}`)
  }
}

// 3. Engine wiring
if (!engine.includes('this.renderer.setBackgroundDetail("low")') ||
    !engine.includes('this.renderer.setBackgroundDetail("high")')) {
  errors.push('engine must drive renderer.setBackgroundDetail from the adaptive-quality branches')
}
const setSeedBody = engine.match(/setSeed\(seed: number[\s\S]*?\n  \}/)
if (!setSeedBody || !setSeedBody[0].includes('setWorldBiomeOverride(null)')) {
  errors.push('setSeed must clear the world biome override (setWorldBiomeOverride(null))')
}
const setLevelBody = engine.match(/setLevel\(config: LevelConfig\): void \{[\s\S]*?\n  \}/)
if (!setLevelBody || !setLevelBody[0].includes('setWorldBiomeOverride(')) {
  errors.push('setLevel must pin the renderer palette via setWorldBiomeOverride')
}
if (!/drawTerrain\(chunks,\s*this\.camera,\s*this\.gameTime/.test(engine)) {
  errors.push('engine must pass gameTime into drawTerrain so tuft sway animates')
}

// 4. Cache isolation — animated tufts excluded from baked chunk canvases
const bakeCall = renderer.match(/drawTerrainToContext\(offCtx[\s\S]*?\);/)
if (!bakeCall || !bakeCall[0].includes('true')) {
  errors.push('the chunk-cache bake call must pass isCacheContext=true so tufts are never frozen into cached canvases')
}

// 5. Module exports used by tests/previews
for (const fn of ['getSkyCycle', 'ridgeHeightAt']) {
  if (!new RegExp(`export function ${fn}`).test(background)) {
    errors.push(`background.ts must export ${fn} (pure, testable geometry)`)
  }
}
for (const fn of ['shadeHexColor', 'blendHex', 'hexToRgba', 'shadeFraction']) {
  if (!new RegExp(`export function ${fn}`).test(color)) {
    errors.push(`color.ts must export ${fn}`)
  }
}

// 7. Power-up FX (magnet/speedBoost) — pure solvers, deterministic, gated.
const powerFx = read('src/game/rendering/power-fx.ts')
for (const fn of ['resolveMagnetFieldPose', 'resolveSpeedLinesPose', 'powerFxIntensity']) {
  if (!new RegExp(`export function ${fn}`).test(powerFx)) {
    errors.push(`power-fx.ts must export ${fn} (pure, testable solver)`)
  }
}
if (/Math\.random/.test(powerFx)) {
  errors.push('power-fx.ts must not use Math.random — FX are seeded by run time for multiplayer parity')
}
if (!engine.includes('resolveMagnetFieldPose(') || !engine.includes('resolveSpeedLinesPose(')) {
  errors.push('engine must render magnet/speedBoost FX via the power-fx solvers')
}
if (!/magnetActive[\s\S]{0,400}reducedMotion/.test(engine) && !/reducedMotion[\s\S]{0,400}magnetActive/.test(engine)) {
  errors.push('magnet FX must be gated by reducedMotion (static fallback ring)')
}
if (!/speedBoostTimer > 0 &&\s*\n\s*!this\.reducedMotion/.test(engine)) {
  errors.push('speedBoost FX must be fully suppressed under reducedMotion')
}

// 8. Double-jump tumble FX — pure solvers, rendered via character-art,
// gated by reducedMotion at the drawPlayer call site.
const characterArt = read('src/game/rendering/character-art.ts')
for (const fn of ['resolveTumbleRotation', 'resolveTumbleArms']) {
  if (!new RegExp(`export function ${fn}`).test(characterArt)) {
    errors.push(`character-art.ts must export ${fn} (pure, testable solver)`)
  }
}
if (/Math\.random/.test(characterArt)) {
  errors.push('character-art.ts must not use Math.random — pose/FX output stays deterministic')
}
if (!renderer.includes('tumble:') || !renderer.includes('airbornePose')) {
  errors.push('renderer must feed player.airbornePose into drawCharacterArt as tumble')
}
if (!/isReducedMotion\(\) \? 0 : player\.airbornePose/.test(renderer)) {
  errors.push('tumble FX must be fully suppressed under reducedMotion (camera.isReducedMotion gate)')
}

// 6. Verifier is wired into the pipeline
if (!pkg.scripts['verify:visual-textures']) {
  errors.push('package.json must define verify:visual-textures')
}

if (errors.length > 0) {
  console.error(`${errors.length} visual texture check(s) failed:`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('Visual textures verified: deterministic seeded patterns, renderer delegation, engine quality/biome wiring, tuft cache isolation.')
