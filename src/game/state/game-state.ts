/**
 * Game state management — shared between React UI and game engine.
 */

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover' | 'levelselect' | 'levelcomplete';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  showDebug: boolean;
  reducedParticles: boolean;
  cameraMode: 'auto' | 'horizontal' | 'vertical';
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
  reducedParticles: false,
  cameraMode: 'auto',
  reducedMotion: 'auto',
};

const STORAGE_KEY = 'dashverse';

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-settings`);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: GameSettings): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(`${STORAGE_KEY}-settings`, JSON.stringify(s)); } catch { /* ignore */ }
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
