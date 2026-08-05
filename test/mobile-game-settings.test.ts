import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { register } from 'node:module';

/**
 * Tests for the mobile game-settings module.
 *
 * The module imports @react-native-async-storage/async-storage, which is a
 * React Native native module unavailable under Node. We register a custom
 * module loader (scripts/test-async-storage-mock.mjs) that intercepts the
 * import and returns an in-memory mock, then dynamically import the SUT.
 */

// ── AsyncStorage mock ──────────────────────────────────────────────

class AsyncStorageMock {
  private data = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.data.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.data.set(key, value);
  }

  async multiGet(keys: string[]): Promise<Array<[string, string | null]>> {
    return keys.map(k => [k, this.data.get(k) ?? null]);
  }

  async removeItem(key: string): Promise<void> {
    this.data.delete(key);
  }

  _reset(): void {
    this.data.clear();
  }
}

const mockStore = new AsyncStorageMock();
(globalThis as Record<string, unknown>).__asyncStorageMock = mockStore;

// Register the loader hook from the external .mjs file.
const hookPath = new URL('../scripts/test-async-storage-mock.mjs', import.meta.url);
register(hookPath);

// Dynamically import the SUT after the loader is registered.
const mod = await import('../apps/mobile/lib/game-settings.ts');
const loadGameSettings = mod.loadGameSettings;
const DEFAULT_GAME_SETTINGS = mod.DEFAULT_GAME_SETTINGS;

const SETTINGS_PREFIX = '@game_settings_';

beforeEach(() => mockStore._reset());
afterEach(() => mockStore._reset());

describe('mobile game settings loader', () => {
  it('returns defaults when no settings are stored', async () => {
    const settings = await loadGameSettings();
    assert.deepEqual(settings, DEFAULT_GAME_SETTINGS);
  });

  it('loads persisted boolean and number settings', async () => {
    await mockStore.setItem(SETTINGS_PREFIX + 'masterVolume', JSON.stringify(0.3));
    await mockStore.setItem(SETTINGS_PREFIX + 'sfxVolume', JSON.stringify(0.9));
    await mockStore.setItem(SETTINGS_PREFIX + 'musicVolume', JSON.stringify(0.1));
    await mockStore.setItem(SETTINGS_PREFIX + 'showFPS', JSON.stringify(true));
    await mockStore.setItem(SETTINGS_PREFIX + 'reducedParticles', JSON.stringify(false));
    await mockStore.setItem(SETTINGS_PREFIX + 'hapticsEnabled', JSON.stringify(false));
    await mockStore.setItem(SETTINGS_PREFIX + 'largeControls', JSON.stringify(true));

    const settings = await loadGameSettings();
    assert.equal(settings.masterVolume, 0.3);
    assert.equal(settings.sfxVolume, 0.9);
    assert.equal(settings.musicVolume, 0.1);
    assert.equal(settings.showFPS, true);
    assert.equal(settings.reducedParticles, false);
    assert.equal(settings.hapticsEnabled, false);
    assert.equal(settings.largeControls, true);
  });

  it('falls back to defaults for corrupt values', async () => {
    await mockStore.setItem(SETTINGS_PREFIX + 'masterVolume', 'not-json');
    await mockStore.setItem(SETTINGS_PREFIX + 'showFPS', JSON.stringify('string-not-bool'));
    await mockStore.setItem(SETTINGS_PREFIX + 'sfxVolume', JSON.stringify('NaN'));

    const settings = await loadGameSettings();
    assert.equal(settings.masterVolume, DEFAULT_GAME_SETTINGS.masterVolume);
    assert.equal(settings.showFPS, DEFAULT_GAME_SETTINGS.showFPS);
    assert.equal(settings.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume);
  });

  it('falls back to defaults when a key is missing', async () => {
    await mockStore.setItem(SETTINGS_PREFIX + 'masterVolume', JSON.stringify(0.5));

    const settings = await loadGameSettings();
    assert.equal(settings.masterVolume, 0.5);
    assert.equal(settings.sfxVolume, DEFAULT_GAME_SETTINGS.sfxVolume);
    assert.equal(settings.largeControls, DEFAULT_GAME_SETTINGS.largeControls);
  });

  it('uses default values that match the Settings screen defaults', async () => {
    // These must match the usePersistedSetting defaults in settings.tsx so
    // there is no flicker between the first paint and settings hydration.
    assert.equal(DEFAULT_GAME_SETTINGS.masterVolume, 0.7);
    assert.equal(DEFAULT_GAME_SETTINGS.sfxVolume, 0.8);
    assert.equal(DEFAULT_GAME_SETTINGS.musicVolume, 0.6);
    assert.equal(DEFAULT_GAME_SETTINGS.showFPS, false);
    assert.equal(DEFAULT_GAME_SETTINGS.reducedParticles, true);
    assert.equal(DEFAULT_GAME_SETTINGS.hapticsEnabled, true);
    assert.equal(DEFAULT_GAME_SETTINGS.largeControls, false);
  });
});
