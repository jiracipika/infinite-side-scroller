#!/usr/bin/env node
// BASELINE_REF=<pre-change commit> npm run benchmark:renderer
// Deliberately sequential: concurrent browser/build/test work invalidates timings.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { rendererHarness } from './lib/renderer-benchmark-harness.mjs';

if (!process.env.BASELINE_REF) throw new Error('Set BASELINE_REF to the commit being compared.');
const root = process.cwd(), out = process.env.PERF_OUTPUT || path.join(os.tmpdir(), 'dashverse-renderer-benchmark');
mkdirSync(out, { recursive: true });
const baseline = await rendererHarness(root, process.env.BASELINE_REF), optimized = await rendererHarness(root);
const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const evidence = { baseline: baseline.sha, browser: browser.version(), cpuThrottle: Number(process.env.PERF_CPU || 1), samples: [], parity: [] };

async function openHarness(harness) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: evidence.cpuThrottle });
  page.on('pageerror', e => { throw e; });
  await page.setContent(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden}canvas{display:block;width:100%;height:100%}</style><canvas></canvas><script>${harness.code}</script>`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => window.renderBenchmark.ensureCharacterFullArtLoading());
  await page.waitForFunction(() => window.renderBenchmark.CHARACTERS.every(c => window.renderBenchmark.characterFullArtReady(c.id)));
  return page;
}

try {
  for (const [label, harness] of [['baseline', baseline], ['optimized', optimized]]) {
    const page = await openHarness(harness);
    for (const count of [0, 4, 8]) {
      const sample = await page.evaluate(async count => {
        const a = window.renderBenchmark;
        let seed = 42; Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const e = new a.GameEngine(document.querySelector('canvas'), 42, 'cherry', { input: { enableKeyboard: false, enableGamepad: false } });
        e.stop(); e.adaptiveQualityEnabled = false; e.currentQualityLevel = 'high'; e.performanceDprBoosted = true;
        e.renderer.setBackgroundDetail('high'); e.particles.setReducedParticles(false); e.handleResize();
        await new Promise(requestAnimationFrame);
        e._state = 'playing'; e.collectibles = []; e.hazards = [];
        e.enemies = Array.from({ length: count }, (_, i) => {
          const C = [a.Onyx, a.Mortimer, a.Grimshaw, a.Dorian][i % 4], enemy = new C(500 + i * 64, 300, 0);
          enemy.onGround = true; enemy.aiState = 'patrol'; enemy.vx = 80 + i % 4 * 5; return enemy;
        });
        e.player.applyShield(8); e.player.applyMagnet(8); e.player.applySpeedBoost(1.35, 5);
        const frames = []; let triangleClips = 0, peakCachedBytes = 0;
        const clip = CanvasRenderingContext2D.prototype.clip;
        CanvasRenderingContext2D.prototype.clip = function(...args) { triangleClips++; return clip.apply(this, args); };
        try {
          for (let i = 0; i < 360; i++) {
            e.gameTime = i / 60; e.player.x = 500 + i * 280 / 60; e.player.vx = 280;
            e.player.y = 400 - e.player.height; e.player.onGround = true; e.player.vy = 0;
            e.camera.x = e.player.x - 220; e.camera.y = 0; e.chunkManager.update(e.player.x);
            e.enemies.forEach((enemy, j) => { enemy.x = e.player.x + 80 + j * 64 + Math.sin(i / 100 + j) * 20; enemy.y = 400 - enemy.height; enemy.animTimer = i / 60; });
            if (i % 30 === 0) { e.particles.spawnDashBurst(e.player.x, e.player.y, true); e.particles.spawnLanding(e.player.x, e.player.y + e.player.height); e.particles.spawnCoinSparkle(e.player.x + 50, e.player.y - 20); }
            e.particles.update(e.camera.x, 0, 1280, 720, 'forest', 1 / 60);
            const t = performance.now(); e.render(); frames.push(performance.now() - t);
            peakCachedBytes = Math.max(peakCachedBytes, a.cacheStats?.().bytes || 0);
            if (i % 60 === 0) await new Promise(r => setTimeout(r, 0));
          }
        } finally { CanvasRenderingContext2D.prototype.clip = clip; e.destroy(); }
        const sorted = frames.slice(60).sort((a, b) => a - b);
        return { enemies: count, sampledFrames: sorted.length, medianMs: sorted[Math.floor(sorted.length * .5)],
          p95Ms: sorted[Math.floor(sorted.length * .95)], averageMs: sorted.reduce((a, b) => a + b, 0) / sorted.length,
          worstMs: Math.max(...frames), coldMs: frames[0], triangleClips, peakCachedBytes, quality: e.currentQualityLevel, dpr: e.currentRenderDpr };
      }, count);
      assert.equal(sample.quality, 'high'); assert.equal(sample.dpr, 1);
      assert.ok(sample.peakCachedBytes <= 64 * 1024 * 1024);
      evidence.samples.push({ label, ...sample }); console.log(JSON.stringify({ label, ...sample }));
    }
    await page.close();
  }

  // Compare actual RGBA output at 3x gameplay size, including semi-transparent
  // edges, cloth, attack overlays and rotated props. No fuzzy pixel threshold.
  for (const [label, harness] of [['baseline', baseline], ['optimized', optimized]]) {
    const page = await openHarness(harness);
    const ids = await page.evaluate(() => window.renderBenchmark.CHARACTERS.map(c => c.id));
    for (const id of ids) {
      const png = await page.evaluate(id => {
        const a = window.renderBenchmark, c = a.CHARACTERS.find(c => c.id === id), canvas = document.querySelector('canvas');
        canvas.width = 1536; canvas.height = 2304; const ctx = canvas.getContext('2d');
        const poses = [{}, { time: .4 }, { time: 2.3 }, ...Array.from({ length: 8 }, (_, i) => ({ moving: true, phase: i / 8, speedRatio: 1.35 })),
          { dashing: true }, { airborne: true, verticalVelocity: -520, launch: 1 }, { airborne: true, verticalVelocity: -200 },
          { airborne: true, verticalVelocity: 0 }, { airborne: true, verticalVelocity: 520 }, { land: .7 },
          { melee: .25 }, { melee: .5 }, { melee: .75 }, { ranged: .35 }, { ranged: .7 },
          { airborne: true, melee: .5, verticalVelocity: -200 }, { airborne: true, tumble: .5, verticalVelocity: -100 }];
        poses.forEach((pose, i) => { ctx.save(); ctx.translate(i % 4 * 384 + 160, Math.floor(i / 4) * 384 + 140); ctx.scale(3, 3); a.drawCharacterArt(ctx, c, c.width, c.height, pose); ctx.restore(); });
        return canvas.toDataURL().split(',')[1];
      }, id);
      const file = path.join(out, `${label}-${id}.png`); writeFileSync(file, Buffer.from(png, 'base64'));
      if (label === 'optimized') {
        const before = await sharp(readFileSync(path.join(out, `baseline-${id}.png`))).ensureAlpha().raw().toBuffer();
        const after = await sharp(readFileSync(file)).ensureAlpha().raw().toBuffer();
        assert.equal(after.equals(before), true, `${id}: graphics must remain pixel-identical`);
        evidence.parity.push({ id, poses: 24, changedPixels: 0 });
      }
    }
    await page.close();
  }
  writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(`PASS: 17 characters × 24 poses are pixel-identical. Evidence: ${out}`);
} finally { await browser.close(); }
