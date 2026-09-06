import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 630 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('dash-controls-hint-dismissed', '1'));
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3010');
  await page.locator('.dash-mode-card-v2').first().waitFor();
  assert.equal(await page.locator('[data-ink-cover]').count(), 1, 'Menu must have an illustrated comic cover, not just dashboard cards');
  const art = await page.locator('[data-ink-cover]').boundingBox();
  assert.ok(art.height >= 160, 'Cover art gets meaningful space at short desktop height');
  const play = page.getByRole('button', { name: /Play Endless/ });
  const box = await play.boundingBox();
  assert.ok(box.y >= 0 && box.y + box.height <= 630, 'Primary play visible without scrolling');
  await page.getByText('How to play', { exact: true }).click();
  assert.ok(await page.getByRole('note', { name: 'Controls overview' }).isVisible(), 'Controls remain discoverable');
  await page.getByText('How to play', { exact: true }).click();
  await page.getByRole('button', { name: /Same-Wi-Fi/ }).click();
  assert.ok(await page.locator('#samesifi-panel').isVisible());
  await page.getByRole('button', { name: /Hide Wi-Fi/ }).click();
  await page.getByRole('button', { name: 'Ninja', exact: true }).click();
  assert.equal((await page.locator('.dash-runner-v2 h2').innerText()).toLowerCase(), 'ninja');
  const runnerContained = await page.locator('.dash-runner-v2').evaluate(panel => {
    const right = panel.getBoundingClientRect().right;
    return [...panel.querySelectorAll('.dash-stat-stack-v2, .dash-character-card-v3')].every(el => el.getBoundingClientRect().right <= right - 8) && (() => {
      const frame = panel.querySelector('.dash-character-stage-v3').getBoundingClientRect();
      const canvas = panel.querySelector('.dash-character-stage-v3 canvas').getBoundingClientRect();
      return canvas.width <= frame.width && canvas.height <= frame.height;
    })();
  });
  assert.ok(runnerContained, 'Runner stats and roster fit inside the ink frame');
  await page.screenshot({ path: process.env.MENU_SCREENSHOT || '/tmp/dashverse-ink-menu.png' });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await play.scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No horizontal overflow at ${width}`);
    const b = await play.boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= width, 'Play CTA fits');
  }
  await page.setViewportSize({ width: 1280, height: 630 });
  await play.click();
  await page.waitForFunction(() => !document.querySelector('.dash-menu-shell'));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.keyboard.up('ArrowRight');
  assert.deepEqual(errors, [], 'No runtime errors in menu/launch');
  console.log('PASS: illustrated cover, primary action, controls disclosure, co-op, character choice, responsive reflow and live launch');
} finally { await browser.close(); }
