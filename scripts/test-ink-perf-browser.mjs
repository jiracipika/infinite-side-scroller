// Perf-only probe: steady-state rAF cadence of a real run, no screenshots,
// DPR 1, production build. Complements test-ink-gameplay-browser.mjs (which
// captures heavy dpr=2 screenshots and therefore reads much lower FPS).
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3010');
  await page.getByRole('button', { name: /Play Endless/ }).click();
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    let f = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber$'))];
    while (f) {
      for (let h = f.memoizedState; h; h = h.next) {
        const e = h.memoizedState?.current;
        if (e?.player && e?.getLocalPlayerSnapshot) { window.__engine = e; break; }
      }
      if (window.__engine) break;
      f = f.return;
    }
  });
  await page.waitForFunction(() => window.__engine?.player?.onGround);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(6000); // steady-state window, adaptive DPR settled
  const metrics = await page.evaluate(() => window.__engine.profiler.getMetrics());
  await page.keyboard.up('ArrowRight');
  console.log(JSON.stringify(metrics));
  if (process.env.PERF_FPS_MIN) {
    const { strict: assert } = await import('node:assert');
    assert.ok(metrics.fps >= Number(process.env.PERF_FPS_MIN), `fps ${metrics.fps} < ${process.env.PERF_FPS_MIN}`);
    console.log(`PASS: steady-state fps >= ${process.env.PERF_FPS_MIN}`);
  }
} finally { await browser.close(); }
