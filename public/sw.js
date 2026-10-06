/* Dashverse offline service worker — "the run in your pocket".
 *
 * STRATEGY (the safety contract, in order):
 *   1. NETWORK-FIRST for the game entry. The HTML document (the app shell the
 *      engine boots inside) and the bundled game code (Next.js hashed chunks
 *      under /_next/static/, which contain src/game/**) ALWAYS go to the
 *      network first. The cache is only consulted when the network request
 *      FAILS. Structural guarantee: while a client is online it can never be
 *      served stale bytes by this SW — a fresh deploy always wins.
 *      (Note: apps/mobile/assets/game.html is the React Native WebView asset
 *      and is NOT served by the web origin — there is no /game.html URL here.
 *      The web "game bundle" IS the /_next/static/ chunk set.)
 *   2. SMALL ALLOWLIST, not an everything-cache. Only same-origin GETs are
 *      considered at all, and only: navigation documents, /_next/static/**
 *      (content-hashed, immutable per build), and /manifest.webmanifest.
 *      /api/** is never touched — multiplayer + leaderboards must stay live.
 *      Cross-origin requests (AdSense, TURN) pass straight through. On
 *      install, the worker precaches the app shell (the document + the
 *      hashed assets it references) so a single online visit is enough for
 *      offline play.
 *   3. VERSIONED CACHE + INVALIDATION. The cache name carries a version
 *      constant (dashverse-offline-vN). On activate, EVERY other cache on
 *      this origin is deleted, and skipWaiting + clients.claim make the new
 *      worker take over immediately. Bump CACHE_VERSION on a risky deploy to
 *      hard-reset every client's cache on their next visit.
 */

const CACHE_VERSION = 'dashverse-offline-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE_URLS = [OFFLINE_URL];

/** Small runtime allowlist — keep this tight on purpose. */
function isCacheable(request, url) {
  // The game document / app shell (e.g. "/").
  if (request.mode === 'navigate') return true;
  // The bundled game + app code. Content-hashed by Next.js per build.
  if (url.pathname.startsWith('/_next/static/')) return true;
  // PWA identity.
  if (url.pathname === '/manifest.webmanifest') return true;
  return false;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      // Precache ONLY the offline fallback page — tiny and local, so install
      // can never fail on a flaky network.
      await cache.addAll(PRECACHE_URLS);
      // Warm the game shell so ONE online visit is enough for offline play.
      // On a first visit the page's own document + initial chunk requests all
      // happen BEFORE the worker takes control (registration waits for window
      // load), so the fetch handler never sees them — the only reliable way
      // to have the run cached after visit one is to precache it here.
      try {
        const doc = await fetch('/', { cache: 'no-cache' });
        if (doc && doc.ok) {
          // Clone BEFORE reading the body — a consumed body cannot be cloned.
          const docCopy = doc.clone();
          const html = await doc.text();
          // Same-origin hashed assets referenced by the document (script src
          // + link href). Hard-capped as a runaway guard.
          const assets = [
            ...new Set(
              (html.match(/(?:src|href)="(\/_next\/static\/[^"]+)"/g) || []).map(
                (m) => m.slice(m.indexOf('"') + 1, -1)
              )
            ),
          ].slice(0, 80);
          await cache.put(new Request('/', { method: 'GET' }), docCopy);
          if (assets.length > 0) await cache.addAll(assets);
          await cache.add('/manifest.webmanifest');
        }
      } catch (error) {
        // Best-effort: runtime caching still warms the cache on later loads.
      }
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // INVALIDATION SAFETY: this origin hosts exactly one app, so any cache
      // that is not the current version is stale by definition — purge it.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  // Never touch non-GET traffic.
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Cache only same-origin GETs; everything cross-origin passes through.
  if (url.origin !== self.location.origin) return;
  // Live gameplay APIs (multiplayer rooms, signals, leaderboards) are never
  // cached — a stale room state is worse than no room state.
  if (url.pathname.startsWith('/api/')) return;
  if (!isCacheable(request, url)) return;
  event.respondWith(networkFirst(request, event));
});

/**
 * NETWORK-FIRST: the network attempt ALWAYS happens and its result (or its
 * failure) decides the outcome. The cache read sits in the catch block, so
 * no online request can ever short-circuit to cached bytes.
 */
async function networkFirst(request, event) {
  const cache = await caches.open(CACHE_VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const copy = response.clone();
      // Cache.put() rejects navigate-mode Request objects, so navigation
      // responses are stored under a plain GET request with the same URL
      // (the network-first fallback matches them back by URL).
      const key = request.mode === 'navigate' ? new Request(request.url, { method: 'GET' }) : request;
      // event.waitUntil keeps this worker alive until the write lands —
      // without it Chromium may retire the worker as soon as respondWith
      // settles and the cache write is silently lost.
      if (event && typeof event.waitUntil === 'function') {
        event.waitUntil(cache.put(key, copy).catch(() => {}));
      } else {
        await cache.put(key, copy);
      }
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, {
      ignoreSearch: request.mode === 'navigate',
    });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      // Cold-cache offline navigation: the styled, honest fallback page.
      const offline = await cache.match(OFFLINE_URL);
      if (offline) return offline;
    }
    throw error;
  }
}
