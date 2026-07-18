import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveReducedMotion,
  type GameSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
} from '@/game/state/game-state';

/**
 * Reduced-motion resolver: the bridge between the player's preference and the
 * effective boolean the engine consumes. The three settings ('auto' | 'on' |
 * 'off') must map deterministically — 'on' always reduces, 'off' always full,
 * and 'auto' defers to the OS via matchMedia.
 */
describe('resolveReducedMotion', () => {
  const originalWindow = (globalThis as { window?: Window }).window;

  beforeEach(() => {
    // Start each test from a clean window state so matchMedia stubs don't leak.
    delete (globalThis as { window?: Window }).window;
  });

  afterEach(() => {
    if (originalWindow) {
      (globalThis as { window?: Window }).window = originalWindow;
    } else {
      delete (globalThis as { window?: Window }).window;
    }
  });

  it('"on" always reduces, even with no window/matchMedia', () => {
    assert.equal(resolveReducedMotion('on'), true);
  });

  it('"off" never reduces, even with no window/matchMedia', () => {
    assert.equal(resolveReducedMotion('off'), false);
  });

  it('"auto" returns false when window is undefined (SSR-safe)', () => {
    assert.equal(resolveReducedMotion('auto'), false);
  });

  it('"auto" returns false when matchMedia is missing (older browsers)', () => {
    stubWindow({ matchMedia: undefined });
    assert.equal(resolveReducedMotion('auto'), false);
  });

  it('"auto" honors prefers-reduced-motion: reduce', () => {
    stubWindow({ reduce: true });
    assert.equal(resolveReducedMotion('auto'), true);
  });

  it('"auto" honors prefers-reduced-motion: no-preference', () => {
    stubWindow({ reduce: false });
    assert.equal(resolveReducedMotion('auto'), false);
  });

  it('"auto" returns false if matchMedia throws', () => {
    stubWindow({ matchMediaThrows: true });
    assert.equal(resolveReducedMotion('auto'), false);
  });
});

describe('GameSettings reducedMotion field (persistence contract)', () => {
  const STORAGE_KEY = 'dashverse-settings';

  afterEach(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
  });

  it('DEFAULT_SETTINGS exposes reducedMotion: "auto"', () => {
    assert.equal(DEFAULT_SETTINGS.reducedMotion, 'auto');
  });

  it('loadSettings fills reducedMotion from storage when present', () => {
    stubWindow();
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, reducedMotion: 'on' }),
    );
    const loaded = loadSettings();
    assert.equal(loaded.reducedMotion, 'on');
  });

  it('loadSettings defaults to "auto" when the field is missing (back-compat)', () => {
    stubWindow();
    // Persist an old-shape settings object without reducedMotion.
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        masterVolume: 0.5,
        sfxVolume: 0.8,
        musicVolume: 0.6,
        showFPS: true,
        showDebug: false,
        reducedParticles: false,
        cameraMode: 'horizontal',
      } satisfies Omit<GameSettings, 'reducedMotion'>),
    );
    const loaded = loadSettings();
    assert.equal(loaded.reducedMotion, 'auto');
  });

  it('saveSettings round-trips reducedMotion', () => {
    stubWindow();
    saveSettings({ ...DEFAULT_SETTINGS, reducedMotion: 'off' });
    const raw = localStorage.getItem(STORAGE_KEY);
    assert.ok(raw, 'settings should be persisted');
    assert.equal(JSON.parse(raw).reducedMotion, 'off');
    assert.equal(loadSettings().reducedMotion, 'off');
  });
});

/* ── window/matchMedia stub helpers ─────────────────────────── */

interface StubOptions {
  reduce?: boolean;
  matchMedia?: undefined;
  matchMediaThrows?: boolean;
}

function stubWindow(opts: StubOptions = {}): void {
  const reduce = opts.reduce ?? false;
  const localStorageMock: Storage = (() => {
    let store: Record<string, string> = {};
    return {
      get length() { return Object.keys(store).length; },
      clear: () => { store = {}; },
      getItem: (k: string) => (k in store ? store[k] : null),
      key: (i: number) => Object.keys(store)[i] ?? null,
      removeItem: (k: string) => { delete store[k]; },
      setItem: (k: string, v: string) => { store[k] = String(v); },
    };
  })();

  const matchMedia =
    opts.matchMedia === undefined
      ? (q: string): MediaQueryList => {
          if (opts.matchMediaThrows) throw new Error('matchMedia boom');
          // Minimal MediaQueryList stub — only what resolveReducedMotion reads.
          return {
            matches: q.includes('reduce') ? reduce : false,
            media: q,
            onchange: null,
            addEventListener: () => {},
            removeEventListener: () => {},
            addListener: () => {},
            removeListener: () => {},
            dispatchEvent: () => false,
          } as unknown as MediaQueryList;
        }
      : undefined;

  (globalThis as { window?: Window & typeof globalThis }).window = {
    localStorage: localStorageMock,
    matchMedia,
  } as unknown as Window & typeof globalThis;

  // localStorage is exposed as a global on the same window object.
  (globalThis as { localStorage?: Storage }).localStorage = localStorageMock;
}
