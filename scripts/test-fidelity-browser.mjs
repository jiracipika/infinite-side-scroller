import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { captureRenderedFrame } from './lib/capture-rendered-frame.mjs';

const { chromium } = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url)('playwright');
const out = process.env.ART_SCREENSHOTS || '/tmp/dashverse-fidelity';
mkdirSync(out, { recursive: true });
// Node-source export wrapper stripped before page injection.
const captureSource = readFileSync(new URL('./lib/capture-rendered-frame.mjs', import.meta.url), 'utf8')
  .replace(/^export\s+/gm, '');
const viewport = { width: Number(process.env.ART_WIDTH || 1280), height: Number(process.env.ART_HEIGHT || 720) };
assert.ok(Number.isFinite(viewport.width) && viewport.width > 0 && Number.isFinite(viewport.height) && viewport.height > 0);
const reducedMotion = process.env.ART_REDUCED_MOTION === '1' ? 'reduce' : 'no-preference';
const report = { url: process.env.GAME_URL || 'http://127.0.0.1:3010', reducedMotion, viewport, dpr: 1, runs: [] };
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  for (const character of ['knight', 'ninja']) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(report.url);
    await page.getByRole('button', { name: 'Open character select', exact: true }).click();
    await page.getByRole('button', { name: character === 'ninja' ? 'Ninja' : 'Knight', exact: true }).click();
    await page.getByRole('button', { name: /Play Endless/ }).click();
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber$'))];
      while (fiber) {
        for (let h = fiber.memoizedState; h; h = h.next) {
          const engine = h.memoizedState?.current;
          if (engine?.player && engine?.getLocalPlayerSnapshot) { window.__engine = engine; break; }
        }
        if (window.__engine) break;
        fiber = fiber.return;
      }
    });
    await page.addScriptTag({ content: captureSource });
    await page.waitForFunction(() => window.__engine?.player.onGround);
    // Render-bound captures: the canvas and the state flags are read inside
    // engine.render for a frame that actually matches the requested action.
    const capture = action => page.evaluate(captureRenderedFrame, { action, timeoutMs: 5000 });
    const check = (data, name) => {
      assert.ok(data.canvas && data.canvas.startsWith('data:image/png'), `${name} frame painted`);
      assert.equal(data.snapshot.characterId, character);
      return data;
    };
    const write = (data, name) => {
      const path = `${out}/${character}-${name}.png`;
      writeFileSync(path, Buffer.from(data.canvas.split(',')[1], 'base64'));
      delete data.canvas;
      return { action: name, path, renderSequence: data.renderSequence,
        vx: data.vx, vy: data.vy, dashing: data.dashing, meleeActive: data.meleeActive };
    };
    const before = check(await capture('idle'), 'idle');
    const captures = [write(before, 'idle')];
    await page.screenshot({ path: `${out}/${character}-full-frame.png` });
    await page.keyboard.down('ArrowRight');
    captures.push(write(check(await capture('run'), 'run'), 'run'));
    await page.keyboard.down('Space');
    const jump = check(await capture('jump'), 'jump');
    assert.ok(jump.vx > 10 && jump.vy < 0, 'jump frame shows real movement and upward velocity');
    captures.push(write(jump, 'jump'));
    await page.keyboard.up('Space');
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('KeyC');
    const combat = check(await capture('combat'), 'combat');
    assert.equal(combat.meleeActive, true);
    captures.push(write(combat, 'combat'));
    await page.keyboard.up('KeyC');
    await page.keyboard.down('ShiftLeft');
    const dash = check(await capture('dash'), 'dash');
    assert.equal(dash.dashing, true);
    captures.push(write(dash, 'dash'));
    await page.keyboard.up('ShiftLeft');
    const renderMs = await page.evaluate(() => new Promise(resolve => {
      const e = window.__engine, original = e.render, times = [];
      let timer;
      const finish = () => { e.render = original; clearTimeout(timer); resolve(times); };
      e.render = function (...args) {
        const start = performance.now();
        try { return original.apply(this, args); }
        finally { times.push(performance.now() - start); if (times.length >= 90) finish(); }
      };
      timer = setTimeout(finish, 12000);
    }));
    assert.ok(renderMs.length >= 30, 'enough measured render calls');
    renderMs.sort((a, b) => a - b);
    assert.deepEqual(errors, []);
    report.runs.push({ character, captures, errors,
      renderMs: { samples: renderMs.length, median: renderMs[Math.floor(renderMs.length * .5)], p95: renderMs[Math.floor(renderMs.length * .95)] } });
    await page.close();
  }
  // Diagnostic contact sheet: actual shared painter, not simulated gameplay.
  const compiled = await build({ entryPoints: ['src/game/rendering/character-art.ts'], bundle: true,
    format: 'iife', globalName: 'Art', write: false });
  const defs = await build({ entryPoints: ['src/game/data/characters.ts'], bundle: true,
    format: 'iife', globalName: 'Defs', write: false });
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 500 } });
  await sheet.setContent('<body style="margin:0"><canvas width="1200" height="500"></canvas></body>');
  await sheet.addScriptTag({ content: compiled.outputFiles[0].text });
  await sheet.addScriptTag({ content: defs.outputFiles[0].text });
  await sheet.evaluate(() => {
    const ctx = document.querySelector('canvas').getContext('2d');
    ctx.fillStyle = '#21112f'; ctx.fillRect(0, 0, 1200, 500);
    ctx.fillStyle = '#f4f2ed'; ctx.font = '16px sans-serif';
    ctx.fillText('NINJA — shared renderer studies (6× diagnostic scale; not gameplay)', 24, 30);
    const ninja = Defs.CHARACTERS.find(c => c.id === 'ninja');
    const poses = [{}, { stride: 2 }, { airborne: true }, { dashing: true }, { melee: .5 }];
    poses.forEach((pose, i) => {
      const x = 75 + i * 235;
      ctx.fillStyle = '#f4f2ed'; ctx.fillText(['IDLE', 'RUN', 'JUMP', 'DASH', 'ATTACK'][i], x, 65);
      ctx.save(); ctx.translate(x + 50, 135); ctx.scale(6, 6);
      Art.drawCharacterArt(ctx, ninja, ninja.width, ninja.height, pose); ctx.restore();
      ctx.save(); ctx.translate(x + 50, 410);
      Art.drawCharacterArt(ctx, ninja, ninja.width, ninja.height, pose); ctx.restore();
    });
  });
  await sheet.screenshot({ path: `${out}/ninja-studies.png` });
  await sheet.close();
  writeFileSync(`${out}/evidence.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ runs: report.runs.map(({ character, renderMs, errors }) => ({ character, renderMs, errors })), out }, null, 2));
} finally { await browser.close(); }
