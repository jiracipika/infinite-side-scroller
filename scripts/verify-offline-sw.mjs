#!/usr/bin/env node
/**
 * Source-audit contract for the offline service worker ("the run in your
 * pocket"). Pins the four safety bars on public/sw.js so they cannot rot:
 *
 *   1. NETWORK-FIRST ORDER — in the fetch path, `fetch(request)` is awaited
 *      BEFORE any `cache.match`, so an online client can never short-circuit
 *      to cached bytes (structural stale-deploy immunity).
 *   2. VERSIONED CACHE + ACTIVATE-TIME PURGE — `dashverse-offline-vN`
 *      constant; every other cache deleted on activate; skipWaiting +
 *      clients.claim so updates take hold promptly.
 *   3. SMALL SAME-ORIGIN GET ALLOWLIST — GET-only, same-origin-only, no
 *      /api/** caching, explicit allowlist (no everything-cache).
 *   4. HONEST OFFLINE UX + CORRECT GAME-ENTRY PATH — offline page exists,
 *      explains the one-visit requirement, contains no fake loading state;
 *      the SW targets the REAL production game entry (Next document +
 *      /_next/static/ chunks) and never a /game.html URL (that file is the
 *      React Native WebView asset, not served by the web origin).
 *
 * Live browser evidence (SW registration, offline reload, network-first hit
 * counting) lives in scripts/test-offline-service-worker.mjs.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const swPath = path.join(root, 'public/sw.js');
const offlinePath = path.join(root, 'public/offline.html');
const registrarPath = path.join(root, 'src/components/ServiceWorkerRegistrar.tsx');
const layoutPath = path.join(root, 'src/app/layout.tsx');

assert(fs.existsSync(swPath), 'public/sw.js must exist');
assert(fs.existsSync(offlinePath), 'public/offline.html must exist');
assert(fs.existsSync(registrarPath), 'src/components/ServiceWorkerRegistrar.tsx must exist');
if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const sw = fs.readFileSync(swPath, 'utf8');
const offline = fs.readFileSync(offlinePath, 'utf8');
const registrar = fs.readFileSync(registrarPath, 'utf8');
const layout = fs.readFileSync(layoutPath, 'utf8');

// ── 1. Network-first order ──
const networkFirstStart = sw.indexOf('async function networkFirst');
assert(networkFirstStart !== -1, 'sw.js must define the networkFirst strategy');
if (networkFirstStart !== -1) {
  const body = sw.slice(networkFirstStart);
  const fetchAt = body.indexOf('await fetch(request)');
  const matchAt = body.indexOf('cache.match(');
  assert(fetchAt !== -1, 'networkFirst must await fetch(request) first');
  assert(matchAt !== -1, 'networkFirst must fall back to cache.match');
  assert(
    fetchAt !== -1 && matchAt !== -1 && fetchAt < matchAt,
    'NETWORK-FIRST VIOLATION: cache.match must only be reachable after the network attempt fails (fetch before cache.match)'
  );
  assert(
    /catch \(error\)/.test(body.slice(fetchAt, matchAt + 200) ) || body.indexOf('catch') > fetchAt,
    'cache fallback must live in the network-failure catch path'
  );
}

// ── 2. Versioned cache + invalidation ──
assert(
  /const CACHE_VERSION = 'dashverse-offline-v\d+'/.test(sw),
  "sw.js must declare a versioned cache constant (dashverse-offline-vN)"
);
const activateStart = sw.indexOf("addEventListener('activate'");
assert(activateStart !== -1, 'sw.js must handle activate');
if (activateStart !== -1) {
  const activateBody = sw.slice(activateStart, sw.indexOf('})()', activateStart));
  assert(
    activateBody.includes('caches.keys()') && activateBody.includes('caches.delete('),
    'activate must enumerate and delete caches'
  );
  assert(
    activateBody.includes('!== CACHE_VERSION'),
    'activate must purge every cache that is not the current version'
  );
}
assert(sw.includes('skipWaiting()'), 'sw.js must call skipWaiting() so updates take hold promptly');
assert(sw.includes('clients.claim()'), 'sw.js must call clients.claim() so updates control open pages');

// ── 2b. One-visit precache (the product promise) ──
// First-visit page requests happen BEFORE the worker takes control, so the
// install handler must cache the game shell itself.
const installBody = sw.slice(sw.indexOf("addEventListener('install'"));
assert(/fetch\('\/'/.test(installBody), 'install must fetch the game document');
assert(installBody.replace(/\\/g, '').includes('/_next/static/'), 'install must extract the referenced /_next/static bundle URLs');
assert(installBody.includes('cache.put(new Request'), 'install must cache the document under a plain GET key');

// ── 3. Small same-origin GET allowlist ──
assert(/method !== 'GET'/.test(sw), 'sw.js must ignore non-GET requests');
assert(
  /url\.origin !== self\.location\.origin/.test(sw),
  'sw.js must pass cross-origin requests through untouched'
);
assert(
  /startsWith\('\/api\/'\)\s*\) return;/.test(sw),
  'sw.js must never intercept /api/** (live multiplayer + leaderboards)'
);
assert(
  /request\.mode === 'navigate'/.test(sw) && sw.includes("startsWith('/_next/static/')"),
  'sw.js allowlist must cover the game document and the /_next/static/ engine bundle'
);
assert(
  /return false;\s*\n\}/.test(sw),
  'sw.js allowlist must be deny-by-default (final `return false`), not an everything-cache'
);

// ── 4. Offline UX + correct game-entry path ──
assert(
  /one prior visit while online|needs one online visit/i.test(offline),
  'offline page must honestly explain that offline play needs one prior online visit'
);
assert(
  !/loading/i.test(offline),
  'offline page must contain no fake loading state (no "loading" copy at all)'
);
// Strip comments so the contract checks sw.js CODE, not its documentation.
const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
assert(
  !swCode.includes('game.html'),
  'sw.js must not reference game.html — that is the React Native WebView asset and is NOT served by the web origin; the web game entry is the document + /_next/static/ chunks'
);
assert(
  /NODE_ENV !== 'production'/.test(registrar),
  'service worker registration must be gated to production builds'
);
assert(
  layout.includes('ServiceWorkerRegistrar'),
  'the app layout must mount ServiceWorkerRegistrar (client-side registration)'
);

if (errors.length > 0) {
  console.error('FAIL: offline service worker contract violations:');
  console.error(errors.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}

console.log(
  'Offline SW verified: network-first game entry (document + /_next/static/), versioned cache with activate-time purge, skipWaiting+claim, same-origin GET allowlist (no /api), honest styled offline page, production-only registration.'
);
