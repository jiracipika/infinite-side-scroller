/**
 * Game state management — shared between React UI and game engine.
 */

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'levelselect' | 'levelcomplete';

export type TouchControlLayout = 'standard' | 'mirrored';
export type TouchControlSize = 'compact' | 'standard' | 'large';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  showDebug: boolean;
  /** Enables touch feedback and gameplay-event vibration on supported devices. */
  hapticsEnabled: boolean;
  reducedParticles: boolean;
  cameraMode: 'auto' | 'horizontal' | 'vertical';
  /** Places movement under the left or right thumb. */
  touchControlLayout: TouchControlLayout;
  /** Scales touch targets without changing the game viewport. */
  touchControlSize: TouchControlSize;
  /** Overall touch-control visibility, clamped to a usable 55–100% range. */
  touchControlOpacity: number;
  /**
   * 'auto'  — honor the OS/browser prefers-reduced-motion setting (default).
   * 'on'   — force reduced motion regardless of OS setting.
   * 'off'  — play full motion even if the OS asks for reduced motion.
   */
  reducedMotion: 'auto' | 'on' | 'off';
}

export interface GameStats {
  score: number;
  highScore: number;
  coins: number;
  distance: number;
  health: number;
  maxHealth: number;
  lives: number;
  biome: string;
  fps: number;
  /** Most recent frame interval (ms). Populated from the profiler; undefined in non-engine contexts. */
  frameTimeMs?: number;
  /** 95th-percentile frame interval (ms) over the profiler's rolling window. */
  frameTime95Ms?: number;
  powerUps: string[];
  comboCount?: number;
  comboMultiplier?: number;
  maxCombo?: number;
  /** Seconds remaining before the current combo resets (0 when no active combo). */
  comboTimeRemaining?: number;
  enemiesDefeated?: number;
  dayPhase?: 'dawn' | 'day' | 'dusk' | 'night';
  levelTimeRemaining?: number;
  levelTarget?: number;
}

export interface GameCallbacks {
  onPlay: (seed?: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onPause: () => void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  showFPS: false,
  showDebug: false,
  hapticsEnabled: true,
  reducedParticles: false,
  cameraMode: 'auto',
  touchControlLayout: 'standard',
  touchControlSize: 'standard',
  touchControlOpacity: 0.8,
  reducedMotion: 'auto',
};

const STORAGE_KEY = 'dashverse';

const clampUnit = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
};

/**
 * Repair persisted settings before they reach rendering/audio code. Local storage
 * may contain an older schema, hand-edited values, or malformed JSON-derived data.
 */
export function normalizeSettings(value: unknown): GameSettings {
  const raw = value && typeof value === 'object'
    ? value as Partial<Record<keyof GameSettings, unknown>>
    : {};

  const cameraMode = raw.cameraMode === 'horizontal' || raw.cameraMode === 'vertical'
    ? raw.cameraMode
    : 'auto';
  const reducedMotion = raw.reducedMotion === 'on' || raw.reducedMotion === 'off'
    ? raw.reducedMotion
    : 'auto';
  const touchControlLayout = raw.touchControlLayout === 'mirrored' ? 'mirrored' : 'standard';
  const touchControlSize = raw.touchControlSize === 'compact' || raw.touchControlSize === 'large'
    ? raw.touchControlSize
    : 'standard';

  return {
    masterVolume: clampUnit(raw.masterVolume, DEFAULT_SETTINGS.masterVolume),
    sfxVolume: clampUnit(raw.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
    musicVolume: clampUnit(raw.musicVolume, DEFAULT_SETTINGS.musicVolume),
    showFPS: typeof raw.showFPS === 'boolean' ? raw.showFPS : DEFAULT_SETTINGS.showFPS,
    showDebug: typeof raw.showDebug === 'boolean' ? raw.showDebug : DEFAULT_SETTINGS.showDebug,
    hapticsEnabled: typeof raw.hapticsEnabled === 'boolean'
      ? raw.hapticsEnabled
      : DEFAULT_SETTINGS.hapticsEnabled,
    reducedParticles: typeof raw.reducedParticles === 'boolean'
      ? raw.reducedParticles
      : DEFAULT_SETTINGS.reducedParticles,
    cameraMode,
    touchControlLayout,
    touchControlSize,
    touchControlOpacity: Math.max(0.55, clampUnit(
      raw.touchControlOpacity,
      DEFAULT_SETTINGS.touchControlOpacity,
    )),
    reducedMotion,
  };
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-settings`);
    if (raw) return normalizeSettings(JSON.parse(raw));
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: GameSettings): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`${STORAGE_KEY}-settings`, JSON.stringify(normalizeSettings(s))); } catch { /* ignore */ }
}

export function loadHighScore(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const v = localStorage.getItem(`${STORAGE_KEY}-highscore`);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch { return 0; }
}

export function saveHighScore(s: number): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`${STORAGE_KEY}-highscore`, String(s)); } catch { /* ignore */ }
}

/**
 * Resolve the effective reduced-motion preference.
 *
 * - 'on'  always wins (the player explicitly asked for less motion).
 * - 'off' always wins (the player explicitly opted in to full motion).
 * - 'auto' defers to the OS/browser: returns true when the user has set
 *   prefers-reduced-motion: reduce at the platform level.
 *
 * Safe on the server (no window): returns false there.
 */
export function resolveReducedMotion(setting: 'auto' | 'on' | 'off'): boolean {
  if (setting === 'on') return true;
  if (setting === 'off') return false;
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}
