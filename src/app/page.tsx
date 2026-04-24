'use client';

import { useEffect, useCallback, useRef } from 'react';
import { GameEngine } from '@/game';
import { useGameStore } from '@/components/GameStore';
import { loadSelectedCharacter } from '@/game/data/characters';
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
    const charId = loadSelectedCharacter();
    const game = new GameEngine(canvasRef.current, 42, charId);
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
    const charId = loadSelectedCharacter();
    startGame(s);
    gameRef.current?.setSeed(s, charId);
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
    gameRef.current?.setSeed(42, loadSelectedCharacter()); // restore demo world on menu
  }, [quitToMenu]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black relative select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
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

      {/* Pause button — iOS system style */}
      {state === 'playing' && (
        <button
          onClick={handlePause}
          aria-label="Pause"
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            zIndex: 20,
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.48)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1), opacity 0.1s ease, background 0.12s ease',
            color: 'rgba(235,235,245,0.6)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(235,235,245,0.92)';
            e.currentTarget.style.background = 'rgba(0,0,0,0.64)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(235,235,245,0.6)';
            e.currentTarget.style.background = 'rgba(0,0,0,0.48)';
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1.2" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1.2" />
          </svg>
        </button>
      )}
    </main>
  );
}
