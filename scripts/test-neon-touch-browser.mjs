import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3010');
  await page.getByRole('button', { name: /Play Endless/ }).click();
  const jump = page.getByRole('button', { name: 'Jump', exact: true });
  await jump.waitFor();
  await page.evaluate(() => {
    window.__inputs = [];
    window.addEventListener('game-input', e => window.__inputs.push(e.detail));
    // Read the existing live engine from its React ref, not a mocked game.
    const canvas = document.querySelector('canvas');
    let fiber = canvas[Object.keys(canvas).find(k => k.startsWith('__reactFiber$'))];
    while (fiber) {
      for (let hook = fiber.memoizedState; hook; hook = hook.next) {
        const candidate = hook.memoizedState?.current;
        if (candidate?.player && candidate?.getLocalPlayerSnapshot) { window.__engine = candidate; break; }
      }
      if (window.__engine) break;
      fiber = fiber.return;
    }
  });
  await page.waitForFunction(() => window.__engine?.player?.onGround);
  const initialY = await page.evaluate(() => window.__engine.player.y);
  const box = await jump.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
  await page.waitForTimeout(80);
  assert.equal(await jump.getAttribute('aria-pressed'), 'true');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('button[aria-label="Jump"]')).backgroundColor === 'rgb(199, 255, 77)');
  const held = await jump.evaluate(el => ({ bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, blur: getComputedStyle(el).backdropFilter }));
  assert.equal(held.bg, 'rgb(199, 255, 77)');
  assert.equal(held.color, 'rgb(10, 10, 15)');
  assert.equal(held.blur, 'none');
  assert.ok(await page.evaluate(y => window.__engine.player.y < y, initialY), 'Real touch press lifts live player');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.equal(await jump.getAttribute('aria-pressed'), 'false');
  for (const name of ['Dash', 'Attack', 'Melee slash', 'Special attack', 'Carry teammate']) {
    const b = page.getByRole('button', { name, exact: true });
    await b.tap();
    assert.equal(await b.getAttribute('aria-pressed'), 'false', `${name} releases`);
  }
  const inputs = await page.evaluate(() => window.__inputs);
  for (const type of ['jump', 'dash', 'attack', 'melee', 'special', 'carry']) {
    assert.ok(inputs.some(e => e.type === `${type}-press` && e.value === true), `${type} pressed`);
    assert.ok(inputs.some(e => e.type === `${type}-press` && e.value === false), `${type} released`);
  }
  await page.screenshot({ path: process.env.TOUCH_SCREENSHOT || '/tmp/dashverse-touch-qa.png' });
  await page.getByRole('button', { name: 'Pause game', exact: true }).tap();
  await page.getByRole('button', { name: /Resume/i }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: live player jumps via real touch, six actions press/release, ink contrast, pause, no runtime errors');
} finally { await browser.close(); }
