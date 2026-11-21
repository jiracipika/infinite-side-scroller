'use client';

import { useEffect, type FC } from 'react';

/**
 * Loads Google AdSense on the standalone site only.
 *
 * The game is embedded in third-party pages (e.g. avolab.ca's Arcade iframe,
 * optionally via ?embed=1). AdSense policy requires ads to be served on a
 * property the publisher controls, and the extra network weight hurts the
 * embed's first-paint — so the script is never injected when the game runs
 * inside a frame or with ?embed=1 set.
 */
const AdSenseScript: FC = () => {
  useEffect(() => {
    let embedded = false;
    try {
      const top = window.top;
      embedded =
        new URLSearchParams(window.location.search).get('embed') === '1' ||
        (top !== null && window.self !== top && window.location.hostname !== top.location.hostname);
    } catch {
      // Cross-origin access to window.top throws — we are framed.
      embedded = true;
    }
    if (embedded) return;

    const src =
      'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4128325832827761';
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.crossOrigin = 'anonymous';
    document.head.appendChild(script);
  }, []);

  return null;
};

export default AdSenseScript;
