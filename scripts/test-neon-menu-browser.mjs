import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
// Use an externally installed Playwright; no runtime dependency for the game.
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 630 }, reducedMotion: 'reduce' });
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3010');
  await page.locator('.dash-mode-card-v2').first().waitFor();
  await page.waitForTimeout(700);
  const geometry = await page.evaluate(() => [...document.querySelectorAll('.dash-mode-card-v2')].map(el => {
    const r = el.getBoundingClientRect(); const p = el.closest('.dash-command-panel').getBoundingClientRect();
    return { text: el.textContent.trim(), bottom: r.bottom, panelBottom: p.bottom, visible: r.top >= p.top && r.bottom <= p.bottom && r.bottom <= innerHeight };
  }));
  console.log(JSON.stringify(geometry, null, 2));
  await page.screenshot({ path: process.env.MENU_SCREENSHOT || '/tmp/dashverse-menu-qa.png' });
  assert.ok(geometry.every(r => r.visible), 'Every mode card must fit its panel and the short desktop viewport');
  assert.equal((await page.locator('h1').innerText()).replace(/\s/g, '').toUpperCase(), 'DASHVERSE');
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await page.locator('.dash-mode-card-v2').last().scrollIntoViewIfNeeded();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `No page overflow at ${width}px`);
    const title = await page.locator('h1').boundingBox();
    assert.ok(title.x >= 0 && title.x + title.width <= width, `Title fits ${width}px`);
  }
  console.log('PASS: short desktop mode cards, DASHVERSE title, 320/390/768px reflow');
} finally { await browser.close(); }
