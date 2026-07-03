#!/usr/bin/env node
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = process.cwd()
const source = path.join(root, 'src/game/engine/performance-profiler.ts')
const outfile = path.join(os.tmpdir(), `dashverse-performance-profiler-${process.pid}.mjs`)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function simulate(profiler, frameCount, frameIntervalMs) {
  let metrics = null
  for (let i = 0; i < frameCount; i += 1) {
    profiler.startFrame(i * frameIntervalMs)
    metrics = profiler.endFrame()
  }
  return metrics
}

try {
  await build({
    entryPoints: [source],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  })

  const { PerformanceProfiler } = await import(pathToFileURL(outfile).href)

  const sixtyHz = new PerformanceProfiler()
  const sixtyMetrics = simulate(sixtyHz, 121, 1000 / 60)
  assert(sixtyMetrics.fps >= 59 && sixtyMetrics.fps <= 61, `expected 60Hz FPS near 60, got ${sixtyMetrics.fps}`)
  assert(sixtyMetrics.avgFrameTime > 16 && sixtyMetrics.avgFrameTime < 17.5, `expected 60Hz frame time near 16.7ms, got ${sixtyMetrics.avgFrameTime}`)

  const thirtyHz = new PerformanceProfiler()
  const thirtyMetrics = simulate(thirtyHz, 91, 1000 / 30)
  assert(thirtyMetrics.fps >= 29 && thirtyMetrics.fps <= 31, `expected 30Hz FPS near 30, got ${thirtyMetrics.fps}`)
  assert(thirtyMetrics.avgFrameTime > 32 && thirtyMetrics.avgFrameTime < 34.5, `expected 30Hz frame time near 33.3ms, got ${thirtyMetrics.avgFrameTime}`)

  thirtyHz.reset()
  const resetMetrics = thirtyHz.getMetrics()
  assert(resetMetrics.fps === 60, `expected reset FPS baseline of 60, got ${resetMetrics.fps}`)
  assert(resetMetrics.totalFrames === 0, `expected reset totalFrames 0, got ${resetMetrics.totalFrames}`)

  console.log(`Performance profiler verified: 60Hz=${sixtyMetrics.fps}fps/${sixtyMetrics.avgFrameTime.toFixed(2)}ms, 30Hz=${thirtyMetrics.fps}fps/${thirtyMetrics.avgFrameTime.toFixed(2)}ms, reset baseline ok.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
} finally {
  await fs.rm(outfile, { force: true }).catch(() => {})
}
