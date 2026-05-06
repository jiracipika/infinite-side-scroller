'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { GameEngine, type CameraMode } from '@/game';
import { useGameStore } from '@/components/GameStore';
import { loadSelectedCharacter } from '@/game/data/characters';
import StartScreen from '@/components/StartScreen';
import PauseMenu from '@/components/PauseMenu';
import GameOverScreen from '@/components/GameOverScreen';
import HUD from '@/components/HUD';
import TouchControls from '@/components/TouchControls';
import SplitScreenMode from '@/components/SplitScreenMode';
import { createMultiplayerRoom, joinMultiplayerRoom, leaveMultiplayerRoom, syncMultiplayerRoom } from '@/game/multiplayer/client';
import type { NetInputCommand, NetPlayerSnapshot, NetRoomState, NetSyncResponse } from '@/game/multiplayer/types';
import { MP_INPUT_BUFFER_SIZE, MP_INTERPOLATION_DELAY_MS } from '@/game/multiplayer/config';

const LAN_SYNC_BASE_MS = 95;
const WAN_SYNC_BASE_MS = 155;
const SYNC_MIN_MS = 70;
const SYNC_MAX_MS = 260;
const SNAPSHOT_KEEPALIVE_MS = 240;
const SNAPSHOT_DELTA_EPS = 0.45;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const quantize = (n: number, precision: number = 1) => {
  const p = 10 ** precision;
  return Math.round(n * p) / p;
};

function compactSnapshot(s: NetPlayerSnapshot): NetPlayerSnapshot {
  return {
    ...s,
    x: quantize(s.x, 1),
    y: quantize(s.y, 1),
    vx: quantize(s.vx, 1),
    vy: quantize(s.vy, 1),
    health: Math.round(s.health),
    maxHealth: Math.round(s.maxHealth),
    width: Math.round(s.width),
    height: Math.round(s.height),
    distance: Math.round(s.distance),
  };
}

function snapshotChanged(a: NetPlayerSnapshot | null, b: NetPlayerSnapshot): boolean {
  if (!a) return true;
  return (
    Math.abs(a.x - b.x) > SNAPSHOT_DELTA_EPS
    || Math.abs(a.y - b.y) > SNAPSHOT_DELTA_EPS
    || Math.abs(a.vx - b.vx) > SNAPSHOT_DELTA_EPS
    || Math.abs(a.vy - b.vy) > SNAPSHOT_DELTA_EPS
    || a.health !== b.health
    || a.onGround !== b.onGround
    || a.facingRight !== b.facingRight
    || a.characterId !== b.characterId
  );
}

interface MultiplayerSession {
  roomId: string;
  playerId: string;
  playerName: string;
  hostId: string;
}

interface NetOverlayStats {
  rttMs: number;
  jitterMs: number;
  inferredLoss: number;
  serverTickRate: number;
  snapshotRate: number;
  clientSnapshotRate: number;
  predictionError: number;
  reconciliationCount: number;
  interpolationDelayMs: number;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const [multiplayerSession, setMultiplayerSession] = useState<MultiplayerSession | null>(null);
  const multiplayerSessionRef = useRef<MultiplayerSession | null>(null);
  const [multiplayerNotice, setMultiplayerNotice] = useState<string | null>(null);
  const [splitScreenSeed, setSplitScreenSeed] = useState<number | null>(null);
  const [prefillRoomCode, setPrefillRoomCode] = useState('');
  const [hostInviteUrl, setHostInviteUrl] = useState<string | null>(null);
  const [showHostInvite, setShowHostInvite] = useState(false);
  const [netOverlay, setNetOverlay] = useState<NetOverlayStats>({
    rttMs: 0,
    jitterMs: 0,
    inferredLoss: 0,
    serverTickRate: 0,
    snapshotRate: 0,
    clientSnapshotRate: 0,
    predictionError: 0,
    reconciliationCount: 0,
    interpolationDelayMs: MP_INTERPOLATION_DELAY_MS,
  });
  const pendingCarryIntentRef = useRef<{ targetId: string | null; dropCarry: boolean } | null>(null);
  const inputSeqRef = useRef(0);
  const pendingInputsRef = useRef<Array<{ seq: number; sentAt: number; input: NetInputCommand }>>([]);
  const lastSentSnapshotRef = useRef<NetPlayerSnapshot | null>(null);
  const lastSentAtRef = useRef(0);
  const lastResponseAtRef = useRef(0);
  const responseCounterRef = useRef(0);
  const responseWindowStartRef = useRef(0);
  const lastRttRef = useRef(0);
  const jitterEwmaRef = useRef(0);
  const sentInputCountRef = useRef(0);
  const droppedInputCountRef = useRef(0);
  const netEmulationRef = useRef({ lagMs: 0, jitterMs: 0, lossChance: 0 });
  const syncInFlightRef = useRef(false);
  const syncSeqRef = useRef(0);
  const appliedSyncSeqRef = useRef(0);
  const inFlightSinceRef = useRef(0);
  const syncRttEwmaMsRef = useRef(140);
  const syncIntervalMsRef = useRef(150);
  const syncAbortRef = useRef<AbortController | null>(null);
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
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const room = (params.get('room') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
    if (room) setPrefillRoomCode(room);

    const lagMs = clamp(Number(params.get('netLag') ?? 0) || 0, 0, 2000);
    const jitterMs = clamp(Number(params.get('netJitter') ?? 0) || 0, 0, 1000);
    const lossChance = clamp((Number(params.get('netLoss') ?? 0) || 0) / 100, 0, 0.95);
    netEmulationRef.current = { lagMs, jitterMs, lossChance };
  }, []);

  const buildInviteUrl = useCallback((roomId: string) => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomId);
    return `${url.origin}${url.pathname}?${url.searchParams.toString()}`;
  }, []);

  const handleCopyInvite = useCallback(async () => {
    if (!hostInviteUrl) return;
    try {
      await navigator.clipboard.writeText(hostInviteUrl);
      setMultiplayerNotice('Invite link copied');
    } catch {
      setMultiplayerNotice('Could not copy link');
    }
  }, [hostInviteUrl]);

  const handleShareInvite = useCallback(async () => {
    if (!hostInviteUrl) return;
    const sharePayload = {
      title: 'Infinite Side Scroller',
      text: 'Join my room on the same Wi-Fi:',
      url: hostInviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }
      await navigator.clipboard.writeText(hostInviteUrl);
      setMultiplayerNotice('Share not available. Link copied instead');
    } catch {
      setMultiplayerNotice('Share canceled');
    }
  }, [hostInviteUrl]);

  const handleTextInvite = useCallback(() => {
    if (!hostInviteUrl || typeof window === 'undefined') return;
    const text = encodeURIComponent(`Join my Infinite Side Scroller room: ${hostInviteUrl}`);
    window.location.href = `sms:&body=${text}`;
  }, [hostInviteUrl]);

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
    game.onNetworkDebug = (debug) => {
      setNetOverlay((prev) => ({
        ...prev,
        predictionError: quantize(debug.predictionError, 1),
        reconciliationCount: debug.reconciliationCount,
        interpolationDelayMs: debug.interpolationDelayMs,
      }));
    };

    game.start();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []); // intentionally empty — engine lives for the page lifetime

  useEffect(() => {
    gameRef.current?.setCameraMode(settings.cameraMode as CameraMode);
  }, [settings.cameraMode]);

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
    setHostInviteUrl(null);
    setShowHostInvite(false);
    syncInFlightRef.current = false;
    syncSeqRef.current = 0;
    appliedSyncSeqRef.current = 0;
    inFlightSinceRef.current = 0;
    syncRttEwmaMsRef.current = 140;
    syncIntervalMsRef.current = 150;
    syncAbortRef.current?.abort();
    syncAbortRef.current = null;
    inputSeqRef.current = 0;
    pendingInputsRef.current = [];
    lastSentSnapshotRef.current = null;
    lastSentAtRef.current = 0;
    lastResponseAtRef.current = 0;
    responseCounterRef.current = 0;
    responseWindowStartRef.current = 0;
    lastRttRef.current = 0;
    jitterEwmaRef.current = 0;
    sentInputCountRef.current = 0;
    droppedInputCountRef.current = 0;
    setNetOverlay({
      rttMs: 0,
      jitterMs: 0,
      inferredLoss: 0,
      serverTickRate: 0,
      snapshotRate: 0,
      clientSnapshotRate: 0,
      predictionError: 0,
      reconciliationCount: 0,
      interpolationDelayMs: MP_INTERPOLATION_DELAY_MS,
    });
    gameRef.current?.setMultiplayerEnabled(false);
    startGame(s);
    gameRef.current?.setSeed(s, charId);
  }, [startGame]);

  const handlePlaySplitScreen = useCallback((seed?: number) => {
    const session = multiplayerSessionRef.current;
    if (session) {
      void leaveMultiplayerRoom(session.roomId, session.playerId).catch(() => {});
      setMultiplayerSession(null);
    }
    setMultiplayerNotice(null);
    setHostInviteUrl(null);
    setShowHostInvite(false);
    gameRef.current?.setMultiplayerEnabled(false);
    gameRef.current?.pause();
    setSplitScreenSeed(seed ?? Math.floor(Math.random() * 999999));
  }, []);

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

  const applyRemotePlayerFromState = useCallback((remote: NetSyncResponse['remote'], serverTime?: number) => {
    const game = gameRef.current;
    if (!game) return;
    if (remote) {
      game.setRemotePlayerState({
        id: remote.id,
        name: remote.name,
        snapshot: remote.snapshot,
        carryTargetId: remote.carryTargetId,
        carriedById: remote.carriedById,
        serverTime,
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
        hostId: result.room.hostId,
      };
      syncInFlightRef.current = false;
      syncSeqRef.current = 0;
      appliedSyncSeqRef.current = 0;
      inputSeqRef.current = 0;
      pendingInputsRef.current = [];
      lastSentSnapshotRef.current = null;
      lastSentAtRef.current = 0;
      lastResponseAtRef.current = 0;
      responseCounterRef.current = 0;
      responseWindowStartRef.current = 0;
      lastRttRef.current = 0;
      jitterEwmaRef.current = 0;
      sentInputCountRef.current = 0;
      droppedInputCountRef.current = 0;
      setMultiplayerSession(session);
      if (params.mode === 'host') {
        const inviteUrl = buildInviteUrl(result.roomId);
        setHostInviteUrl(inviteUrl);
        setShowHostInvite(true);
        const hostOrigin = typeof window !== 'undefined' ? window.location.origin : '';
        const hostHint = hostOrigin ? `Share this site URL + code: ${result.roomId}` : `Room ${result.roomId}`;
        setMultiplayerNotice(`Hosting room ${result.roomId}. ${hostHint}`);
      } else {
        setShowHostInvite(false);
        setHostInviteUrl(null);
        setMultiplayerNotice(`Joined room ${result.roomId}`);
      }
      startGame(result.seed);
      gameRef.current?.setSeed(result.seed, charId);
      gameRef.current?.setMultiplayerEnabled(true, result.playerId, result.room.hostId);
      applyRemotePlayerState(result.room, result.playerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start multiplayer';
      const host = typeof window !== 'undefined' ? window.location.host : '';
      setMultiplayerNotice(`${message}${host ? ` (both devices must use ${host})` : ''}`);
    }
  }, [applyRemotePlayerState, buildInviteUrl, startGame]);

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
    gameRef.current?.setMultiplayerEnabled(!!activeSession, activeSession?.playerId ?? null, activeSession?.hostId ?? null);
    pendingCarryIntentRef.current = null;
    syncInFlightRef.current = false;
    syncSeqRef.current = 0;
    appliedSyncSeqRef.current = 0;
    inFlightSinceRef.current = 0;
    syncRttEwmaMsRef.current = 140;
    syncIntervalMsRef.current = 150;
    syncAbortRef.current?.abort();
    syncAbortRef.current = null;
    inputSeqRef.current = 0;
    pendingInputsRef.current = [];
    lastSentSnapshotRef.current = null;
    lastSentAtRef.current = 0;
    lastResponseAtRef.current = 0;
    responseCounterRef.current = 0;
    responseWindowStartRef.current = 0;
    lastRttRef.current = 0;
    jitterEwmaRef.current = 0;
    sentInputCountRef.current = 0;
    droppedInputCountRef.current = 0;
  }, [seed, startGame]);

  const handleQuit = useCallback(() => {
    const session = multiplayerSessionRef.current;
    if (session) {
      void leaveMultiplayerRoom(session.roomId, session.playerId).catch(() => {});
    }
    setMultiplayerSession(null);
    setMultiplayerNotice(null);
    setHostInviteUrl(null);
    setShowHostInvite(false);
    pendingCarryIntentRef.current = null;
    syncInFlightRef.current = false;
    syncSeqRef.current = 0;
    appliedSyncSeqRef.current = 0;
    inFlightSinceRef.current = 0;
    syncRttEwmaMsRef.current = 140;
    syncIntervalMsRef.current = 150;
    syncAbortRef.current?.abort();
    syncAbortRef.current = null;
    inputSeqRef.current = 0;
    pendingInputsRef.current = [];
    lastSentSnapshotRef.current = null;
    lastSentAtRef.current = 0;
    lastResponseAtRef.current = 0;
    responseCounterRef.current = 0;
    responseWindowStartRef.current = 0;
    lastRttRef.current = 0;
    jitterEwmaRef.current = 0;
    sentInputCountRef.current = 0;
    droppedInputCountRef.current = 0;
    gameRef.current?.setMultiplayerEnabled(false);
    quitToMenu();
    gameRef.current?.setSeed(42, loadSelectedCharacter()); // restore demo world on menu
  }, [quitToMenu]);

  const handleExitSplitScreen = useCallback(() => {
    setSplitScreenSeed(null);
    gameRef.current?.setSeed(42, loadSelectedCharacter());
    gameRef.current?.resume();
  }, []);

  useEffect(() => {
    if (state !== 'playing' || !multiplayerSession || !gameRef.current) return;

    let cancelled = false;
    let timer: number | null = null;
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    const isLikelyLanHost = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host);
    syncIntervalMsRef.current = isLikelyLanHost ? LAN_SYNC_BASE_MS : WAN_SYNC_BASE_MS;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        void tick();
      }, Math.max(40, delay));
    };

    const tick = async () => {
      const game = gameRef.current;
      const session = multiplayerSessionRef.current;
      if (!game || !session || cancelled) return;

      if (syncInFlightRef.current) {
        const inflightAge = performance.now() - inFlightSinceRef.current;
        if (inflightAge > 420 && syncAbortRef.current) {
          syncAbortRef.current.abort();
          syncAbortRef.current = null;
          syncInFlightRef.current = false;
        }
        schedule(24);
        return;
      }

      const nowPerf = performance.now();
      const sinceLastSend = Math.max(16, lastSentAtRef.current ? nowPerf - lastSentAtRef.current : 1000 / 60);
      lastSentAtRef.current = nowPerf;
      const commandSeq = ++inputSeqRef.current;
      const input = game.buildNetInputCommand(commandSeq, sinceLastSend, Date.now());
      const pendingInput = { seq: commandSeq, sentAt: nowPerf, input };

      sentInputCountRef.current += 1;
      const emulated = netEmulationRef.current;
      if (emulated.lossChance > 0 && Math.random() < emulated.lossChance) {
        droppedInputCountRef.current += 1;
        pendingInputsRef.current.push(pendingInput);
        if (pendingInputsRef.current.length > MP_INPUT_BUFFER_SIZE) {
          pendingInputsRef.current.splice(0, pendingInputsRef.current.length - MP_INPUT_BUFFER_SIZE);
        }
        const syntheticLoss = sentInputCountRef.current > 0
          ? (droppedInputCountRef.current / sentInputCountRef.current) * 100
          : 0;
        setNetOverlay((prev) => ({
          ...prev,
          inferredLoss: quantize(syntheticLoss, 1),
        }));
        schedule(Math.max(34, syncIntervalMsRef.current * 0.9));
        return;
      }

      const oneWayJitter = emulated.jitterMs > 0
        ? (Math.random() * 2 - 1) * emulated.jitterMs
        : 0;
      const oneWayDelay = Math.max(0, emulated.lagMs + oneWayJitter);
      if (oneWayDelay > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, oneWayDelay));
      }

      syncInFlightRef.current = true;
      inFlightSinceRef.current = performance.now();
      const seq = ++syncSeqRef.current;
      const startedAt = performance.now();
      const controller = new AbortController();
      syncAbortRef.current = controller;
      const carryIntent = pendingCarryIntentRef.current;
      pendingCarryIntentRef.current = null;
      const localSnapshot = compactSnapshot(game.getLocalPlayerSnapshot());
      const includeSnapshot = (
        snapshotChanged(lastSentSnapshotRef.current, localSnapshot)
        || (performance.now() - lastResponseAtRef.current > SNAPSHOT_KEEPALIVE_MS)
        || !!carryIntent
      );

      pendingInputsRef.current.push(pendingInput);
      if (pendingInputsRef.current.length > MP_INPUT_BUFFER_SIZE) {
        pendingInputsRef.current.splice(0, pendingInputsRef.current.length - MP_INPUT_BUFFER_SIZE);
      }

      try {
        const payload = {
          roomId: session.roomId,
          playerId: session.playerId,
          snapshot: includeSnapshot ? localSnapshot : undefined,
          input,
          enemies: session.playerId === session.hostId ? game.getEnemySnapshots() : undefined,
          carryTargetId: carryIntent?.targetId,
          dropCarry: carryIntent?.dropCarry ?? false,
        };
        const result = await syncMultiplayerRoom(payload, { signal: controller.signal });
        if (cancelled) return;
        if (seq < appliedSyncSeqRef.current) return;
        appliedSyncSeqRef.current = seq;
        applyRemotePlayerFromState(result.sync.remote, result.sync.serverTime);
        game.applyEnemySnapshots(result.sync.enemies);
        if (result.sync.hostId !== session.hostId) {
          multiplayerSessionRef.current = { ...session, hostId: result.sync.hostId };
          setMultiplayerSession((current) => current && current.roomId === session.roomId
            ? { ...current, hostId: result.sync.hostId }
            : current);
          game.setMultiplayerHostId(result.sync.hostId);
        }

        if (includeSnapshot) {
          lastSentSnapshotRef.current = localSnapshot;
        }
        lastResponseAtRef.current = performance.now();

        const ackSeq = Math.max(0, Math.floor(result.sync.ackInputSeq || 0));
        if (ackSeq > 0) {
          pendingInputsRef.current = pendingInputsRef.current.filter((entry) => entry.seq > ackSeq);
        }
        if (pendingInputsRef.current.length > MP_INPUT_BUFFER_SIZE) {
          pendingInputsRef.current.splice(0, pendingInputsRef.current.length - MP_INPUT_BUFFER_SIZE);
        }

        const unacked = pendingInputsRef.current.map((entry) => entry.input);
        game.reconcileLocalAuthoritative(result.sync.local, unacked);

        const elapsed = performance.now() - startedAt;
        const jitterSample = Math.abs(elapsed - lastRttRef.current);
        jitterEwmaRef.current = jitterEwmaRef.current * 0.7 + jitterSample * 0.3;
        lastRttRef.current = elapsed;
        syncRttEwmaMsRef.current = syncRttEwmaMsRef.current * 0.75 + elapsed * 0.25;
        const target = isLikelyLanHost
          ? Math.max(LAN_SYNC_BASE_MS, syncRttEwmaMsRef.current * 0.75)
          : Math.max(WAN_SYNC_BASE_MS, syncRttEwmaMsRef.current * 0.82);
        syncIntervalMsRef.current = clamp(target, SYNC_MIN_MS, SYNC_MAX_MS);

        responseCounterRef.current += 1;
        const now = performance.now();
        if (responseWindowStartRef.current <= 0) responseWindowStartRef.current = now;
        const winElapsed = now - responseWindowStartRef.current;
        if (winElapsed >= 1000) {
          const rate = (responseCounterRef.current * 1000) / Math.max(1, winElapsed);
          responseCounterRef.current = 0;
          responseWindowStartRef.current = now;
          const syntheticLoss = sentInputCountRef.current > 0
            ? (droppedInputCountRef.current / sentInputCountRef.current) * 100
            : 0;
          setNetOverlay((prev) => ({
            ...prev,
            rttMs: quantize(syncRttEwmaMsRef.current, 1),
            jitterMs: quantize(jitterEwmaRef.current, 1),
            inferredLoss: quantize(Math.max(syntheticLoss, result.sync.inferredPacketLoss), 1),
            serverTickRate: result.sync.serverTickRate,
            snapshotRate: result.sync.snapshotRate,
            clientSnapshotRate: quantize(rate, 1),
          }));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!cancelled) {
          const msg = error instanceof Error ? error.message : 'Multiplayer sync failed';
          setMultiplayerNotice(msg);
        }
      } finally {
        if (syncAbortRef.current === controller) syncAbortRef.current = null;
        syncInFlightRef.current = false;
        const elapsed = performance.now() - startedAt;
        const nextDelay = Math.max(32, syncIntervalMsRef.current - elapsed);
        schedule(nextDelay);
      }
    };

    schedule(10);

    return () => {
      cancelled = true;
      syncInFlightRef.current = false;
      syncAbortRef.current?.abort();
      syncAbortRef.current = null;
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [applyRemotePlayerFromState, multiplayerSession, state]);

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
          {state === 'menu' && !splitScreenSeed && (
            <StartScreen
              onPlay={handlePlay}
              onPlayMultiplayer={handlePlayMultiplayer}
              onPlaySplitScreen={handlePlaySplitScreen}
              initialRoomCode={prefillRoomCode}
            />
          )}
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
      {state === 'playing' && multiplayerSession && (
        <div
          className="absolute left-3 z-20 pointer-events-none"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 54px)',
            width: 'min(56vw, 220px)',
            background: 'rgba(2,6,23,0.6)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 10,
            padding: '6px 8px',
            color: '#cbd5e1',
            fontSize: 10,
            lineHeight: 1.25,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >
          <div>RTT {netOverlay.rttMs}ms</div>
          <div>Jitter {netOverlay.jitterMs}ms</div>
          <div>Loss {netOverlay.inferredLoss}%</div>
          <div>Srv Tick {netOverlay.serverTickRate}hz</div>
          <div>Srv Snap {netOverlay.snapshotRate}hz</div>
          <div>Cli Sync {netOverlay.clientSnapshotRate}hz</div>
          <div>FPS {Math.round(stats.fps || 0)}</div>
          <div>Pred Err {netOverlay.predictionError}px</div>
          <div>Reconciles {netOverlay.reconciliationCount}</div>
          <div>Interp {netOverlay.interpolationDelayMs}ms</div>
        </div>
      )}
      {state === 'playing' && showHostInvite && hostInviteUrl && (
        <div
          className="absolute left-1/2 z-30"
          style={{
            bottom: 'max(92px, calc(env(safe-area-inset-bottom, 0px) + 92px))',
            transform: 'translateX(-50%)',
            width: 'min(92vw, 340px)',
            background: 'rgba(2,6,23,0.88)',
            border: '1px solid rgba(148,163,184,0.25)',
            borderRadius: 14,
            padding: 10,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 700, letterSpacing: '0.04em' }}>LAN Invite</span>
            <button
              type="button"
              onClick={() => setShowHostInvite(false)}
              className="ios-btn-gray"
              style={{ width: 26, height: 26, borderRadius: 999, fontSize: 12, padding: 0 }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=0&data=${encodeURIComponent(hostInviteUrl)}`}
              alt="Room QR code"
              width={92}
              height={92}
              style={{ borderRadius: 8, border: '1px solid rgba(148,163,184,0.28)', background: '#fff' }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: '#cbd5e1', fontSize: 11, marginBottom: 6 }}>
                Code: <span style={{ fontWeight: 800, letterSpacing: '0.08em' }}>{multiplayerSession?.roomId}</span>
              </div>
              <div
                style={{
                  color: '#94a3b8',
                  fontSize: 10,
                  lineHeight: 1.35,
                  maxHeight: 42,
                  overflow: 'hidden',
                  wordBreak: 'break-all',
                }}
              >
                {hostInviteUrl}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: 10 }}>
            <button type="button" className="ios-btn-secondary" style={{ height: 34, fontSize: 12 }} onClick={() => { void handleCopyInvite(); }}>
              Copy
            </button>
            <button type="button" className="ios-btn-secondary" style={{ height: 34, fontSize: 12 }} onClick={() => { void handleShareInvite(); }}>
              Share
            </button>
            <button type="button" className="ios-btn-secondary" style={{ height: 34, fontSize: 12 }} onClick={handleTextInvite}>
              Text
            </button>
          </div>
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
      {state === 'playing' && !splitScreenSeed && (
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

      {splitScreenSeed !== null && (
        <SplitScreenMode seed={splitScreenSeed} onExit={handleExitSplitScreen} />
      )}
    </main>
  );
}
