import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chrome' }),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 630 }, reducedMotion: 'reduce' });
  await page.addInitScript(() => localStorage.setItem('dash-controls-hint-dismissed', '1'));
  await page.addInitScript(() => {
    if (localStorage.getItem('iss-save-slots-v1')) return;
    localStorage.setItem('iss-save-slots-v1', JSON.stringify([
      { id: 'slot1', bankCoins: 500, artStyleByCharacter: { ninja: 'ink' } },
      { id: 'slot2', artStyleByCharacter: { ninja: 'pixel' } },
    ]));
  });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.GAME_URL || 'http://127.0.0.1:3010');
  await page.locator('.dash-mode-card-v2').first().waitFor();
  assert.equal(await page.locator('[data-ink-cover]').count(), 1, 'Menu must have an illustrated comic cover, not just dashboard cards');
  const art = await page.locator('[data-ink-cover]').boundingBox();
  assert.ok(art.height >= 160, 'Cover art gets meaningful space at short desktop height');
  assert.equal(await page.locator('.dash-character-card-v3').count(), 17);
  await page.waitForFunction(() => document.querySelector('[data-ink-cover] canvas')?.width > 0);
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
  const ink = page.getByRole('button', { name: 'Ink', exact: true });
  assert.equal(await ink.getAttribute('aria-pressed'), 'true', 'Slot 1 loads the saved Ink preference');
  const ansley = page.getByRole('button', { name: /Ansley, locked/ });
  await ansley.click();
  assert.equal(await page.locator('.dash-runner-v2 h2').innerText(), 'Ansley');
  assert.equal(await page.getByRole('button', { name: 'Ninja', exact: true }).getAttribute('data-equipped'), 'true');
  assert.equal(await page.getByRole('button', { name: /Bank coins/ }).innerText(), '500 coins');
  const stage = page.locator('.dash-character-stage-v3 canvas');
  const idleArt = await stage.evaluate(canvas => canvas.toDataURL());
  await page.getByRole('button', { name: 'Attack', exact: true }).click();
  assert.equal(await page.getByRole('button', { name: 'Attack', exact: true }).getAttribute('aria-pressed'), 'true');
  const attackArt = await stage.evaluate(canvas => canvas.toDataURL());
  assert.notEqual(attackArt, idleArt, 'Reduced motion shows a distinct attack pose');
  await page.getByRole('button', { name: /Unlock Ansley/ }).click();
  assert.equal(await page.getByRole('button', { name: 'Ansley', exact: true }).getAttribute('data-equipped'), 'true');
  assert.equal(await page.getByRole('button', { name: /Bank coins/ }).innerText(), '50 coins');
  await page.getByRole('button', { name: 'Ninja', exact: true }).click();
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
    await page.locator('.dash-menu-shell').evaluate(shell => { shell.scrollTop = 0; });
    await play.scrollIntoViewIfNeeded();
    if (width === 390 && process.env.MOBILE_MENU_SCREENSHOT) {
      await page.screenshot({ path: process.env.MOBILE_MENU_SCREENSHOT });
    }
    assert.ok(await page.locator('.dash-menu-shell').evaluate(shell => shell.scrollWidth <= shell.clientWidth), `No horizontal overflow at ${width}`);
    const b = await play.boundingBox();
    assert.ok(b.x >= 0 && b.x + b.width <= width, 'Play CTA fits');
  }
  await page.setViewportSize({ width: 1280, height: 630 });
  await page.getByRole('button', { name: /Adventure/ }).click();
  await page.getByRole('button', { name: /Continue:/ }).click();
  await page.getByText(/Shadow Tempest/).waitFor();
  await page.keyboard.press('Escape');
  const pause = page.getByRole('dialog', { name: 'Game paused' });
  await pause.getByRole('button', { name: /Resume/ }).click();
  await page.waitForFunction(() => !document.querySelector('.dash-menu-shell'));
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.press('Space');
  await page.keyboard.up('ArrowRight');
  assert.deepEqual(errors, [], 'No runtime errors in menu/launch');
  console.log('PASS: illustrated cover, primary action, controls disclosure, co-op, locked inspection and purchase, responsive reflow, and Adventure runner/pause');
} finally { await browser.close(); }
