'use client';

import { useEffect, useCallback, useRef } from 'react';
import { GameEngine } from '@/game';
import { useGameStore } from '@/components/GameStore';
import StartScreen from '@/components/StartScreen';
import PauseMenu from '@/components/PauseMenu';
import GameOverScreen from '@/components/GameOverScreen';
import HUD from '@/components/HUD';
import TouchControls from '@/components/TouchControls';

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const {
    state, stats, settings,
    startGame, pauseGame, resumeGame, gameOver, quitToMenu, updateStats,
  } = useGameStore();

  // Boot the engine once; keep callbacks current via refs to avoid restarts
  const onStatsRef = useRef(updateStats);
  const onGameOverRef = useRef(gameOver);
  onStatsRef.current = updateStats;
  onGameOverRef.current = gameOver;

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new GameEngine(canvasRef.current, 42);
    gameRef.current = game;

    game.onStatsUpdate = (s) => onStatsRef.current(s);
    game.onGameOver = () => onGameOverRef.current();

    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []); // intentionally empty — engine lives for the page lifetime

  // Sync engine pause/resume with React state
  useEffect(() => {
    if (!gameRef.current) return;
    if (state === 'paused') gameRef.current.pause();
    else if (state === 'playing') gameRef.current.resume();
  }, [state]);

  // Escape key toggles pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Escape') return;
      if (state === 'playing') {
        pauseGame();
        gameRef.current?.pause();
      } else if (state === 'paused') {
        resumeGame();
        gameRef.current?.resume();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, pauseGame, resumeGame]);

  const handlePlay = useCallback((seed?: number) => {
    const s = seed ?? Math.floor(Math.random() * 999999);
    startGame(s);
    gameRef.current?.setSeed(s);
  }, [startGame]);

  const handlePause = useCallback(() => {
    pauseGame();
    gameRef.current?.pause();
  }, [pauseGame]);

  const handleResume = useCallback(() => {
    resumeGame();
    gameRef.current?.resume();
  }, [resumeGame]);

  const handleRestart = useCallback(() => {
    const seed = Math.floor(Math.random() * 999999);
    startGame(seed);
    gameRef.current?.setSeed(seed);
  }, [startGame]);

  const handleQuit = useCallback(() => {
    quitToMenu();
    gameRef.current?.setSeed(42); // restore demo world on menu
  }, [quitToMenu]);

  return (
    <main className="w-screen h-screen overflow-hidden bg-black relative select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
        style={{ imageRendering: 'auto' }}
      />

      {/* Menu overlays */}
      {state !== 'playing' && (
        <div className="absolute inset-0 z-10">
          {state === 'menu' && <StartScreen onPlay={handlePlay} />}
          {state === 'paused' && (
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onQuit={handleQuit}
            />
          )}
          {state === 'gameover' && (
            <GameOverScreen
              stats={stats}
              onRestart={handleRestart}
              onQuit={handleQuit}
            />
          )}
        </div>
      )}

      {/* In-game UI */}
      {state === 'playing' && <HUD stats={stats} settings={settings} />}
      {state === 'playing' && <TouchControls />}

      {/* Pause button */}
      {state === 'playing' && (
        <button
          onClick={handlePause}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full
                     bg-black/40 backdrop-blur-md border border-white/10
                     flex items-center justify-center text-white/70 hover:text-white
                     hover:bg-black/60 transition-all active:scale-95"
          aria-label="Pause"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="4" height="12" rx="1" />
            <rect x="9" y="2" width="4" height="12" rx="1" />
          </svg>
        </button>
      )}
    </main>
  );
}
