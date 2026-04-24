'use client';

import { createContext, useContext, useReducer, useEffect, type ReactNode, useRef } from 'react';
import {
  type GameState, type GameSettings, type GameStats,
  DEFAULT_SETTINGS, loadSettings, loadHighScore, saveHighScore, saveSettings,
} from '@/game/state/game-state';
import {
  loadLifetimeStats, saveLifetimeStats, loadUnlockedAchievements,
  saveUnlockedAchievements, checkNewAchievements,
} from '@/lib/achievements';

export interface GameStoreAPI {
  state: GameState;
  stats: GameStats;
  settings: GameSettings;
  seed: number;
  startGame: (seed?: number) => void;
  pauseGame: () => void;
  resumeGame: () => void;
  gameOver: () => void;
  quitToMenu: () => void;
  setSettings: (s: Partial<GameSettings>) => void;
  updateStats: (s: Partial<GameStats>) => void;
}

const DEFAULT_STATS: GameStats = {
  score: 0,
  highScore: 0,
  coins: 0,
  distance: 0,
  health: 100,
  maxHealth: 100,
  biome: 'Grassland',
  fps: 60,
  powerUps: [],
};

type Action =
  | { type: 'HYDRATE'; settings: GameSettings; highScore: number }
  | { type: 'START'; seed: number }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'GAMEOVER' }
  | { type: 'QUIT_TO_MENU' }
  | { type: 'UPDATE_STATS'; stats: Partial<GameStats> }
  | { type: 'SET_SETTINGS'; settings: Partial<GameSettings> };

interface State {
  gameState: GameState;
  stats: GameStats;
  settings: GameSettings;
  seed: number;
  hydrated: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'HYDRATE':
      return {
        ...state,
        hydrated: true,
        settings: action.settings,
        stats: { ...state.stats, highScore: action.highScore },
      };
    case 'START':
      return {
        ...state,
        gameState: 'playing',
        seed: action.seed,
        stats: { ...DEFAULT_STATS, highScore: state.stats.highScore },
      };
    case 'PAUSE':
      return state.gameState === 'playing' ? { ...state, gameState: 'paused' } : state;
    case 'RESUME':
      return state.gameState === 'paused' ? { ...state, gameState: 'playing' } : state;
    case 'GAMEOVER': {
      const hs = Math.max(state.stats.score, state.stats.highScore);
      saveHighScore(hs);

      // Persist lifetime stats for achievements
      const prev = loadLifetimeStats();
      const updated = {
        totalGames: prev.totalGames + 1,
        highScore: Math.max(prev.highScore, state.stats.score),
        totalDistance: prev.totalDistance + Math.round(state.stats.distance),
        totalCoins: prev.totalCoins + state.stats.coins,
        bestDistance: Math.max(prev.bestDistance, Math.round(state.stats.distance)),
        bestCoins: Math.max(prev.bestCoins, state.stats.coins),
      };
      saveLifetimeStats(updated);

      // Check for new achievements
      const prevUnlocked = loadUnlockedAchievements();
      const newIds = checkNewAchievements(prevUnlocked, updated);
      if (newIds.length > 0) {
        saveUnlockedAchievements([...prevUnlocked, ...newIds]);
      }

      return { ...state, gameState: 'gameover', stats: { ...state.stats, highScore: hs } };
    }
    case 'QUIT_TO_MENU':
      return { ...state, gameState: 'menu' };
    case 'UPDATE_STATS':
      return { ...state, stats: { ...state.stats, ...action.stats } };
    case 'SET_SETTINGS':
      return { ...state, settings: { ...state.settings, ...action.settings } };
    default:
      return state;
  }
}

const Ctx = createContext<GameStoreAPI | null>(null);

export function GameStoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    gameState: 'menu' as GameState,
    stats: DEFAULT_STATS,
    settings: DEFAULT_SETTINGS,
    seed: 42,
    hydrated: false,
  });

  useEffect(() => {
    dispatch({ type: 'HYDRATE', settings: loadSettings(), highScore: loadHighScore() });
  }, []);

  const api = useRef<GameStoreAPI>(null!);
  api.current = {
    state: state.gameState,
    stats: state.stats,
    settings: state.settings,
    seed: state.seed,
    startGame: (seed?: number) => dispatch({ type: 'START', seed: seed ?? Math.floor(Math.random() * 999999) }),
    pauseGame: () => dispatch({ type: 'PAUSE' }),
    resumeGame: () => dispatch({ type: 'RESUME' }),
    gameOver: () => dispatch({ type: 'GAMEOVER' }),
    quitToMenu: () => dispatch({ type: 'QUIT_TO_MENU' }),
    setSettings: (s) => dispatch({ type: 'SET_SETTINGS', settings: s }),
    updateStats: (s) => dispatch({ type: 'UPDATE_STATS', stats: s }),
  };

  // Persist settings
  useEffect(() => {
    if (state.hydrated) saveSettings(state.settings);
  }, [state.hydrated, state.settings]);

  return <Ctx.Provider value={api.current}>{children}</Ctx.Provider>;
}

export function useGameStore(): GameStoreAPI {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useGameStore must be inside GameStoreProvider');
  return ctx;
}
