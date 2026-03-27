/**
 * Game state management — shared between React UI and game engine.
 */

export type GameState = 'menu' | 'playing' | 'paused' | 'gameover';

export interface GameSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  showFPS: boolean;
  showDebug: boolean;
  reducedParticles: boolean;
}

export interface GameStats {
  score: number;
  highScore: number;
  coins: number;
  distance: number;
  health: number;
  maxHealth: number;
  biome: string;
  fps: number;
}

export interface GameCallbacks {
  onPlay: (seed?: number) => void;
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
  onPause: () => void;
}

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.7,
  sfxVolume: 0.8,
  musicVolume: 0.6,
  showFPS: false,
  showDebug: false,
  reducedParticles: false,
};

const STORAGE_KEY = 'infinite-side-scroller';

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
