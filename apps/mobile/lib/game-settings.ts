import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persisted game settings shared between the Settings tab and the Game screen.
 *
 * The Settings screen reads/writes these via usePersistedSetting, while the
 * Game screen loads them once on mount (and on focus) to push the values into
 * the WebView engine bridge. The keys here MUST match the keys used by
 * usePersistedSetting (which prefixes with @game_settings_).
 */

const SETTINGS_PREFIX = '@game_settings_';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  reducedParticles: boolean;
  hapticsEnabled: boolean;
  largeControls: boolean;
}

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  showFPS: false,
  reducedParticles: true,
  hapticsEnabled: true,
  largeControls: false,
};

function parseBoolean(raw: string | null | undefined, fallback: boolean): boolean {
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'boolean' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseNumber(raw: string | null | undefined, fallback: number): number {
  if (raw === null || raw === undefined) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Load all game settings from AsyncStorage in a single batch read.
 * Returns DEFAULT_GAME_SETTINGS for any missing or corrupt entries.
 */
export async function loadGameSettings(): Promise<GameSettings> {
  const keys = [
    SETTINGS_PREFIX + 'masterVolume',
    SETTINGS_PREFIX + 'sfxVolume',
    SETTINGS_PREFIX + 'musicVolume',
    SETTINGS_PREFIX + 'showFPS',
    SETTINGS_PREFIX + 'reducedParticles',
    SETTINGS_PREFIX + 'hapticsEnabled',
    SETTINGS_PREFIX + 'largeControls',
  ];
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    const map = new Map(pairs);
    return {
      masterVolume: parseNumber(map.get(keys[0]), DEFAULT_GAME_SETTINGS.masterVolume),
      sfxVolume: parseNumber(map.get(keys[1]), DEFAULT_GAME_SETTINGS.sfxVolume),
      musicVolume: parseNumber(map.get(keys[2]), DEFAULT_GAME_SETTINGS.musicVolume),
      showFPS: parseBoolean(map.get(keys[3]), DEFAULT_GAME_SETTINGS.showFPS),
      reducedParticles: parseBoolean(map.get(keys[4]), DEFAULT_GAME_SETTINGS.reducedParticles),
      hapticsEnabled: parseBoolean(map.get(keys[5]), DEFAULT_GAME_SETTINGS.hapticsEnabled),
      largeControls: parseBoolean(map.get(keys[6]), DEFAULT_GAME_SETTINGS.largeControls),
    };
  } catch {
    return DEFAULT_GAME_SETTINGS;
  }
}
