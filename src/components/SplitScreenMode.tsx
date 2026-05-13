'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react';
import { GameEngine } from '@/game';
import TouchControls from './TouchControls';
import { loadSelectedCharacter } from '@/game/data/characters';

interface LocalStats {
  score: number;
  distance: number;
  health: number;
  maxHealth: number;
}

interface Props {
  seed?: number;
  onExit: () => void;
}

const DIVIDER_HEIGHT = 58;
const FRAME_GAP = 10;
const LOCAL_HOST_ID = 'local-bottom';
const LOCAL_GUEST_ID = 'local-top';

const SplitScreenMode: FC<Props> = ({ seed, onExit }) => {
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
  const topGameRef = useRef<GameEngine | null>(null);
  const bottomGameRef = useRef<GameEngine | null>(null);

  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const [topStats, setTopStats] = useState<LocalStats>({ score: 0, distance: 0, health: 3, maxHealth: 3 });
  const [bottomStats, setBottomStats] = useState<LocalStats>({ score: 0, distance: 0, health: 3, maxHealth: 3 });
  const [topDead, setTopDead] = useState(false);
  const [bottomDead, setBottomDead] = useState(false);

  const selected = loadSelectedCharacter();
  const altCharacter = useMemo(() => (selected === 'ninja' ? 'ranger' : 'ninja'), [selected]);

  const paneSize = useMemo(() => {
    const safeWidth = Math.max(220, viewport.width - 14);
    const safeHeight = Math.max(220, (viewport.height - DIVIDER_HEIGHT - FRAME_GAP * 2) / 2);
    return Math.floor(Math.min(safeWidth, safeHeight));
  }, [viewport.height, viewport.width]);

  const restartBoth = useCallback(() => {
    const nextSeed = Math.floor(Math.random() * 999999);
    const topGame = topGameRef.current;
    const bottomGame = bottomGameRef.current;
    if (!topGame || !bottomGame) return;
    topGame.setSeed(nextSeed, selected);
    bottomGame.setSeed(nextSeed, altCharacter);
    topGame.resume();
    bottomGame.resume();
    setTopDead(false);
    setBottomDead(false);
  }, [altCharacter, selected]);

  useEffect(() => {
    const onResize = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const topCanvas = topCanvasRef.current;
    const bottomCanvas = bottomCanvasRef.current;
    if (!topCanvas || !bottomCanvas) return;

    const worldSeed = Number.isFinite(seed) ? Number(seed) : Math.floor(Math.random() * 999999);
    const topGame = new GameEngine(topCanvas, worldSeed, selected, {
      input: { channel: 'game-input-top', enableKeyboard: false },
      cameraMode: 'split',
    });
    const bottomGame = new GameEngine(bottomCanvas, worldSeed, altCharacter, {
      input: { channel: 'game-input-bottom', enableKeyboard: false },
      cameraMode: 'split',
    });
    topGameRef.current = topGame;
    bottomGameRef.current = bottomGame;

    topGame.onStatsUpdate = (s) => {
      setTopStats({ score: s.score, distance: s.distance, health: s.health, maxHealth: s.maxHealth });
    };
    bottomGame.onStatsUpdate = (s) => {
      setBottomStats({ score: s.score, distance: s.distance, health: s.health, maxHealth: s.maxHealth });
    };
    topGame.onGameOver = () => {
      setTopDead(true);
      topGame.pause();
    };
    bottomGame.onGameOver = () => {
      setBottomDead(true);
      bottomGame.pause();
    };

    // Keep split-screen world aligned: bottom acts as local authority for enemies.
    topGame.setMultiplayerEnabled(true, LOCAL_GUEST_ID, LOCAL_HOST_ID);
    bottomGame.setMultiplayerEnabled(true, LOCAL_HOST_ID, LOCAL_HOST_ID);

    const syncTimer = window.setInterval(() => {
      const topSnapshot = topGame.getLocalPlayerSnapshot();
      const bottomSnapshot = bottomGame.getLocalPlayerSnapshot();
      const topProjectiles = topGame.getLocalPlayerProjectiles();
      const bottomProjectiles = bottomGame.getLocalPlayerProjectiles();

      topGame.setRemotePlayerState({
        id: LOCAL_HOST_ID,
        name: 'Bottom Player',
        snapshot: bottomSnapshot,
        carryTargetId: null,
        carriedById: null,
        serverTime: Date.now(),
      });
      bottomGame.setRemotePlayerState({
        id: LOCAL_GUEST_ID,
        name: 'Top Player',
        snapshot: topSnapshot,
        carryTargetId: null,
        carriedById: null,
        serverTime: Date.now(),
      });
      topGame.setRemotePlayerProjectiles(bottomProjectiles);
      bottomGame.setRemotePlayerProjectiles(topProjectiles);

      const hostEnemySnapshots = bottomGame.getEnemySnapshots();
      topGame.applyEnemySnapshots(hostEnemySnapshots);

      const topKills = topGame.drainRecentEnemyDefeatIds();
      if (topKills.length > 0) {
        bottomGame.killEnemiesById(topKills);
      }
    }, 16);

    topGame.start();
    bottomGame.start();

    return () => {
      window.clearInterval(syncTimer);
      topGame.destroy();
      bottomGame.destroy();
      topGameRef.current = null;
      bottomGameRef.current = null;
    };
  }, [altCharacter, seed, selected]);

  return (
    <div className="absolute inset-0 z-40 bg-[#030712] flex flex-col items-center justify-center overflow-hidden">
      <div
        style={{
          width: paneSize,
          height: paneSize,
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(148,163,184,0.26)',
          background: '#000',
        }}
      >
        <canvas
          ref={topCanvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ transform: 'rotate(180deg)', transformOrigin: 'center center' }}
        />
        <div style={{ position: 'absolute', inset: 0, transform: 'rotate(180deg)', transformOrigin: 'center center' }}>
          <TouchControls channel="game-input-top" compact />
        </div>
        <SplitHud label="Top Player" stats={topStats} rotated />
        {topDead && <PaneDeadOverlay onRestart={restartBoth} rotated />}
      </div>

      <div
        style={{
          width: paneSize,
          height: DIVIDER_HEIGHT,
          margin: `${FRAME_GAP}px 0`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'rgba(15,23,42,0.88)',
          border: '1px solid rgba(148,163,184,0.25)',
          borderRadius: 12,
          padding: '8px 10px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}
      >
        <button className="ios-btn-gray" style={{ height: 38, fontSize: 14, flex: 1 }} onClick={onExit}>
          Exit Split
        </button>
        <button className="ios-btn-primary" style={{ height: 38, fontSize: 14, flex: 1 }} onClick={restartBoth}>
          Restart Both
        </button>
      </div>

      <div
        style={{
          width: paneSize,
          height: paneSize,
          position: 'relative',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
          border: '1px solid rgba(148,163,184,0.26)',
          background: '#000',
        }}
      >
        <canvas ref={bottomCanvasRef} className="absolute inset-0 w-full h-full" />
        <TouchControls channel="game-input-bottom" compact />
        <SplitHud label="Bottom Player" stats={bottomStats} />
        {bottomDead && <PaneDeadOverlay onRestart={restartBoth} />}
      </div>
    </div>
  );
};

export default SplitScreenMode;

const SplitHud: FC<{ label: string; stats: LocalStats; rotated?: boolean }> = ({ label, stats, rotated = false }) => {
  const hearts = Array.from({ length: stats.maxHealth }, (_, i) => i < stats.health);
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        right: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        pointerEvents: 'none',
        transform: rotated ? 'rotate(180deg)' : undefined,
      }}
    >
      <div
        style={{
          background: 'rgba(2,6,23,0.66)',
          border: '1px solid rgba(148,163,184,0.24)',
          borderRadius: 999,
          padding: '4px 8px',
          color: '#e2e8f0',
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div
          style={{
            background: 'rgba(2,6,23,0.66)',
            border: '1px solid rgba(148,163,184,0.24)',
            borderRadius: 999,
            padding: '4px 8px',
            color: '#e2e8f0',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {stats.distance}m
        </div>
        <div
          style={{
            background: 'rgba(2,6,23,0.66)',
            border: '1px solid rgba(148,163,184,0.24)',
            borderRadius: 999,
            padding: '4px 8px',
            display: 'flex',
            gap: 2,
          }}
        >
          {hearts.map((alive, i) => (
            <span key={i} style={{ fontSize: 11, opacity: alive ? 1 : 0.35 }}>{alive ? '❤️' : '🖤'}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

const PaneDeadOverlay: FC<{ onRestart: () => void; rotated?: boolean }> = ({ onRestart, rotated = false }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.58)',
      transform: rotated ? 'rotate(180deg)' : undefined,
      pointerEvents: 'none',
    }}
  >
    <div
      style={{
        background: 'rgba(15,23,42,0.84)',
        border: '1px solid rgba(148,163,184,0.24)',
        borderRadius: 12,
        padding: '8px 10px',
        color: '#e2e8f0',
        fontSize: 12,
        textAlign: 'center',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ marginBottom: 6, fontWeight: 700 }}>Down!</div>
      <button className="ios-btn-primary" style={{ height: 34, fontSize: 12, minWidth: 104 }} onClick={onRestart}>
        Restart
      </button>
    </div>
  </div>
);
