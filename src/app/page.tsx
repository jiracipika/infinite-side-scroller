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
import LevelSelectScreen from '@/components/LevelSelectScreen';
import LevelCompleteScreen from '@/components/LevelCompleteScreen';
import type { LevelConfig } from '@/game/data/levels';
import { ALL_LEVELS } from '@/game/data/levels';
import { createMultiplayerRoom, joinMultiplayerRoom, leaveMultiplayerRoom, syncMultiplayerRoom, postRTCOffer, postRTCAnswer, getRTCSignal, clearRTCSignal, postRTCCandidates } from '@/game/multiplayer/client';
import { RTCTransport, isRTCAvailable, type RTCSyncMessage } from '@/game/multiplayer/rtc';
import type { NetInputCommand, NetPlayerSnapshot, NetRoomState, NetSyncResponse } from '@/game/multiplayer/types';
import { MP_INPUT_BUFFER_SIZE, MP_INTERPOLATION_DELAY_MS, MP_P2P_INTERPOLATION_DELAY_MS, MP_P2P_TICK_MS, MP_TICK_MS, MP_HTTP_TICK_DIVISOR } from '@/game/multiplayer/config';
import {
  addRunRewards,
  buildProgressionBonuses,
  clearPendingContinueSlot,
  clearSlotCheckpoint,
  getTodayIsoDay,
  hasPlayedDailyChallenge,
  loadActiveSaveSlotId,
  loadSaveSlots,
  markDailyChallengePlayed,
  saveSlotCheckpoint,
  takePendingContinueSlot,
  type SaveSlotId,
} from "@/lib/progression";
import {
  issueRunToken,
  submitRunScore,
  type RunMode,
} from "@/lib/online-leaderboard";
import {
  loadLeaderboardAvatarId,
  loadLeaderboardName,
} from "@/lib/leaderboard";
import { loadGhostRun, upsertGhostRun } from "@/lib/ghost-runs";

const SNAPSHOT_KEEPALIVE_MS = 240;
const SNAPSHOT_DELTA_EPS = 0.45;

const clamp = (v: number, min: number, max: number) =>
  Math.max(min, Math.min(max, v));
const quantize = (n: number, precision: number = 1) => {
  const p = 10 ** precision;
  return Math.round(n * p) / p;
};

function sampleReplayPath(
  points: Array<{ distance: number; x: number; y: number }>,
): Array<{ distance: number; x: number; y: number }> {
  if (!Array.isArray(points) || points.length === 0) return [];
  const sampled: Array<{ distance: number; x: number; y: number }> = [];
  let previousDistance = -1;
  for (let i = 0; i < points.length; i += 2) {
    const point = points[i];
    if (!point) continue;
    if (
      !Number.isFinite(point.distance) ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    )
      continue;
    const distance = Math.max(0, Math.floor(point.distance));
    if (distance <= previousDistance) continue;
    sampled.push({
      distance,
      x: quantize(point.x, 1),
      y: quantize(point.y, 1),
    });
    previousDistance = distance;
    if (sampled.length >= 1600) break;
  }
  return sampled;
}

function compactSnapshot(s: NetPlayerSnapshot): NetPlayerSnapshot {
  return {
    ...s,
    x: quantize(s.x, 1),
    y: quantize(s.y, 1),
    vx: quantize(s.vx, 1),
    vy: quantize(s.vy, 1),
    health: Math.round(s.health),
    maxHealth: Math.round(s.maxHealth),
    alive: s.alive,
    width: Math.round(s.width),
    height: Math.round(s.height),
    distance: Math.round(s.distance),
  };
}

function snapshotChanged(
  a: NetPlayerSnapshot | null,
  b: NetPlayerSnapshot,
): boolean {
  if (!a) return true;
  return (
    Math.abs(a.x - b.x) > SNAPSHOT_DELTA_EPS ||
    Math.abs(a.y - b.y) > SNAPSHOT_DELTA_EPS ||
    Math.abs(a.vx - b.vx) > SNAPSHOT_DELTA_EPS ||
    Math.abs(a.vy - b.vy) > SNAPSHOT_DELTA_EPS ||
    a.health !== b.health ||
    a.alive !== b.alive ||
    a.onGround !== b.onGround ||
    a.facingRight !== b.facingRight ||
    a.characterId !== b.characterId
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
  enemyVersion: number;
  encounterChunk: number;
  authoritativeDistance: number;
}

function getDailySeed(dayIso: string): number {
  let hash = 2166136261;
  for (let i = 0; i < dayIso.length; i++) {
    hash ^= dayIso.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash % 900000) + 100000;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const [multiplayerSession, setMultiplayerSession] =
    useState<MultiplayerSession | null>(null);
  const multiplayerSessionRef = useRef<MultiplayerSession | null>(null);
  const [multiplayerNotice, setMultiplayerNotice] = useState<string | null>(
    null,
  );
  const multiplayerNoticeRef = useRef<string | null>(null);
  const [splitScreenSeed, setSplitScreenSeed] = useState<number | null>(null);
  const [prefillRoomCode, setPrefillRoomCode] = useState("");
  const [hostInviteUrl, setHostInviteUrl] = useState<string | null>(null);
  const [showHostInvite, setShowHostInvite] = useState(false);
  const [lanInviteOrigin, setLanInviteOrigin] = useState<string | null>(null);
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
    enemyVersion: 0,
    encounterChunk: 0,
    authoritativeDistance: 0,
  });
  const pendingCarryIntentRef = useRef<{
    targetId: string | null;
    dropCarry: boolean;
  } | null>(null);
  const inputSeqRef = useRef(0);
  const pendingInputsRef = useRef<
    Array<{ seq: number; sentAt: number; input: NetInputCommand }>
  >([]);
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

  // WebRTC P2P state — when connected, sync flows device-to-device
  const rtcRef = useRef<RTCTransport | null>(null);
  const rtcConnectedRef = useRef(false);
  const remoteRTCDataRef = useRef<RTCSyncMessage | null>(null);
  const remoteRTCSeqRef = useRef(0);
  const rtcReconnectRef = useRef(0); // reconnect attempt counter
  const remotePlayerInfoRef = useRef<{ id: string; name: string } | null>(null);
  const [rtcStatus, setRtcStatus] = useState<
    "off" | "connecting" | "connected" | "failed"
  >("off");

  // Level mode state
  const [currentLevel, setCurrentLevel] = useState<LevelConfig | null>(null);
  const [levelResult, setLevelResult] = useState<{
    score: number;
    coins: number;
    distance: number;
    timeMs: number;
    enemiesDefeated: number;
  } | null>(null);
  const currentLevelRef = useRef<LevelConfig | null>(null);
  const syncInFlightRef = useRef(false);
  const syncSeqRef = useRef(0);
  const appliedSyncSeqRef = useRef(0);
  const inFlightSinceRef = useRef(0);
  const syncRttEwmaMsRef = useRef(140);
  const syncIntervalMsRef = useRef(MP_TICK_MS);
  const syncAbortRef = useRef<AbortController | null>(null);
  const activeSaveSlotRef = useRef<SaveSlotId>("slot1");
  const runModeRef = useRef<RunMode>("standard");
  const runTokenRef = useRef<string | null>(null);
  const runSeedRef = useRef<number>(42);
  const {
    state,
    stats,
    settings,
    seed,
    startGame,
    pauseGame,
    resumeGame,
    gameOver,
    quitToMenu,
    updateStats,
    goToLevelSelect,
    goToLevelComplete,
  } = useGameStore();

  // Boot the engine once; keep callbacks current via refs to avoid restarts
  const onStatsRef = useRef(updateStats);
  const onGameOverRef = useRef(gameOver);
  const onLevelCompleteRef = useRef(goToLevelComplete);
  onStatsRef.current = updateStats;
  onGameOverRef.current = gameOver;
  onLevelCompleteRef.current = goToLevelComplete;
  multiplayerSessionRef.current = multiplayerSession;
  multiplayerNoticeRef.current = multiplayerNotice;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const room = (params.get("room") ?? "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8);
    if (room) setPrefillRoomCode(room);

    const lagMs = clamp(Number(params.get("netLag") ?? 0) || 0, 0, 2000);
    const jitterMs = clamp(Number(params.get("netJitter") ?? 0) || 0, 0, 1000);
    const lossChance = clamp(
      (Number(params.get("netLoss") ?? 0) || 0) / 100,
      0,
      0.95,
    );
    netEmulationRef.current = { lagMs, jitterMs, lossChance };
    activeSaveSlotRef.current = loadActiveSaveSlotId();

    const isLoopbackHost = /^(localhost|127\.|\[?::1\]?$)/.test(
      window.location.hostname,
    );
    if (isLoopbackHost) {
      fetch("/api/network/origin", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then(
          (
            data: { preferredOrigin?: string; lanOrigins?: string[] } | null,
          ) => {
            const preferred = data?.preferredOrigin || data?.lanOrigins?.[0];
            if (preferred) setLanInviteOrigin(preferred);
          },
        )
        .catch(() => {});
    }
  }, []);

  const applyProgressionFromSlot = useCallback((slotId?: SaveSlotId) => {
    const game = gameRef.current;
    if (!game) return;
    const resolvedId = slotId ?? loadActiveSaveSlotId();
    activeSaveSlotRef.current = resolvedId;
    const slot = loadSaveSlots().find((s) => s.id === resolvedId);
    const bonuses = buildProgressionBonuses(slot?.unlockedUpgradeIds ?? []);
    game.setProgressionBonuses(bonuses);
  }, []);

  const buildInviteUrl = useCallback(
    (roomId: string) => {
      if (typeof window === "undefined") return "";
      const current = new URL(window.location.href);
      const inviteOrigin = /^(localhost|127\.|\[?::1\]?$)/.test(
        current.hostname,
      )
        ? (lanInviteOrigin ?? current.origin)
        : current.origin;
      const url = new URL(`${inviteOrigin}${current.pathname}`);
      current.searchParams.forEach((value, key) => {
        if (key !== "room") url.searchParams.set(key, value);
      });
      url.searchParams.set("room", roomId);
      return url.toString();
    },
    [lanInviteOrigin],
  );

  const handleCopyInvite = useCallback(async () => {
    if (!hostInviteUrl) return;
    try {
      await navigator.clipboard.writeText(hostInviteUrl);
      setMultiplayerNotice("Invite link copied");
    } catch {
      setMultiplayerNotice("Could not copy link");
    }
  }, [hostInviteUrl]);

  const handleShareInvite = useCallback(async () => {
    if (!hostInviteUrl) return;
    const sharePayload = {
      title: "Dashverse",
      text: "Join my room on the same Wi-Fi:",
      url: hostInviteUrl,
    };
    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }
      await navigator.clipboard.writeText(hostInviteUrl);
      setMultiplayerNotice("Share not available. Link copied instead");
    } catch {
      setMultiplayerNotice("Share canceled");
    }
  }, [hostInviteUrl]);

  const handleTextInvite = useCallback(() => {
    if (!hostInviteUrl || typeof window === "undefined") return;
    const text = encodeURIComponent(`Join my Dashverse room: ${hostInviteUrl}`);
    window.location.href = `sms:&body=${text}`;
  }, [hostInviteUrl]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const charId = loadSelectedCharacter();
    const game = new GameEngine(canvasRef.current, 42, charId);
    gameRef.current = game;

    game.onStatsUpdate = (s) => onStatsRef.current(s);
    game.onGameOver = () => onGameOverRef.current();
    game.onLevelComplete = (result) => {
      // Use a ref to avoid stale closure
      const level = currentLevelRef.current;
      if (level) {
        // Directly update state since this is called from the game loop
        setLevelResult(result);
        onLevelCompleteRef.current();
        // Update localStorage progress
        try {
          const stored = localStorage.getItem("iss-level-progress");
          const progress = stored ? JSON.parse(stored) : {};
          if (!progress[level.id])
            progress[level.id] = { stars: 0, bestScore: 0, unlocked: true };
          const p = progress[level.id];
          if (result.score >= level.starThresholds.three) p.stars = 3;
          else if (result.score >= level.starThresholds.two)
            p.stars = Math.max(p.stars, 2);
          else if (result.score >= level.starThresholds.one)
            p.stars = Math.max(p.stars, 1);
          p.bestScore = Math.max(p.bestScore, result.score);
          const idx = ALL_LEVELS.findIndex((l) => l.id === level.id);
          if (idx >= 0 && idx < ALL_LEVELS.length - 1) {
            const next = ALL_LEVELS[idx + 1];
            if (next && next.mode === level.mode) {
              if (!progress[next.id])
                progress[next.id] = { stars: 0, bestScore: 0, unlocked: false };
              progress[next.id].unlocked = true;
            }
          }
          localStorage.setItem("iss-level-progress", JSON.stringify(progress));
        } catch {}
      }
    };
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
    if (state === "paused") gameRef.current.pause();
    else if (state === "playing") gameRef.current.resume();
  }, [state]);

  // Escape key toggles pause
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Escape") return;
      if (state === "playing") {
        pauseGame();
        gameRef.current?.pause();
      } else if (state === "paused") {
        resumeGame();
        gameRef.current?.resume();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, pauseGame, resumeGame]);

  const handlePlay = useCallback(
    (seed?: number) => {
      const s = seed ?? Math.floor(Math.random() * 999999);
      const charId = loadSelectedCharacter();
      const pendingContinueSlot = takePendingContinueSlot();
      const targetSlotId = pendingContinueSlot ?? loadActiveSaveSlotId();
      applyProgressionFromSlot(targetSlotId);
      runModeRef.current = "standard";
      runSeedRef.current = s;
      runTokenRef.current = null;
      setMultiplayerSession(null);
      setMultiplayerNotice(null);
      setHostInviteUrl(null);
      setShowHostInvite(false);
      syncInFlightRef.current = false;
      syncSeqRef.current = 0;
      appliedSyncSeqRef.current = 0;
      inFlightSinceRef.current = 0;
      syncRttEwmaMsRef.current = 140;
      syncIntervalMsRef.current = MP_TICK_MS;
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
        enemyVersion: 0,
        encounterChunk: 0,
        authoritativeDistance: 0,
      });
      gameRef.current?.setMultiplayerEnabled(false);
      startGame(s);
      gameRef.current?.setSeed(s, charId);
      // Clear level state when playing endless/standard mode.
      setCurrentLevel(null);
      currentLevelRef.current = null;
      const slotGhost = loadGhostRun(targetSlotId);
      gameRef.current?.setGhostPath(slotGhost?.points ?? []);
      void issueRunToken({
        playerName: loadLeaderboardName(),
        avatarId: loadLeaderboardAvatarId(),
        mode: "standard",
        seed: s,
      })
        .then((issued) => {
          runTokenRef.current = issued.token;
          runSeedRef.current = issued.seed;
        })
        .catch(() => {
          runTokenRef.current = null;
        });
      const slot = loadSaveSlots().find((entry) => entry.id === targetSlotId);
      if (pendingContinueSlot && slot?.checkpoint) {
        gameRef.current?.restoreRunCheckpoint(slot.checkpoint);
      } else {
        clearPendingContinueSlot();
        clearSlotCheckpoint(targetSlotId);
      }
    },
    [applyProgressionFromSlot, startGame],
  );

  const handlePlayDailyChallenge = useCallback(() => {
    const slotId = loadActiveSaveSlotId();
    const day = getTodayIsoDay();
    if (hasPlayedDailyChallenge(slotId, day)) {
      setMultiplayerNotice(
        "Daily challenge already used for this save slot today",
      );
      return;
    }
    const seed = getDailySeed(day);
    const charId = loadSelectedCharacter();
    applyProgressionFromSlot(slotId);
    runModeRef.current = "daily";
    runSeedRef.current = seed;
    runTokenRef.current = null;
    startGame(seed);
    gameRef.current?.setSeed(seed, charId);
    setCurrentLevel(null);
    currentLevelRef.current = null;
    const slotGhost = loadGhostRun(slotId);
    gameRef.current?.setGhostPath(slotGhost?.points ?? []);
    void issueRunToken({
      playerName: loadLeaderboardName(),
      avatarId: loadLeaderboardAvatarId(),
      mode: "daily",
      seed,
    })
      .then((issued) => {
        runTokenRef.current = issued.token;
        runSeedRef.current = issued.seed;
      })
      .catch(() => {
        runTokenRef.current = null;
      });
    setMultiplayerNotice(`Daily challenge: ${day}`);
  }, [applyProgressionFromSlot, startGame]);

  const handlePlayOnlineGhostRace = useCallback(
    (payload: {
      entry: { name: string; seed: number; badge: string };
      replayPath: Array<{ distance: number; x: number; y: number }>;
    }) => {
      const s = payload.entry.seed;
      const charId = loadSelectedCharacter();
      const targetSlotId = loadActiveSaveSlotId();
      applyProgressionFromSlot(targetSlotId);
      runModeRef.current = "standard";
      runSeedRef.current = s;
      runTokenRef.current = null;
      setMultiplayerSession(null);
      setMultiplayerNotice(
        `Ghost race vs ${payload.entry.name} (${payload.entry.badge})`,
      );
      setHostInviteUrl(null);
      setShowHostInvite(false);
      syncInFlightRef.current = false;
      syncSeqRef.current = 0;
      appliedSyncSeqRef.current = 0;
      inFlightSinceRef.current = 0;
      syncRttEwmaMsRef.current = 140;
      syncIntervalMsRef.current = MP_TICK_MS;
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
        enemyVersion: 0,
        encounterChunk: 0,
        authoritativeDistance: 0,
      });
      gameRef.current?.setMultiplayerEnabled(false);
      startGame(s);
      gameRef.current?.setSeed(s, charId);
      gameRef.current?.setGhostPath(payload.replayPath);
      setCurrentLevel(null);
      currentLevelRef.current = null;
      clearPendingContinueSlot();
      clearSlotCheckpoint(targetSlotId);
      void issueRunToken({
        playerName: loadLeaderboardName(),
        avatarId: loadLeaderboardAvatarId(),
        mode: "standard",
        seed: s,
      })
        .then((issued) => {
          runTokenRef.current = issued.token;
          runSeedRef.current = issued.seed;
        })
        .catch(() => {
          runTokenRef.current = null;
        });
    },
    [applyProgressionFromSlot, startGame],
  );

  // ── Level mode handlers ──
  const handleStartLevel = useCallback((level: LevelConfig) => {
    setMultiplayerSession(null);
    setCurrentLevel(level);
    currentLevelRef.current = level;
    setLevelResult(null);
    gameRef.current?.setMultiplayerEnabled(false);
    startGame(level.seed);
    gameRef.current?.setLevel(level);
  }, [startGame]);

  const handleNextLevel = useCallback(() => {
    const level = currentLevelRef.current;
    if (!level) return;
    const idx = ALL_LEVELS.findIndex((l) => l.id === level.id);
    if (idx >= 0 && idx < ALL_LEVELS.length - 1) {
      const next = ALL_LEVELS[idx + 1];
      if (next && next.mode === level.mode) {
        handleStartLevel(next);
        return;
      }
    }
    // No next level, go back to level select
    goToLevelSelect();
  }, [handleStartLevel, goToLevelSelect]);

  const handlePlaySplitScreen = useCallback((seed?: number) => {
    const session = multiplayerSessionRef.current;
    if (session) {
      void leaveMultiplayerRoom(session.roomId, session.playerId).catch(
        () => {},
      );
      setMultiplayerSession(null);
    }
    setMultiplayerNotice(null);
    setHostInviteUrl(null);
    setShowHostInvite(false);
    gameRef.current?.setMultiplayerEnabled(false);
    gameRef.current?.pause();
    setSplitScreenSeed(seed ?? Math.floor(Math.random() * 999999));
  }, []);

  const applyRemotePlayerState = useCallback(
    (room: NetRoomState, localId: string) => {
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
    },
    [],
  );

  const applyRemotePlayerFromState = useCallback(
    (remote: NetSyncResponse["remote"], serverTime?: number) => {
      const game = gameRef.current;
      if (!game) return;
      if (remote) {
        // Track remote identity for WebRTC P2P path
        remotePlayerInfoRef.current = { id: remote.id, name: remote.name };
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
    },
    [],
  );

  const handlePlayMultiplayer = useCallback(
    async (params: {
      mode: "host" | "join";
      roomId?: string;
      playerName: string;
      seed?: number;
    }) => {
      const charId = loadSelectedCharacter();
      applyProgressionFromSlot(loadActiveSaveSlotId());
      runModeRef.current = "standard";
      runTokenRef.current = null;
      try {
        const result =
          params.mode === "host"
            ? await createMultiplayerRoom({
                playerName: params.playerName,
                characterId: charId,
                seed: params.seed,
              })
            : await joinMultiplayerRoom({
                roomId: params.roomId ?? "",
                playerName: params.playerName,
                characterId: charId,
              });

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
        remotePlayerInfoRef.current = null;
        remoteRTCDataRef.current = null;
        setMultiplayerSession(session);
        if (params.mode === "host") {
          let inviteUrl = buildInviteUrl(result.roomId);
          if (
            typeof window !== "undefined" &&
            !lanInviteOrigin &&
            /^(localhost|127\.|\[?::1\]?$)/.test(window.location.hostname)
          ) {
            const lan = (await fetch("/api/network/origin", {
              cache: "no-store",
            })
              .then((res) => (res.ok ? res.json() : null))
              .catch(() => null)) as {
              preferredOrigin?: string;
              lanOrigins?: string[];
            } | null;
            const preferred = lan?.preferredOrigin || lan?.lanOrigins?.[0];
            if (preferred) {
              setLanInviteOrigin(preferred);
              const current = new URL(window.location.href);
              const url = new URL(`${preferred}${current.pathname}`);
              current.searchParams.forEach((value, key) => {
                if (key !== "room") url.searchParams.set(key, value);
              });
              url.searchParams.set("room", result.roomId);
              inviteUrl = url.toString();
            }
          }
          setHostInviteUrl(inviteUrl);
          setShowHostInvite(true);
          const hostOrigin =
            typeof window !== "undefined" ? new URL(inviteUrl).origin : "";
          const hostHint = hostOrigin
            ? `Share this site URL + code: ${result.roomId}`
            : `Room ${result.roomId}`;
          setMultiplayerNotice(
            result.storeMode === "ephemeral"
              ? `Room ${result.roomId} is ready, but this deployment needs Redis/KV for reliable cross-device joining.`
              : `Hosting room ${result.roomId}. ${hostHint}`,
          );
        } else {
          setShowHostInvite(false);
          setHostInviteUrl(null);
          setMultiplayerNotice(`Joined room ${result.roomId}`);
        }
        startGame(result.seed);
        gameRef.current?.setSeed(result.seed, charId);
        gameRef.current?.setMultiplayerEnabled(
          true,
          result.playerId,
          result.room.hostId,
        );
        applyRemotePlayerState(result.room, result.playerId);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to start multiplayer";
        const host = typeof window !== "undefined" ? window.location.host : "";
        setMultiplayerNotice(
          `${message}${host ? ` (both devices must use ${host})` : ""}`,
        );
      }
    },
    [
      applyProgressionFromSlot,
      applyRemotePlayerState,
      buildInviteUrl,
      lanInviteOrigin,
      startGame,
    ],
  );

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
    runSeedRef.current = nextSeed;
    if (!activeSession) {
      runModeRef.current = "standard";
      runTokenRef.current = null;
      void issueRunToken({
        playerName: loadLeaderboardName(),
        avatarId: loadLeaderboardAvatarId(),
        mode: "standard",
        seed: nextSeed,
      })
        .then((issued) => {
          runTokenRef.current = issued.token;
          runSeedRef.current = issued.seed;
        })
        .catch(() => {
          runTokenRef.current = null;
        });
    }
    applyProgressionFromSlot(loadActiveSaveSlotId());
    gameRef.current?.setSeed(nextSeed, loadSelectedCharacter());
    const slotGhost = loadGhostRun(loadActiveSaveSlotId());
    gameRef.current?.setGhostPath(slotGhost?.points ?? []);
    gameRef.current?.setMultiplayerEnabled(
      !!activeSession,
      activeSession?.playerId ?? null,
      activeSession?.hostId ?? null,
    );
    pendingCarryIntentRef.current = null;
    syncInFlightRef.current = false;
    syncSeqRef.current = 0;
    appliedSyncSeqRef.current = 0;
    inFlightSinceRef.current = 0;
    syncRttEwmaMsRef.current = 140;
    syncIntervalMsRef.current = MP_TICK_MS;
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
    clearPendingContinueSlot();
    clearSlotCheckpoint(loadActiveSaveSlotId());
  }, [applyProgressionFromSlot, seed, startGame]);

  const handleQuit = useCallback(() => {
    const session = multiplayerSessionRef.current;
    if (session) {
      void leaveMultiplayerRoom(session.roomId, session.playerId).catch(
        () => {},
      );
    }
    // Close WebRTC connection
    rtcRef.current?.close();
    rtcRef.current = null;
    rtcConnectedRef.current = false;
    rtcReconnectRef.current = 0;
    setRtcStatus("off");
    remoteRTCDataRef.current = null;
    setMultiplayerSession(null);
    setMultiplayerNotice(null);
    setHostInviteUrl(null);
    setShowHostInvite(false);
    runTokenRef.current = null;
    runModeRef.current = "standard";
    pendingCarryIntentRef.current = null;
    syncInFlightRef.current = false;
    syncSeqRef.current = 0;
    appliedSyncSeqRef.current = 0;
    inFlightSinceRef.current = 0;
    syncRttEwmaMsRef.current = 140;
    syncIntervalMsRef.current = MP_TICK_MS;
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
    if (!session && state !== "gameover") {
      const slotId = loadActiveSaveSlotId();
      const checkpoint = gameRef.current?.exportRunCheckpoint();
      if (checkpoint) {
        saveSlotCheckpoint(slotId, checkpoint);
      }
    }
    quitToMenu();
    gameRef.current?.setSeed(42, loadSelectedCharacter()); // restore demo world on menu
  }, [quitToMenu, state]);

  const handleExitSplitScreen = useCallback(() => {
    setSplitScreenSeed(null);
    gameRef.current?.setSeed(42, loadSelectedCharacter());
    gameRef.current?.resume();
  }, []);

  useEffect(() => {
    if (state !== "playing" || !multiplayerSession || !gameRef.current) return;

    let cancelled = false;
    let timer: number | null = null;
    let httpTickCounter = 0; // increments every tick; HTTP fires every Nth
    // Tick-based fallback remains 25 Hz; WebRTC LAN sync runs at 60 Hz below.
    syncIntervalMsRef.current = MP_TICK_MS;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = window.setTimeout(
        () => {
          void tick();
        },
        Math.max(0, delay),
      );
    };

    const tick = async () => {
      const game = gameRef.current;
      const session = multiplayerSessionRef.current;
      if (!game || !session || cancelled) return;

      // ── WebRTC P2P path — direct device-to-device, skips HTTP entirely ──
      // On the same Wi-Fi this gives ~1–5 ms RTT vs 40–150 ms for HTTP polling.
      if (rtcRef.current?.isOpen) {
        const nowPerf = performance.now();
        const sinceLastSend = Math.max(
          16,
          lastSentAtRef.current ? nowPerf - lastSentAtRef.current : 1000 / 60,
        );
        lastSentAtRef.current = nowPerf;
        const commandSeq = ++inputSeqRef.current;
        const input = game.buildNetInputCommand(
          commandSeq,
          Date.now(),
          sinceLastSend,
        );
        const carryIntent = pendingCarryIntentRef.current;
        pendingCarryIntentRef.current = null;
        const localSnapshot = compactSnapshot(game.getLocalPlayerSnapshot());
        const localKills = game.drainRecentEnemyDefeatIds();

        const rtcBacklog = rtcRef.current.bufferedAmount;
        const sentRtcSync = rtcRef.current.send({
          type: 'sync',
          ts: nowPerf,
          seq: commandSeq,
          snapshot: localSnapshot,
          input,
          enemies: session.playerId === session.hostId && rtcBacklog < 48_000 ? game.getEnemySnapshots() : undefined,
          carryTargetId: carryIntent?.targetId,
          dropCarry: carryIntent?.dropCarry ?? false,
          killedEnemyIds: localKills.length > 0 ? localKills : undefined,
        });

        if (!sentRtcSync && performance.now() - lastResponseAtRef.current > 1800) {
          setMultiplayerNotice('Wi‑Fi link is congested; smoothing multiplayer...');
        } else if (sentRtcSync) {
          lastResponseAtRef.current = performance.now();
        }

        // Apply latest remote data received via data channel
        const remoteData = remoteRTCDataRef.current;
        const remoteAgeMs = remoteData?.receivedAt ? performance.now() - remoteData.receivedAt : Number.POSITIVE_INFINITY;
        if (remoteData?.snapshot && remoteAgeMs < 1500) {
          const ri = remotePlayerInfoRef.current;
          game.setRemotePlayerState({
            id: ri?.id ?? "remote",
            name: ri?.name ?? "Player",
            snapshot: remoteData.snapshot,
            carryTargetId: remoteData.carryTargetId ?? null,
            carriedById: null,
          });
        }
        if (remoteData?.enemies && remoteAgeMs < 1500) {
          game.applyEnemySnapshots(remoteData.enemies);
        }
        // Apply cross-player enemy kills
        if (remoteData?.killedEnemyIds?.length && remoteAgeMs < 1500) {
          game.killEnemiesById(remoteData.killedEnemyIds);
        }

        setNetOverlay((prev) => ({
          ...prev,
          rttMs: quantize(rtcRef.current?.rtt ?? 0, 1),
          clientSnapshotRate: quantize(1000 / Math.max(MP_P2P_TICK_MS, sinceLastSend), 1),
        }));

        schedule(MP_P2P_TICK_MS); // 60 Hz direct P2P sync for near-instant LAN movement
        return;
      }

      // ── HTTP polling path — throttled to every Nth tick (~12 Hz) ──
      // P2P above already returned; this only runs when WebRTC is unavailable.
      httpTickCounter += 1;
      if (httpTickCounter % MP_HTTP_TICK_DIVISOR !== 0) {
        schedule(MP_TICK_MS);
        return;
      }

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
      const sinceLastSend = Math.max(
        16,
        lastSentAtRef.current ? nowPerf - lastSentAtRef.current : 1000 / 60,
      );
      lastSentAtRef.current = nowPerf;
      const commandSeq = ++inputSeqRef.current;
      const input = game.buildNetInputCommand(
        commandSeq,
        Date.now(),
        sinceLastSend,
      );
      const pendingInput = { seq: commandSeq, sentAt: nowPerf, input };

      sentInputCountRef.current += 1;
      const emulated = netEmulationRef.current;
      if (emulated.lossChance > 0 && Math.random() < emulated.lossChance) {
        droppedInputCountRef.current += 1;
        pendingInputsRef.current.push(pendingInput);
        if (pendingInputsRef.current.length > MP_INPUT_BUFFER_SIZE) {
          pendingInputsRef.current.splice(
            0,
            pendingInputsRef.current.length - MP_INPUT_BUFFER_SIZE,
          );
        }
        const syntheticLoss =
          sentInputCountRef.current > 0
            ? (droppedInputCountRef.current / sentInputCountRef.current) * 100
            : 0;
        setNetOverlay((prev) => ({
          ...prev,
          inferredLoss: quantize(syntheticLoss, 1),
        }));
        schedule(MP_TICK_MS);
        return;
      }

      const oneWayJitter =
        emulated.jitterMs > 0 ? (Math.random() * 2 - 1) * emulated.jitterMs : 0;
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
      const includeSnapshot =
        snapshotChanged(lastSentSnapshotRef.current, localSnapshot) ||
        performance.now() - lastResponseAtRef.current > SNAPSHOT_KEEPALIVE_MS ||
        !!carryIntent;

      pendingInputsRef.current.push(pendingInput);
      if (pendingInputsRef.current.length > MP_INPUT_BUFFER_SIZE) {
        pendingInputsRef.current.splice(
          0,
          pendingInputsRef.current.length - MP_INPUT_BUFFER_SIZE,
        );
      }

      try {
        const payload = {
          roomId: session.roomId,
          playerId: session.playerId,
          playerName: session.playerName,
          hostId: session.hostId,
          seed,
          characterId: localSnapshot.characterId,
          snapshot: includeSnapshot ? localSnapshot : undefined,
          input,
          enemies:
            session.playerId === session.hostId
              ? game.getEnemySnapshots()
              : undefined,
          carryTargetId: carryIntent?.targetId,
          dropCarry: carryIntent?.dropCarry ?? false,
        };
        const result = await syncMultiplayerRoom(payload, {
          signal: controller.signal,
        });
        if (cancelled) return;
        if (
          multiplayerNoticeRef.current ===
            "Reconnecting multiplayer session..." ||
          multiplayerNoticeRef.current === "Connection hiccup; retrying..."
        ) {
          setMultiplayerNotice(null);
        }
        if (seq < appliedSyncSeqRef.current) return;
        appliedSyncSeqRef.current = seq;
        applyRemotePlayerFromState(result.sync.remote, result.sync.serverTime);
        game.applyEnemySnapshots(result.sync.enemies, {
          version: result.sync.enemyVersion,
          checksum: result.sync.enemyChecksum,
        });
        if (result.sync.hostId !== session.hostId) {
          multiplayerSessionRef.current = {
            ...session,
            hostId: result.sync.hostId,
          };
          setMultiplayerSession((current) =>
            current && current.roomId === session.roomId
              ? { ...current, hostId: result.sync.hostId }
              : current,
          );
          game.setMultiplayerHostId(result.sync.hostId);
        }

        if (includeSnapshot) {
          lastSentSnapshotRef.current = localSnapshot;
        }
        lastResponseAtRef.current = performance.now();

        const ackSeq = Math.max(0, Math.floor(result.sync.ackInputSeq || 0));
        if (ackSeq > 0) {
          pendingInputsRef.current = pendingInputsRef.current.filter(
            (entry) => entry.seq > ackSeq,
          );
        }
        if (pendingInputsRef.current.length > MP_INPUT_BUFFER_SIZE) {
          pendingInputsRef.current.splice(
            0,
            pendingInputsRef.current.length - MP_INPUT_BUFFER_SIZE,
          );
        }

        const unacked = pendingInputsRef.current.map((entry) => entry.input);
        game.reconcileLocalAuthoritative(result.sync.local, unacked);

        const elapsed = performance.now() - startedAt;
        const jitterSample = Math.abs(elapsed - lastRttRef.current);
        jitterEwmaRef.current =
          jitterEwmaRef.current * 0.7 + jitterSample * 0.3;
        lastRttRef.current = elapsed;
        // Keep RTT EWMA for the net overlay display; cadence is fixed (tick-based).
        syncRttEwmaMsRef.current =
          syncRttEwmaMsRef.current * 0.75 + elapsed * 0.25;

        responseCounterRef.current += 1;
        const now = performance.now();
        if (responseWindowStartRef.current <= 0)
          responseWindowStartRef.current = now;
        const winElapsed = now - responseWindowStartRef.current;
        if (winElapsed >= 1000) {
          const rate =
            (responseCounterRef.current * 1000) / Math.max(1, winElapsed);
          responseCounterRef.current = 0;
          responseWindowStartRef.current = now;
          const syntheticLoss =
            sentInputCountRef.current > 0
              ? (droppedInputCountRef.current / sentInputCountRef.current) * 100
              : 0;
          setNetOverlay((prev) => ({
            ...prev,
            rttMs: quantize(syncRttEwmaMsRef.current, 1),
            jitterMs: quantize(jitterEwmaRef.current, 1),
            inferredLoss: quantize(
              Math.max(syntheticLoss, result.sync.inferredPacketLoss),
              1,
            ),
            serverTickRate: result.sync.serverTickRate,
            snapshotRate: result.sync.snapshotRate,
            clientSnapshotRate: quantize(rate, 1),
            enemyVersion: result.sync.enemyVersion,
            encounterChunk: result.sync.encounterChunk,
            authoritativeDistance: result.sync.authoritativeDistance,
          }));
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        if (!cancelled) {
          const msg =
            error instanceof Error ? error.message : "Multiplayer sync failed";
          if (/room not found|player not in room/i.test(msg)) {
            if (performance.now() - lastResponseAtRef.current > 2500) {
              setMultiplayerNotice("Reconnecting multiplayer session...");
            }
          } else if (
            /aborted|network request failed|failed to fetch/i.test(msg)
          ) {
            if (performance.now() - lastResponseAtRef.current > 2500) {
              setMultiplayerNotice("Connection hiccup; retrying...");
            }
          } else {
            setMultiplayerNotice(msg);
          }
        }
      } finally {
        if (syncAbortRef.current === controller) syncAbortRef.current = null;
        syncInFlightRef.current = false;
        const elapsed = performance.now() - startedAt;
        // Maintain the fixed 25 Hz tick: schedule the next sync one tick after
        // this one started, minus the time already spent in the round-trip.
        const nextDelay = Math.max(0, MP_TICK_MS - elapsed);
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
  }, [applyRemotePlayerFromState, multiplayerSession, seed, state]);

  // ── WebRTC P2P connection establishment ──────────────────────────────
  // After a multiplayer session starts, attempt a direct device-to-device
  // data channel via WebRTC. The HTTP server is used only for the one-time
  // SDP handshake (signaling); all gameplay sync then flows P2P.
  // If WebRTC fails, the HTTP polling loop above continues as fallback.
  useEffect(() => {
    if (!multiplayerSession || !isRTCAvailable()) return;
    const session = multiplayerSession;
    const isHost = session.playerId === session.hostId;

    let cancelled = false;
    let pingTimer: number | null = null;
    let reconnectTimer: number | null = null;
    const MAX_RECONNECT_ATTEMPTS = 3;

    const establish = async (attempt: number) => {
      // Exponential backoff on reconnect: 2s, 5s, 10s
      if (attempt > 0) {
        const backoff = 2000 * Math.pow(2.5, attempt - 1);
        await new Promise((r) => setTimeout(r, backoff));
      }
      // Initial delay so both clients reach 'playing' state
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
      }
      if (cancelled) return;

      const transport = new RTCTransport();
      rtcRef.current = transport;
      setRtcStatus("connecting");

      // Track which remote candidates we've already applied
      let appliedCandidateVersion = 0;
      let candidatePollTimer: number | null = null;
      // Buffer candidates gathered locally before the SDP is exchanged
      const pendingLocalCandidates: RTCIceCandidateInit[] = [];

      transport.onIceCandidate = (candidate) => {
        // Before SDP exchange: buffer. After: post immediately.
        if (pendingLocalCandidates.length >= 0) {
          pendingLocalCandidates.push(candidate);
        }
      };

      transport.onMessage = (msg) => {
        if (msg.type === 'sync') {
          const seq = msg.seq ?? 0;
          if (seq && seq <= remoteRTCSeqRef.current) return;
          remoteRTCSeqRef.current = Math.max(remoteRTCSeqRef.current, seq);
          remoteRTCDataRef.current = { ...msg, receivedAt: performance.now() };
        }
      };
      transport.onClose = () => {
        if (cancelled) return;
        rtcConnectedRef.current = false;
        setRtcStatus("failed");
        // Restore full interpolation delay for HTTP polling fallback
        gameRef.current?.setInterpolationDelay(MP_INTERPOLATION_DELAY_MS);
        // Auto-reconnect: the HTTP fallback keeps the game playable, but
        // try to re-establish P2P for low-latency sync.
        if (rtcReconnectRef.current < MAX_RECONNECT_ATTEMPTS) {
          rtcReconnectRef.current += 1;
          reconnectTimer = window.setTimeout(() => {
            if (!cancelled) void establish(rtcReconnectRef.current);
          }, 2000);
        }
      };

      // Helper: flush buffered local candidates to the server
      const flushCandidates = async () => {
        if (pendingLocalCandidates.length === 0) return;
        const batch = pendingLocalCandidates.splice(0);
        await postRTCCandidates(
          session.roomId,
          isHost ? "host" : "joiner",
          batch,
        );
      };

      // Helper: poll for new remote candidates and apply them (trickle ICE)
      const pollRemoteCandidates = async () => {
        if (cancelled) return;
        const signal = await getRTCSignal(session.roomId).catch(() => null);
        if (!signal) return;
        if (signal.candidatesVersion > appliedCandidateVersion) {
          appliedCandidateVersion = signal.candidatesVersion;
          const remoteCandidates = isHost
            ? signal.joinerCandidates
            : signal.hostCandidates;
          if (remoteCandidates?.length) {
            await transport.addIceCandidates(remoteCandidates);
          }
        }
      };

      try {
        if (isHost) {
          const offer = await transport.createOffer();
          if (cancelled) return;
          await postRTCOffer(session.roomId, session.playerId, offer);
          await flushCandidates();

          // Poll for the joiner's answer + candidates
          const deadline = Date.now() + 15000;
          let gotAnswer = false;
          while (!cancelled && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 100));
            if (cancelled) return;
            const signal = await getRTCSignal(session.roomId).catch(() => null);
            if (signal) {
              if (!gotAnswer && signal.hasAnswer && signal.answer) {
                await transport.acceptAnswer(signal.answer);
                gotAnswer = true;
              }
              // Apply any new joiner candidates
              if (signal.candidatesVersion > appliedCandidateVersion) {
                appliedCandidateVersion = signal.candidatesVersion;
                if (signal.joinerCandidates?.length) {
                  await transport.addIceCandidates(signal.joinerCandidates);
                }
              }
            }
            if (gotAnswer) break;
          }
        } else {
          // Joiner: wait for host's offer
          const deadline = Date.now() + 15000;
          while (!cancelled && Date.now() < deadline) {
            await new Promise((r) => setTimeout(r, 100));
            if (cancelled) return;
            const signal = await getRTCSignal(session.roomId).catch(() => null);
            if (signal?.hasOffer && signal.offer) {
              const answer = await transport.acceptOfferAndAnswer(signal.offer);
              if (cancelled) return;
              await postRTCAnswer(session.roomId, answer);
              await flushCandidates();
              // Apply any host candidates already collected
              if (signal.hostCandidates?.length) {
                await transport.addIceCandidates(signal.hostCandidates);
                appliedCandidateVersion = signal.candidatesVersion;
              }
              break;
            }
          }
        }

        if (cancelled) return;

        // Continue flushing any candidates gathered during/after SDP exchange
        await flushCandidates();

        // Start polling for late-arriving remote candidates
        candidatePollTimer = window.setInterval(() => {
          if (!cancelled) {
            void flushCandidates();
            void pollRemoteCandidates();
          }
        }, 100);

        // Wait for the data channel to open
        const connectDeadline = Date.now() + 10000;
        while (!cancelled && Date.now() < connectDeadline) {
          if (transport.isOpen) break;
          await new Promise((r) => setTimeout(r, 100));
        }

        if (cancelled) return;

        if (transport.isOpen) {
          rtcConnectedRef.current = true;
          rtcReconnectRef.current = 0; // reset on successful connect
          setRtcStatus("connected");
          // Lower interpolation delay — P2P data arrives in 1–5 ms, not 40–150 ms
          gameRef.current?.setInterpolationDelay(MP_P2P_INTERPOLATION_DELAY_MS);
          void clearRTCSignal(session.roomId);
          setMultiplayerNotice(null);
          // Periodic RTT probe
          pingTimer = window.setInterval(() => {
            if (transport.isOpen) transport.ping();
          }, 2000);
        } else {
          setRtcStatus("failed");
          if (candidatePollTimer !== null) clearInterval(candidatePollTimer);
          transport.close();
          rtcRef.current = null;
          // Try reconnect if under the limit
          if (rtcReconnectRef.current < MAX_RECONNECT_ATTEMPTS) {
            rtcReconnectRef.current += 1;
            reconnectTimer = window.setTimeout(() => {
              if (!cancelled) void establish(rtcReconnectRef.current);
            }, 3000);
          }
        }
      } catch {
        if (!cancelled) setRtcStatus("failed");
        if (candidatePollTimer !== null) clearInterval(candidatePollTimer);
        transport.close();
        rtcRef.current = null;
      }
    };

    void establish(0);

    return () => {
      cancelled = true;
      if (pingTimer !== null) clearInterval(pingTimer);
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      rtcConnectedRef.current = false;
      setRtcStatus("off");
      rtcRef.current?.close();
      rtcRef.current = null;
      remoteRTCDataRef.current = null;
    };
  }, [multiplayerSession]);

  useEffect(() => {
    return () => {
      const session = multiplayerSessionRef.current;
      if (session) {
        void leaveMultiplayerRoom(session.roomId, session.playerId).catch(
          () => {},
        );
      }
    };
  }, []);

  useEffect(() => {
    if (!multiplayerNotice) return;
    const timer = window.setTimeout(() => setMultiplayerNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [multiplayerNotice]);

  useEffect(() => {
    if (state !== "playing" || !!multiplayerSession || splitScreenSeed !== null)
      return;
    const slotId = loadActiveSaveSlotId();
    activeSaveSlotRef.current = slotId;
    applyProgressionFromSlot(slotId);

    const saveNow = () => {
      const checkpoint = gameRef.current?.exportRunCheckpoint();
      if (!checkpoint) return;
      saveSlotCheckpoint(slotId, checkpoint);
    };

    const initialTimer = window.setTimeout(saveNow, 900);
    const interval = window.setInterval(saveNow, 2400);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [applyProgressionFromSlot, multiplayerSession, splitScreenSeed, state]);

  const previousStateRef = useRef(state);
  useEffect(() => {
    const prev = previousStateRef.current;
    if (
      prev === "playing" &&
      state === "gameover" &&
      !multiplayerSession &&
      splitScreenSeed === null
    ) {
      const slotId = activeSaveSlotRef.current || loadActiveSaveSlotId();
      addRunRewards(slotId, {
        coins: stats.coins,
        score: stats.score,
        distance: Math.round(stats.distance),
      });
      if (runModeRef.current === "daily") {
        markDailyChallengePlayed(slotId, getTodayIsoDay());
      }
      const ghostPoints = gameRef.current?.exportGhostPath() ?? [];
      if (ghostPoints.length > 10) {
        upsertGhostRun({
          slotId,
          seed: runSeedRef.current,
          bestScore: stats.score,
          bestDistance: Math.round(stats.distance),
          points: ghostPoints,
          updatedAt: Date.now(),
        });
      }
      const token = runTokenRef.current;
      if (token) {
        void submitRunScore({
          token,
          mode: runModeRef.current,
          seed: runSeedRef.current,
          score: stats.score,
          distance: Math.round(stats.distance),
          coins: stats.coins,
          characterId: loadSelectedCharacter(),
          replayPath: sampleReplayPath(ghostPoints),
        }).catch(() => {});
      }
      clearSlotCheckpoint(slotId);
    }
    previousStateRef.current = state;
  }, [
    multiplayerSession,
    splitScreenSeed,
    state,
    stats.coins,
    stats.distance,
    stats.score,
  ]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-black select-none">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
        style={{ imageRendering: "auto" }}
      />

      {/* Menu overlays */}
      {state !== "playing" && (
        <div className="absolute inset-0 z-10">
          {state === "menu" && !splitScreenSeed && (
            <StartScreen
              onPlay={handlePlay}
              onPlayDailyChallenge={handlePlayDailyChallenge}
              onLevelSelect={goToLevelSelect}
              onPlayMultiplayer={handlePlayMultiplayer}
              onPlaySplitScreen={handlePlaySplitScreen}
              onPlayOnlineGhostRace={handlePlayOnlineGhostRace}
              initialRoomCode={prefillRoomCode}
            />
          )}
          {state === "levelselect" && (
            <LevelSelectScreen
              onLevelSelect={handleStartLevel}
              onBack={quitToMenu}
              onEndlessPlay={handlePlay}
            />
          )}
          {state === "levelcomplete" && currentLevel && levelResult && (
            <LevelCompleteScreen
              level={currentLevel}
              result={levelResult}
              onNext={handleNextLevel}
              onRetry={() => handleStartLevel(currentLevel)}
              onBack={goToLevelSelect}
            />
          )}
          {state === "paused" && (
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onQuit={handleQuit}
            />
          )}
          {state === "gameover" && (
            <GameOverScreen
              stats={stats}
              onRestart={
                currentLevel
                  ? () => handleStartLevel(currentLevel)
                  : handleRestart
              }
              onQuit={handleQuit}
            />
          )}
        </div>
      )}

      {/* In-game UI */}
      {state === "playing" && (
        <div
          className="absolute inset-x-0 top-0 z-[9] pointer-events-none"
          style={{
            height: 88,
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0))",
          }}
        />
      )}
      {state === "playing" && <HUD stats={stats} settings={settings} />}
      {state === "playing" && <TouchControls />}
      {state === "playing" && multiplayerSession && (
        <div
          className="absolute left-1/2 z-20 pointer-events-none"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 56px)",
            transform: "translateX(-50%)",
            background: "rgba(2,6,23,0.62)",
            border: "1px solid rgba(148,163,184,0.28)",
            borderRadius: 999,
            padding: "4px 10px",
            color: "#cbd5e1",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Room {multiplayerSession.roomId}
        </div>
      )}
      {state === "playing" && multiplayerSession && settings.showDebug && (
        <div
          className="absolute left-3 z-20 pointer-events-none"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 54px)",
            width: "min(56vw, 220px)",
            background: "rgba(2,6,23,0.6)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 10,
            padding: "6px 8px",
            color: "#cbd5e1",
            fontSize: 10,
            lineHeight: 1.25,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <div
            style={{
              marginBottom: 4,
              display: "flex",
              gap: 6,
              alignItems: "center",
            }}
          >
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.04em",
                background:
                  rtcStatus === "connected"
                    ? "rgba(34,197,94,0.2)"
                    : rtcStatus === "connecting"
                      ? "rgba(250,204,21,0.2)"
                      : "rgba(100,116,139,0.2)",
                color:
                  rtcStatus === "connected"
                    ? "#22c55e"
                    : rtcStatus === "connecting"
                      ? "#facc15"
                      : "#94a3b8",
                border: `1px solid ${rtcStatus === "connected" ? "rgba(34,197,94,0.3)" : rtcStatus === "connecting" ? "rgba(250,204,21,0.3)" : "rgba(100,116,139,0.3)"}`,
              }}
            >
              {rtcStatus === "connected"
                ? "P2P"
                : rtcStatus === "connecting"
                  ? "P2P…"
                  : "HTTP"}
            </span>
            <span>RTT {netOverlay.rttMs}ms</span>
          </div>
          <div>Jitter {netOverlay.jitterMs}ms</div>
          <div>Loss {netOverlay.inferredLoss}%</div>
          <div>Srv Tick {netOverlay.serverTickRate}hz</div>
          <div>Srv Snap {netOverlay.snapshotRate}hz</div>
          <div>Cli Sync {netOverlay.clientSnapshotRate}hz</div>
          <div>FPS {Math.round(stats.fps || 0)}</div>
          <div>Pred Err {netOverlay.predictionError}px</div>
          <div>Reconciles {netOverlay.reconciliationCount}</div>
          <div>Interp {netOverlay.interpolationDelayMs}ms</div>
          <div>Enemy Ver {netOverlay.enemyVersion}</div>
          <div>Encounter {netOverlay.encounterChunk}</div>
          <div>Auth Dist {Math.round(netOverlay.authoritativeDistance)}m</div>
        </div>
      )}
      {state === "playing" && showHostInvite && hostInviteUrl && (
        <div
          className="absolute left-1/2 z-30"
          style={{
            bottom: "max(92px, calc(env(safe-area-inset-bottom, 0px) + 92px))",
            transform: "translateX(-50%)",
            width: "min(92vw, 340px)",
            background: "rgba(2,6,23,0.88)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 14,
            padding: 10,
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span
              style={{
                color: "#e2e8f0",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.04em",
              }}
            >
              LAN Invite
            </span>
            <button
              type="button"
              onClick={() => setShowHostInvite(false)}
              className="ios-btn-gray"
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                fontSize: 12,
                padding: 0,
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=170x170&margin=0&data=${encodeURIComponent(hostInviteUrl)}`}
              alt="Room QR code"
              width={92}
              height={92}
              style={{
                borderRadius: 8,
                border: "1px solid rgba(148,163,184,0.28)",
                background: "#fff",
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "#cbd5e1", fontSize: 11, marginBottom: 6 }}>
                Code:{" "}
                <span style={{ fontWeight: 800, letterSpacing: "0.08em" }}>
                  {multiplayerSession?.roomId}
                </span>
              </div>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 10,
                  lineHeight: 1.35,
                  maxHeight: 42,
                  overflow: "hidden",
                  wordBreak: "break-all",
                }}
              >
                {hostInviteUrl}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0,1fr))",
              gap: 8,
              marginTop: 10,
            }}
          >
            <button
              type="button"
              className="ios-btn-secondary"
              style={{ height: 34, fontSize: 12 }}
              onClick={() => {
                void handleCopyInvite();
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="ios-btn-secondary"
              style={{ height: 34, fontSize: 12 }}
              onClick={() => {
                void handleShareInvite();
              }}
            >
              Share
            </button>
            <button
              type="button"
              className="ios-btn-secondary"
              style={{ height: 34, fontSize: 12 }}
              onClick={handleTextInvite}
            >
              Text
            </button>
          </div>
        </div>
      )}
      {multiplayerNotice && (
        <div
          className="absolute left-1/2 z-30 pointer-events-none"
          style={{
            top: "calc(env(safe-area-inset-top, 0px) + 16px)",
            transform: "translateX(-50%)",
            background: "rgba(15,23,42,0.82)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 10,
            padding: "6px 10px",
            color: "#e2e8f0",
            fontSize: 12,
            fontWeight: 500,
            maxWidth: 320,
            textAlign: "center",
          }}
        >
          {multiplayerNotice}
        </div>
      )}

      {/* Pause button — iOS system style */}
      {state === "playing" && !splitScreenSeed && (
        <button
          onClick={handlePause}
          aria-label="Pause"
          style={{
            position: "absolute",
            top: "calc(env(safe-area-inset-top, 0px) + 12px)",
            right: "calc(env(safe-area-inset-right, 0px) + 14px)",
            zIndex: 20,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.48)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "0.5px solid rgba(255,255,255,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            transition:
              "transform 0.12s cubic-bezier(0.34,1.56,0.64,1), opacity 0.1s ease, background 0.12s ease",
            color: "rgba(235,235,245,0.6)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "rgba(235,235,245,0.92)";
            e.currentTarget.style.background = "rgba(0,0,0,0.64)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "rgba(235,235,245,0.6)";
            e.currentTarget.style.background = "rgba(0,0,0,0.48)";
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.92)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <rect x="3" y="2" width="3.5" height="12" rx="1.2" />
            <rect x="9.5" y="2" width="3.5" height="12" rx="1.2" />
          </svg>
        </button>
      )}

      {splitScreenSeed !== null && (
        <SplitScreenMode
          seed={splitScreenSeed}
          onExit={handleExitSplitScreen}
        />
      )}
    </main>
  );
}
