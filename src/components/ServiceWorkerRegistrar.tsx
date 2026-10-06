'use client';

import { useEffect } from 'react';

/**
 * Registers the hand-written offline service worker (/public/sw.js).
 *
 * PRODUCTION-ONLY BY DESIGN: the caching strategy is network-first, so
 * registering in production costs nothing in freshness, while `next dev`
 * serves unhashed, constantly-mutating /_next/static assets and an HMR
 * websocket that a caching worker would only ever interfere with. Next.js
 * statically replaces process.env.NODE_ENV in client bundles, so the dev
 * build tree-shakes registration away entirely.
 *
 * Registration waits for the window `load` event so it never competes with
 * the game bundle for bandwidth on first visit.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        // Offline play is a progressive enhancement — never break boot over it.
        console.warn('[dashverse] service worker registration skipped:', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
