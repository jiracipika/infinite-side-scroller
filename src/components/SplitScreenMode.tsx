'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FC, type RefObject } from 'react';
import { GameEngine } from '@/game';
import TouchControls from './TouchControls';
import { loadSelectedCharacter } from '@/game/data/characters';
import { MP_TICK_MS } from '@/game/multiplayer/config';
import { useGameStore } from './GameStore';

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
  const { settings } = useGameStore();
  const topCanvasRef = useRef<HTMLCanvasElement>(null);
  const bottomCanvasRef = useRef<HTMLCanvasElement>(null);
  const topGameRef = useRef<GameEngine | null>(null);
  const bottomGameRef = useRef<GameEngine | null>(null);

  const [viewport, setViewport] = useState({ width: 390, height: 844 });
  const [viewportReady, setViewportReady] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [topStats, setTopStats] = useState<LocalStats>({ score: 0, distance: 0, health: 3, maxHealth: 3 });
  const [bottomStats, setBottomStats] = useState<LocalStats>({ score: 0, distance: 0, health: 3, maxHealth: 3 });
  const [topDead, setTopDead] = useState(false);
  const [bottomDead, setBottomDead] = useState(false);

  const selected = loadSelectedCharacter();
  const altCharacter = useMemo(() => (selected === 'ninja' ? 'ranger' : 'ninja'), [selected]);

  const isDesktopLayout = viewportReady && !isTouchDevice && viewport.width >= 780;

  const mobilePaneSize = useMemo(() => {
    const safeWidth = Math.max(220, viewport.width - 14);
    const safeHeight = Math.max(220, (viewport.height - DIVIDER_HEIGHT - FRAME_GAP * 2) / 2);
    return Math.floor(Math.min(safeWidth, safeHeight));
  }, [viewport.height, viewport.width]);

  const desktopPaneSize = useMemo(() => {
    const width = Math.floor(Math.min(820, Math.max(280, (viewport.width - 128) / 2)));
    const height = Math.floor(Math.min(540, Math.max(260, viewport.height - 96), width * 0.66));
    return { width, height };
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
      const touch = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
      setIsTouchDevice(touch);
      setViewportReady(true);
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const topCanvas = topCanvasRef.current;
    const bottomCanvas = bottomCanvasRef.current;
    if (!viewportReady || !topCanvas || !bottomCanvas) return;

    const worldSeed = Number.isFinite(seed) ? Number(seed) : Math.floor(Math.random() * 999999);
    const topGame = new GameEngine(topCanvas, worldSeed, selected, {
      input: {
        channel: 'game-input-top',
        enableKeyboard: !isTouchDevice,
        gamepadIndex: 0,
        keyboardScheme: 'wasd',
      },
      cameraMode: 'split',
    });
    const bottomGame = new GameEngine(bottomCanvas, worldSeed, altCharacter, {
      input: {
        channel: 'game-input-bottom',
        enableKeyboard: !isTouchDevice,
        gamepadIndex: 1,
        keyboardScheme: 'arrows',
      },
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
      const bottomKills = bottomGame.drainRecentEnemyDefeatIds();
      if (bottomKills.length > 0) {
        topGame.killEnemiesById(bottomKills);
      }
    }, MP_TICK_MS);

    topGame.start();
    bottomGame.start();

    return () => {
      window.clearInterval(syncTimer);
      topGame.destroy();
      bottomGame.destroy();
      topGameRef.current = null;
      bottomGameRef.current = null;
    };
  }, [altCharacter, isTouchDevice, seed, selected, viewportReady]);

  if (isDesktopLayout) {
    return (
      <div className="absolute inset-0 z-40 bg-[#030712] flex items-center justify-center overflow-hidden">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 18, width: '100%' }}>
          <SplitPane
            canvasRef={topCanvasRef}
            label="WASD Player"
            stats={topStats}
            dead={topDead}
            onRestart={restartBoth}
            width={desktopPaneSize.width}
            height={desktopPaneSize.height}
          />

          <div
            style={{
              width: 84,
              minHeight: desktopPaneSize.height,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              justifyContent: 'center',
              gap: 10,
            }}
          >
            <button className="ios-btn-gray" style={{ height: 42, fontSize: 13 }} onClick={onExit}>
              Exit
            </button>
            <button className="ios-btn-primary" style={{ height: 42, fontSize: 13 }} onClick={restartBoth}>
              Restart
            </button>
            <KeyboardLegend title="Left" keys="W A S D / E / Q / F" />
            <KeyboardLegend title="Right" keys="Arrows / J / K / L" />
          </div>

          <SplitPane
            canvasRef={bottomCanvasRef}
            label="Arrow Player"
            stats={bottomStats}
            dead={bottomDead}
            onRestart={restartBoth}
            width={desktopPaneSize.width}
            height={desktopPaneSize.height}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-40 bg-[#030712] flex flex-col items-center justify-center overflow-hidden">
      <SplitPane
        canvasRef={topCanvasRef}
        label="Top Player"
        stats={topStats}
        dead={topDead}
        onRestart={restartBoth}
        width={mobilePaneSize}
        height={mobilePaneSize}
        rotated
        touchChannel="game-input-top"
        hapticsEnabled={settings.hapticsEnabled}
      />

      <div
        style={{
          width: mobilePaneSize,
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

      <SplitPane
        canvasRef={bottomCanvasRef}
        label="Bottom Player"
        stats={bottomStats}
        dead={bottomDead}
        onRestart={restartBoth}
        width={mobilePaneSize}
        height={mobilePaneSize}
        touchChannel="game-input-bottom"
        hapticsEnabled={settings.hapticsEnabled}
      />
    </div>
  );
};

export default SplitScreenMode;

const SplitPane: FC<{
  canvasRef: RefObject<HTMLCanvasElement>;
  label: string;
  stats: LocalStats;
  dead: boolean;
  onRestart: () => void;
  width: number;
  height: number;
  rotated?: boolean;
  touchChannel?: string;
  hapticsEnabled?: boolean;
}> = ({ canvasRef, label, stats, dead, onRestart, width, height, rotated = false, touchChannel, hapticsEnabled }) => (
  <div
    style={{
      width,
      height,
      position: 'relative',
      borderRadius: 14,
      overflow: 'hidden',
      boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
      border: '1px solid rgba(148,163,184,0.26)',
      background: '#000',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        transform: rotated ? 'rotate(180deg)' : 'none',
        transformOrigin: 'center center',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      {touchChannel && <TouchControls channel={touchChannel} compact hapticsEnabled={hapticsEnabled} />}
      <SplitHud label={label} stats={stats} />
      {dead && <PaneDeadOverlay onRestart={onRestart} />}
    </div>
  </div>
);

const KeyboardLegend: FC<{ title: string; keys: string }> = ({ title, keys }) => (
  <div
    style={{
      borderRadius: 8,
      border: '1px solid rgba(148,163,184,0.25)',
      background: 'rgba(15,23,42,0.72)',
      padding: '8px 7px',
      color: '#e2e8f0',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.82 }}>
      {title}
    </div>
    <div style={{ marginTop: 4, fontSize: 10, lineHeight: 1.25, opacity: 0.7 }}>
      {keys}
    </div>
  </div>
);

const SplitHud: FC<{ label: string; stats: LocalStats }> = ({ label, stats }) => {
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

const PaneDeadOverlay: FC<{ onRestart: () => void }> = ({ onRestart }) => (
  <div
    style={{
      position: 'absolute',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.58)',
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
