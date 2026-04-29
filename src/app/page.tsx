'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { GameEngine } from '@/game';
import { useGameStore } from '@/components/GameStore';
import { loadSelectedCharacter } from '@/game/data/characters';
import StartScreen from '@/components/StartScreen';
import PauseMenu from '@/components/PauseMenu';
import GameOverScreen from '@/components/GameOverScreen';
import HUD from '@/components/HUD';
import TouchControls from '@/components/TouchControls';
import { createMultiplayerRoom, joinMultiplayerRoom, leaveMultiplayerRoom, syncMultiplayerRoom } from '@/game/multiplayer/client';
import type { NetRoomState } from '@/game/multiplayer/types';

interface MultiplayerSession {
  roomId: string;
  playerId: string;
  playerName: string;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const [multiplayerSession, setMultiplayerSession] = useState<MultiplayerSession | null>(null);
  const multiplayerSessionRef = useRef<MultiplayerSession | null>(null);
  const [multiplayerNotice, setMultiplayerNotice] = useState<string | null>(null);
  const pendingCarryIntentRef = useRef<{ targetId: string | null; dropCarry: boolean } | null>(null);
  const {
    state, stats, settings, seed,
    startGame, pauseGame, resumeGame, gameOver, quitToMenu, updateStats,
  } = useGameStore();

  // Boot the engine once; keep callbacks current via refs to avoid restarts
  const onStatsRef = useRef(updateStats);
  const onGameOverRef = useRef(gameOver);
  onStatsRef.current = updateStats;
  onGameOverRef.current = gameOver;
  multiplayerSessionRef.current = multiplayerSession;

  useEffect(() => {
    if (!canvasRef.current) return;
    const charId = loadSelectedCharacter();
    const game = new GameEngine(canvasRef.current, 42, charId);
    gameRef.current = game;

    game.onStatsUpdate = (s) => onStatsRef.current(s);
    game.onGameOver = () => onGameOverRef.current();
    game.onCarryIntent = (payload) => {
      pendingCarryIntentRef.current = payload;
    };

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
    setMultiplayerSession(null);
    setMultiplayerNotice(null);
    gameRef.current?.setMultiplayerEnabled(false);
    startGame(s);
    gameRef.current?.setSeed(s, charId);
  }, [startGame]);

  const applyRemotePlayerState = useCallback((room: NetRoomState, localId: string) => {
    const game = gameRef.current;
    if (!game) return;
    const remote = room.players.find((p) => p.id !== localId) ?? null;
    if (remote) {
      game.setRemotePlayerState({
        id: remote.id,
        name: remote.name,
        snapshot: remote.snapshot,
        carryTargetId: remote.carryTargetId,
        carriedById: remote.carriedById,
      });
    } else {
      game.setRemotePlayerState(null);
    }
  }, []);

  const handlePlayMultiplayer = useCallback(async (params: { mode: 'host' | 'join'; roomId?: string; playerName: string; seed?: number }) => {
    const charId = loadSelectedCharacter();
    try {
      const result = params.mode === 'host'
        ? await createMultiplayerRoom({ playerName: params.playerName, characterId: charId, seed: params.seed })
        : await joinMultiplayerRoom({ roomId: params.roomId ?? '', playerName: params.playerName, characterId: charId });

      const session: MultiplayerSession = {
        roomId: result.roomId,
        playerId: result.playerId,
        playerName: params.playerName,
      };
      setMultiplayerSession(session);
      setMultiplayerNotice(`${params.mode === 'host' ? 'Hosting' : 'Joined'} room ${result.roomId}`);
      startGame(result.seed);
      gameRef.current?.setSeed(result.seed, charId);
      gameRef.current?.setMultiplayerEnabled(true, result.playerId);
      applyRemotePlayerState(result.room, result.playerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start multiplayer';
      setMultiplayerNotice(message);
    }
  }, [applyRemotePlayerState, startGame]);

  const handlePause = useCallback(() => {
    pauseGame();
    gameRef.current?.pause();
  }, [pauseGame]);

  const handleResume = useCallback(() => {
    resumeGame();
    gameRef.current?.resume();
  }, [resumeGame]);

  const handleRestart = useCallback(() => {
    const activeSession = multiplayerSessionRef.current;
    const nextSeed = activeSession ? seed : Math.floor(Math.random() * 999999);
    startGame(nextSeed);
    gameRef.current?.setSeed(nextSeed, loadSelectedCharacter());
    gameRef.current?.setMultiplayerEnabled(!!activeSession, activeSession?.playerId ?? null);
    pendingCarryIntentRef.current = null;
  }, [seed, startGame]);

  const handleQuit = useCallback(() => {
    const session = multiplayerSessionRef.current;
    if (session) {
      void leaveMultiplayerRoom(session.roomId, session.playerId).catch(() => {});
    }
    setMultiplayerSession(null);
    setMultiplayerNotice(null);
    pendingCarryIntentRef.current = null;
    gameRef.current?.setMultiplayerEnabled(false);
    quitToMenu();
    gameRef.current?.setSeed(42, loadSelectedCharacter()); // restore demo world on menu
  }, [quitToMenu]);

  useEffect(() => {
    if (state !== 'playing' || !multiplayerSession || !gameRef.current) return;

    let cancelled = false;
    const tick = async () => {
      const game = gameRef.current;
      const session = multiplayerSessionRef.current;
      if (!game || !session || cancelled) return;

      const carryIntent = pendingCarryIntentRef.current;
      pendingCarryIntentRef.current = null;

      try {
        const result = await syncMultiplayerRoom({
          roomId: session.roomId,
          playerId: session.playerId,
          snapshot: game.getLocalPlayerSnapshot(),
          carryTargetId: carryIntent?.targetId,
          dropCarry: carryIntent?.dropCarry ?? false,
        });
        if (cancelled) return;
        applyRemotePlayerState(result.room, session.playerId);
      } catch (error) {
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : 'Multiplayer sync failed';
          setMultiplayerNotice(msg);
        }
      }
    };

    const interval = window.setInterval(() => {
      void tick();
    }, 90);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [applyRemotePlayerState, multiplayerSession, state]);

  useEffect(() => {
    return () => {
      const session = multiplayerSessionRef.current;
      if (session) {
        void leaveMultiplayerRoom(session.roomId, session.playerId).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!multiplayerNotice) return;
    const timer = window.setTimeout(() => setMultiplayerNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [multiplayerNotice]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ imageRendering: 'auto' }}
      />

      {/* Menu overlays */}
      {state !== 'playing' && (
        <div className="absolute inset-0 z-10">
          {state === 'menu' && <StartScreen onPlay={handlePlay} onPlayMultiplayer={handlePlayMultiplayer} />}
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
      {state === 'playing' && (
        <div
          className="absolute inset-x-0 top-0 z-[9] pointer-events-none"
          style={{ height: 88, background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0))' }}
        />
      )}
      {state === 'playing' && <HUD stats={stats} settings={settings} />}
      {state === 'playing' && <TouchControls />}
      {state === 'playing' && multiplayerSession && (
        <div
          className="absolute left-1/2 z-20 pointer-events-none"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 56px)',
            transform: 'translateX(-50%)',
            background: 'rgba(2,6,23,0.62)',
            border: '1px solid rgba(148,163,184,0.28)',
            borderRadius: 999,
            padding: '4px 10px',
            color: '#cbd5e1',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          Room {multiplayerSession.roomId}
        </div>
      )}
      {multiplayerNotice && (
        <div
          className="absolute left-1/2 z-30 pointer-events-none"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
            transform: 'translateX(-50%)',
            background: 'rgba(15,23,42,0.82)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 10,
            padding: '6px 10px',
            color: '#e2e8f0',
            fontSize: 12,
            fontWeight: 500,
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          {multiplayerNotice}
        </div>
      )}

      {/* Pause button — iOS system style */}
      {state === 'playing' && (
        <button
          onClick={handlePause}
          aria-label="Pause"
          style={{
            position: 'absolute',
            top: 'calc(env(safe-area-inset-top, 0px) + 12px)',
            right: 'calc(env(safe-area-inset-right, 0px) + 14px)',
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
