#!/usr/bin/env node
/**
 * Offline service worker — live browser QA ("the run in your pocket").
 *
 * Pins the three mandated bars against the RENDERED production app:
 *   (a) ONLINE LOAD IS NETWORK-FIRST — with the SW controlling the page, an
 *       online load still hits the network for the game entry (the document
 *       AND the /_next/static/ engine bundle), counted via context.route
 *       interception; corroborated by navigation transferSize > 0. This is
 *       the structural stale-deploy immunity: online clients never read the
 *       cache first.
 *   (b) ONE ONLINE VISIT ⇒ OFFLINE RELOAD BOOTS THE GAME — after the cache
 *       warms, context.setOffline(true) + reload still renders the main
 *       menu from the versioned cache.
 *   (c) OLD-VERSION CACHE PURGED ON ACTIVATE — a planted
 *       dashverse-offline-v0 cache is deleted when the worker (re)activates;
 *       the current version survives.
 *   (d) BONUS: cold navigation offline (path with no cache match) is served
 *       the styled, honest /offline.html fallback page.
 *
 * Run (production build REQUIRED — registration is production-only):
 *   npm run build && npx next start -p 3111 &
 *   GAME_URL=http://127.0.0.1:3111 \
 *   PLAYWRIGHT_PACKAGE=<path>/node_modules/playwright/package.json \
 *     node scripts/test-offline-service-worker.mjs
 *
 * Without GAME_URL this file runs as a source audit and exits 0 (repo
 * convention, same as scripts/test-viewport-focus-a11y.mjs). Bundled
 * Chromium only on this Mac — no channel:'chrome'.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const swSrc = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
const offlineSrc = readFileSync(new URL('../public/offline.html', import.meta.url), 'utf8');

describe('offline service worker source pins', () => {
  test('network-first order: fetch(request) is awaited before any cache.match in the fetch path', () => {
    const body = swSrc.slice(swSrc.indexOf('async function networkFirst'));
    assert.ok(body.length > 0, 'networkFirst strategy must exist');
    const fetchAt = body.indexOf('await fetch(request)');
    const matchAt = body.indexOf('cache.match(');
    assert.ok(fetchAt !== -1 && matchAt !== -1 && fetchAt < matchAt,
      'online requests must never short-circuit to cache (fetch before match)');
  });

  test('versioned cache with activate-time purge + skipWaiting + clients.claim', () => {
    assert.match(swSrc, /const CACHE_VERSION = 'dashverse-offline-v\d+'/);
    const activate = swSrc.slice(swSrc.indexOf("addEventListener('activate'"));
    assert.ok(activate.includes('caches.keys()') && activate.includes('caches.delete('));
    assert.ok(activate.includes('!== CACHE_VERSION'), 'every non-current cache must be purged');
    assert.match(swSrc, /skipWaiting\(\)/);
    assert.match(swSrc, /clients\.claim\(\)/);
  });

  test('offline page is honest: explains the one-visit requirement, no fake loading', () => {
    assert.match(offlineSrc, /one prior visit while online/i);
    assert.doesNotMatch(offlineSrc, /loading/i);
  });

  test('one-visit precache: install warms the document + its referenced engine bundle', () => {
    const install = swSrc.slice(swSrc.indexOf("addEventListener('install'"));
    assert.match(install, /fetch\('\/'/, 'install must fetch the game document');
    assert.ok(install.replace(/\\/g, '').includes('/_next/static/'), 'install must extract the referenced /_next/static bundle URLs');
    assert.ok(install.includes('cache.put(new Request'), 'install must cache the document under a plain GET key');
  });
});

const GAME_URL = process.env.GAME_URL;
if (!GAME_URL) {
  console.log('PASS (source audit only): offline SW contracts; live offline probe skipped (no GAME_URL)');
  process.exit(0);
}

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE || import.meta.url);
const { chromium } = require('playwright');

const violations = [];
const check = (ok, label, detail = '') => {
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) violations.push(`${label}${detail ? `: ${detail}` : ''}`);
};

// Poll a self-contained page-side predicate via explicit evaluate roundtrips
// (robust where rAF-based waitForFunction can stall or surface rejections).
// The predicate returns null/false to keep polling, truthy to finish.
const pollUntil = async (page, predicate, timeoutMs = 30000, intervalMs = 400) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const result = await page.evaluate(predicate);
      if (result) return result;
    } catch { /* transient (worker mid-swap) — retry */ }
    await page.waitForTimeout(intervalMs);
  }
  return null;
};

const browser = await chromium.launch({ headless: true }); // bundled chromium; NO channel:'chrome'
try {
  const context = await browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'allow' });

  // Network-hit counter at the context routing layer (sees SW-issued fetches
  // in Playwright >= 1.25, which is how the SW's own network-first fetch
  // travels to the wire).
  const netHits = { doc: 0, static: 0 };
  const origin = new URL(GAME_URL).origin;
  await context.route('**/*', (route) => {
    try {
      const url = new URL(route.request().url());
      if (url.origin === origin) {
        if (url.pathname === '/') netHits.doc++;
        else if (url.pathname.startsWith('/_next/static/')) netHits.static++;
      }
    } catch { /* non-URL request — ignore */ }
    return route.continue();
  });

  const page = await context.newPage();

  // ── (a) online load: network-first, SW active, cache warms ──
  await page.goto(GAME_URL, { waitUntil: 'domcontentloaded' });
  await page.locator('[role="region"][aria-label="Main menu"]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500); // let lazy chunks + manifest settle

  const swActive = await page.evaluate(() => new Promise((resolve) => {
    navigator.serviceWorker.getRegistration().then((reg) => resolve(!!(reg && (reg.active || reg.installing || reg.waiting))));
  }));
  check(swActive, 'service worker registered and active after first online load');

  const cacheWarm = (await pollUntil(page, async () => {
    const keys = await caches.keys();
    const name = keys.find((k) => k.startsWith('dashverse-offline-'));
    if (!name) return null;
    const cache = await caches.open(name);
    const paths = (await cache.keys()).map((r) => new URL(r.url).pathname);
    if (!(paths.includes('/') && paths.some((p) => p.startsWith('/_next/static/')))) return null;
    return { warm: true, entries: paths.length, name };
  }, 30000)) ?? (await page.evaluate(async () => {
    // Timed out cold: report the REAL cache contents for the failure detail.
    const keys = await caches.keys();
    const counts = {};
    for (const k of keys) {
      counts[k] = (await (await caches.open(k)).keys()).length;
    }
    return { warm: false, entries: JSON.stringify(counts), name: null };
  }));
  check(cacheWarm.warm, `cache warmed: game document + engine chunk cached (${cacheWarm.name})`, `${cacheWarm.entries} entries`);

  check(netHits.doc >= 1, 'online load hit the NETWORK for the game document (network-first)', `doc hits=${netHits.doc}`);
  check(netHits.static >= 1, 'online load hit the NETWORK for the /_next/static engine bundle', `static hits=${netHits.static}`);
  const navTransfer = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.transferSize ?? -1);
  check(navTransfer > 0, 'navigation bytes came over the wire on first load (transferSize > 0)', `transferSize=${navTransfer}`);

  // ── (b) ONE online visit ⇒ offline reload boots the game ──
  // The product promise: a single visit while online leaves a complete,
  // bootable copy of the run in the versioned cache (install-time precache
  // of the document + the engine bundle it references).
  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[role="region"][aria-label="Main menu"]').waitFor({ timeout: 30000 });
    const offlineTransfer = await page.evaluate(() => performance.getEntriesByType('navigation')[0]?.transferSize ?? -1);
    check(offlineTransfer === 0, 'after one online visit, offline reload boots the game from cache (zero network bytes)', `transferSize=${offlineTransfer}`);
  } catch (error) {
    check(false, 'offline reload boots the game: main menu renders from the versioned cache', String(error).slice(0, 220));
  } finally {
    await context.setOffline(false);
  }

  // ── (c) "new deploy": version bump purges every older cache on activate ──
  // A real deploy ships a modified sw.js and the user reloads; the registrar
  // re-registers, the browser updates the worker, skipWaiting promotes it,
  // and the activate handler purges EVERY cache that is not the new version.
  // We simulate exactly that by bumping the version constant on disk
  // (restored in `finally`), so the proof is end-to-end against the real
  // update machinery.
  const swPath = fileURLToPath(new URL('../public/sw.js', import.meta.url));
  const swOriginal = readFileSync(swPath, 'utf8');
  try {
    await page.evaluate(async () => {
      const stale = await caches.open('dashverse-offline-v0');
      await stale.put('/stale-probe', new Response('stale bytes from a previous deploy'));
    });
    writeFileSync(
      swPath,
      swOriginal.replace("CACHE_VERSION = 'dashverse-offline-v1'", "CACHE_VERSION = 'dashverse-offline-v2'"),
      'utf8'
    );
    // The user returns after the deploy: an ONLINE reload must never serve
    // stale bytes — network-first fetches the fresh document immediately.
    const docHitsBeforeDeploy = netHits.doc;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[role="region"][aria-label="Main menu"]').waitFor({ timeout: 30000 });
    check(netHits.doc > docHitsBeforeDeploy, 'post-deploy online reload fetched the fresh document from the network (never stale)', `doc hits=${docHitsBeforeDeploy}→${netHits.doc}`);
    // Registrar re-registers on load; nudge the update check explicitly too.
    await page.evaluate(() => navigator.serviceWorker.getRegistration()
      .then((reg) => reg.update()).catch(() => {}));
    const purgedKeys = await pollUntil(page, async () => {
      const keys = await caches.keys();
      if (keys.includes('dashverse-offline-v2') && !keys.includes('dashverse-offline-v1') && !keys.includes('dashverse-offline-v0')) return keys;
      return null;
    }, 45000);
    const afterDeploy = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        installing: reg?.installing?.state ?? null,
        waiting: reg?.waiting?.state ?? null,
        active: reg?.active?.state ?? null,
      };
    });
    check(
      Array.isArray(purgedKeys),
      'deploy simulation (v1→v2 bump): new cache live, ALL older caches purged on activate',
      `caches=${purgedKeys ? purgedKeys.join(', ') : 'purge incomplete'} worker(installing/waiting/active)=${afterDeploy.installing}/${afterDeploy.waiting}/${afterDeploy.active}`
    );
    // Subsequent online visit under the new worker re-warms the new cache
    // (runtime caching is versioned, so the purge left it cold).
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[role="region"][aria-label="Main menu"]').waitFor({ timeout: 30000 });
    await pollUntil(page, async () => {
      const cache = await caches.open('dashverse-offline-v2');
      const paths = (await cache.keys()).map((r) => new URL(r.url).pathname);
      return paths.includes('/') && paths.some((p) => p.startsWith('/_next/static/'));
    }, 20000);
  } catch (error) {
    check(false, 'deploy simulation: version-bump invalidation', String(error).slice(0, 220));
  } finally {
    writeFileSync(swPath, swOriginal, 'utf8');
  }

  // ── (d) cold navigation offline → styled honest fallback page ──
  const probeUrl = GAME_URL.replace(/\/$/, '') + '/offline-probe-no-cache-match';
  await context.setOffline(true);
  await page.goto(probeUrl, { waitUntil: 'domcontentloaded' });
  const offlinePage = await page.evaluate(() => ({
    badge: document.querySelector('.badge')?.textContent ?? '',
    title: document.querySelector('h1')?.textContent ?? '',
  }));
  check(
    offlinePage.title === 'DASHVERSE' && offlinePage.badge === 'SIGNAL LOST',
    'cold offline navigation serves the styled honest fallback page',
    JSON.stringify(offlinePage)
  );
  await context.setOffline(false);

  if (violations.length) {
    throw new Error(`${violations.length} offline-SW live violation(s): ${violations.join(' | ')}`);
  }
  console.log('PASS: offline SW live bars verified — network-first online loads, offline reload boots the game, old-version cache purged on activate, styled fallback offline.');
} finally {
  await browser.close();
}
