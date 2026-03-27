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
    startGame, pauseGame, resumeGame, quitToMenu,
  } = useGameStore();

  useEffect(() => {
    if (!canvasRef.current) return;
    const game = new GameEngine(canvasRef.current);
    gameRef.current = game;
    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const handlePlay = useCallback((seed?: number) => startGame(seed), [startGame]);
  const handlePause = useCallback(() => pauseGame(), [pauseGame]);
  const handleResume = useCallback(() => resumeGame(), [resumeGame]);
  const handleRestart = useCallback(() => startGame(), [startGame]);
  const handleQuit = useCallback(() => quitToMenu(), [quitToMenu]);

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
          {state === 'paused' && <PauseMenu onResume={handleResume} onQuit={handleQuit} />}
          {state === 'gameover' && <GameOverScreen stats={stats} onRestart={handleRestart} />}
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
