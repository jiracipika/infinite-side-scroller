/**
 * Main game engine — ties everything together.
 * Manages the game loop, updates all systems, and renders each frame.
 */

import { Camera, DEFAULT_CAMERA_CONFIG, type CameraMode } from "./camera";
import { ChunkManager } from "../world/chunk-manager";
import { InputManager } from "../input/input";
import { Player, DEFAULT_PLAYER_CONFIG } from "../entities/player";
import { Enemy } from "../entities/Enemy";
import { Slime } from "../entities/Slime";
import { Beetle } from "../entities/Beetle";
import { Wisp } from "../entities/Wisp";
import { Bat } from "../entities/Bat";
import { Mite } from "../entities/Mite";
import { Skeleton } from "../entities/Skeleton";
import { Jumper } from "../entities/Jumper";
import { Boss } from "../entities/Boss";
import { Alien } from "../entities/Alien";
import { UFO } from "../entities/UFO";
import { ParticleSystem } from "../entities/particles";
import { GameRenderer } from "../rendering/renderer";
import { getSfxEngine, type SfxEngine } from "../audio";
import { getBiomeAt } from "../world/biomes";
import { getDifficulty } from "../difficulty";
import type { Collectible } from "../entities/Collectibles";
import {
  spawnCollectiblesForChunk,
  spawnEnemiesForChunk,
} from "../entities/Collectibles";
import { spawnHazardsForChunk, renderHazard, type Hazard } from "../hazards";
import { getCharacterById } from "../data/characters";
import type { Platform as PlatformData } from "../world/chunk";
import { PerformanceProfiler } from "./performance-profiler";
import { EntityPools } from "./entity-pools";
import { comboMultiplierFor } from "./combo-tiers";
import type {
  NetEnemySnapshot,
  NetInputCommand,
  NetPlayerSnapshot,
} from "../multiplayer/types";
import type { InputOptions } from "../input/input";
import {
  DEFAULT_PROGRESSION_BONUSES,
  type PlayerProgressionBonuses,
  type RunCheckpoint,
} from "../../lib/progression";
import type { LevelConfig } from "../data/levels";
import {
  MP_INPUT_BUFFER_SIZE,
  MP_INTERPOLATION_DELAY_MS,
  MP_MAX_EXTRAPOLATION_MS,
  MP_RECONCILE_MEDIUM_THRESHOLD,
  MP_RECONCILE_SMALL_THRESHOLD,
  MP_RECONCILE_SMOOTH_SPEED,
  MP_RECONCILE_SNAP_THRESHOLD,
} from "../multiplayer/config";

const FIXED_DT = 1 / 60;
const MAX_ACCUMULATED = 0.1;
const START_SAFE_ZONE_END = 760;

// High-DPR phones can silently allocate 3x/4x fullscreen canvases, turning a
// 390x844 viewport into a multi-megapixel render target. Cap backing-store
// resolution while preserving CSS-space gameplay coordinates.
const MAX_CANVAS_DPR = 2;
const MOBILE_CANVAS_DPR = 1.5;
const MOBILE_CANVAS_AREA = 900 * 520;

function getCanvasRenderDpr(rawDpr: number, width: number, height: number): number {
  const safeDpr = Number.isFinite(rawDpr) && rawDpr > 0 ? rawDpr : 1;
  const cappedDpr = Math.min(safeDpr, MAX_CANVAS_DPR);
  return width * height <= MOBILE_CANVAS_AREA
    ? Math.min(cappedDpr, MOBILE_CANVAS_DPR)
    : cappedDpr;
}

export type EngineState = "playing" | "paused" | "gameover";

export interface RemotePlayerViewState {
  id: string;
  name: string;
  snapshot: NetPlayerSnapshot;
  carryTargetId: string | null;
  carriedById: string | null;
  serverTime?: number;
}

export interface GameEngineOptions {
  input?: InputOptions;
  cameraMode?: CameraMode;
}

export interface NetDebugStats {
  predictionError: number;
  reconciliationCount: number;
  interpolationDelayMs: number;
  remoteBufferSize: number;
}

interface PlayerProjectileSnapshot {
  x: number;
  y: number;
  vx: number;
  life: number;
  damage: number;
  radius: number;
  color: string;
  glowColor: string;
}

interface GhostPoint {
  distance: number;
  x: number;
  y: number;
}

/** AABB collision check. expandBy shrinks the player hitbox for forgiving collision. */
function aabbOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
  expandBy: number = 0,
): boolean {
  // Shrink hitbox A by expandBy for more forgiving collisions
  const ax = a.x + expandBy;
  const ay = a.y + expandBy;
  const aw = a.width - expandBy * 2;
  const ah = a.height - expandBy * 2;

  if (aw <= 0 || ah <= 0) return false; // safety check

  return (
    ax < b.x + b.width && ax + aw > b.x && ay < b.y + b.height && ay + ah > b.y
  );
}

const KILL_SCORES: Record<string, number> = {
  slime: 100,
  beetle: 75,
  wisp: 125,
  bat: 150,
  mite: 175,
  jumper: 200,
  skeleton: 250,
  alien: 350,
  ufo: 500,
  boss: 1000,
};

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: GameRenderer;
  private camera: Camera;
  private chunkManager: ChunkManager;
  private input: InputManager;
  private player: Player;
  private particles: ParticleSystem;

  // Performance monitoring
  private profiler: PerformanceProfiler;
  private entityPools: EntityPools;

  // Procedural audio — shares the global AudioContext singleton.
  private sfx: SfxEngine = getSfxEngine();

  // Adaptive quality
  private adaptiveQualityEnabled = true;
  private currentQualityLevel = "high"; // 'high', 'medium', 'low'
  private qualityChangeTimer = 0;
  private qualityChangeCooldown = 2.0; // seconds between quality changes

  private animationId: number | null = null;
  private lastTime = 0;
  private accumulated = 0;
  private _running = false;
  private _state: EngineState = "playing";

  worldSeed = 42;
  difficulty = getDifficulty(0);

  onGameOver?: () => void;
  onLevelComplete?: (result: {
    score: number;
    coins: number;
    distance: number;
    timeMs: number;
    enemiesDefeated: number;
  }) => void;
  onStatsUpdate?: (stats: {
    score: number;
    coins: number;
    distance: number;
    health: number;
    maxHealth: number;
    lives: number;
    biome: string;
    powerUps: string[];
    fps: number;
    comboCount?: number;
    comboMultiplier?: number;
    maxCombo?: number;
    comboTimeRemaining?: number;
    enemiesDefeated?: number;
    dayPhase?: "dawn" | "day" | "dusk" | "night";
    levelTimeRemaining?: number;
    levelTarget?: number;
  }) => void;
  onLocalPlayerSnapshot?: (snapshot: NetPlayerSnapshot) => void;
  onCarryIntent?: (payload: {
    targetId: string | null;
    dropCarry: boolean;
  }) => void;
  onNetworkDebug?: (stats: NetDebugStats) => void;

  private wasOnGround = true;

  // Entity management
  private enemies: Enemy[] = [];
  private collectibles: Collectible[] = [];
  private hazards: Hazard[] = [];

  // Track which chunks have spawned entities
  private spawnedChunks = new Set<number>();

  // Game time for animations
  private gameTime = 0;
  private levelConfig: LevelConfig | null = null;
  private levelTimeRemaining = 0;
  private levelCompleted = false;
  private enemiesDefeated = 0;

  private _characterId: string = "knight";
  private multiplayerEnabled = false;
  private multiplayerPlayerId: string | null = null;
  private multiplayerIsHost = false;
  private remotePlayerId: string | null = null;
  private remotePlayerName: string | null = null;
  private remotePlayer: Player | null = null;
  private remoteTargetSnapshot: NetPlayerSnapshot | null = null;
  private remoteSnapshotBuffer: Array<{
    t: number;
    snapshot: NetPlayerSnapshot;
  }> = [];
  private remoteCarriedByLocal = false;
  private localCarriedByRemote = false;
  private remoteProjectiles: PlayerProjectileSnapshot[] = [];
  /** Interpolation delay — lower for P2P (low-latency), higher for HTTP polling. */
  private interpolationDelayMs = MP_INTERPOLATION_DELAY_MS;
  private lastEnemyVersionApplied = -1;
  private lastEnemyChecksumApplied = 0;
  private carryHintTimer = 0;
  private playerBounceCooldown = 0;
  private reconcileOffsetX = 0;
  private reconcileOffsetY = 0;
  private predictionError = 0;
  private reconciliationCount = 0;
  private progressionBonuses: PlayerProgressionBonuses = {
    ...DEFAULT_PROGRESSION_BONUSES,
  };
  private ghostRecording: GhostPoint[] = [];
  private ghostPlayback: GhostPoint[] = [];
  private ghostPlaybackIndex = 0;
  private ghostSampleTimer = 0;

  // Combo system — increments on consecutive enemy defeats, decays after 3s without a kill
  private comboCount = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private readonly COMBO_DECAY_SECONDS = 3.0;

  constructor(
    canvas: HTMLCanvasElement,
    seed?: number,
    characterId?: string,
    options?: GameEngineOptions,
  ) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    if (seed !== undefined) this.worldSeed = seed;
    if (characterId) this._characterId = characterId;

    this.input = new InputManager(options?.input);
    this.camera = new Camera({
      ...DEFAULT_CAMERA_CONFIG,
      mode: options?.cameraMode ?? DEFAULT_CAMERA_CONFIG.mode,
    });
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.player.applyCharacter(getCharacterById(this._characterId));
    this.player.applyProgressionBonuses(this.progressionBonuses);
    this.player.setDoubleJump(true);
    this.particles = new ParticleSystem();
    this.renderer = new GameRenderer(this.ctx);
    this.wireHealCallback();

    // Initialize performance and entity pools
    this.profiler = new PerformanceProfiler();
    this.entityPools = new EntityPools();

    this.handleResize();
    this.prepareOpeningFrame();
    window.addEventListener("resize", this.handleResize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private handleVisibilityChange = (): void => {
    this.sfx.setEnabled(!document.hidden);
  };

  get state(): EngineState {
    return this._state;
  }

  pause(): void {
    this._state = "paused";
  }
  resume(): void {
    this._state = "playing";
    this.lastTime = performance.now();
    this.accumulated = 0;
  }

  setCameraMode(mode: CameraMode): void {
    this.camera.setMode(mode);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
  }

  /**
   * Toggle reduced-motion (accessibility) mode on the camera. When enabled,
   * screen shake is suppressed for users with motion sensitivity. Pair with
   * the CSS `prefers-reduced-motion` guard via resolveReducedMotion().
   */
  setReducedMotion(enabled: boolean): void {
    this.camera.setReducedMotion(enabled);
  }

  /** Update audio volumes from persisted settings. */
  setAudioVolumes(master: number, sfx: number): void {
    this.sfx.setVolumes(master, sfx);
  }

  /** Resume the AudioContext (must be called from a user gesture). */
  resumeAudio(): void {
    this.sfx.resume();
  }

  /**
   * Connect player.onHeal to the particle system so any health gain —
   * Healer passive regen, healing-aura ticks, coin-luck heals — emits a
   * visible green particle burst at the player's position.
   */
  private wireHealCallback(): void {
    this.player.onHeal = () => {
      this.particles.spawnHeal(this.player.centerX, this.player.centerY);
    };
  }

  setSeed(seed: number, characterId?: string): void {
    this.worldSeed = seed;
    if (characterId) this._characterId = characterId;
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.player.applyCharacter(getCharacterById(this._characterId));
    this.player.applyProgressionBonuses(this.progressionBonuses);
    this.player.setDoubleJump(true);
    this.wireHealCallback();
    this.particles.clear();
    this.entityPools.clear();
    this.profiler.reset();
    this.renderer.clearTerrainCache();
    this.enemies = [];
    this.collectibles = [];
    this.hazards = [];
    this.spawnedChunks.clear();
    this._state = "playing";
    this.difficulty = getDifficulty(0);
    this.wasOnGround = true;
    this.currentQualityLevel = "high";
    this.particles.setReducedParticles(false);
    this.gameTime = 0;
    this.levelTimeRemaining = this.levelConfig?.timeLimit ?? 0;
    this.levelCompleted = false;
    this.enemiesDefeated = 0;
    this.remotePlayer = null;
    this.remotePlayerId = null;
    this.remotePlayerName = null;
    this.remoteTargetSnapshot = null;
    this.remoteSnapshotBuffer = [];
    this.remoteCarriedByLocal = false;
    this.localCarriedByRemote = false;
    this.remoteProjectiles = [];
    this.lastEnemyVersionApplied = -1;
    this.lastEnemyChecksumApplied = 0;
    this.carryHintTimer = 0;
    this.playerBounceCooldown = 0;
    this.reconcileOffsetX = 0;
    this.reconcileOffsetY = 0;
    this.predictionError = 0;
    this.reconciliationCount = 0;
    this.ghostRecording = [];
    this.ghostPlaybackIndex = 0;
    this.ghostSampleTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxCombo = 0;
    this.prepareOpeningFrame();
    // Reset timing to avoid first-frame spike after restart
    this.lastTime = performance.now();
    this.accumulated = 0;
  }

  /** Configure the engine for level-based play. */
  setLevel(config: LevelConfig): void {
    this.levelConfig = config;
    this.setSeed(config.seed, this._characterId);
    this.levelTimeRemaining = config.timeLimit ?? 0;
    this.levelCompleted = false;
    this.enemiesDefeated = 0;
  }

  getGameTimeMs(): number {
    return this.gameTime * 1000;
  }

  setMultiplayerEnabled(
    enabled: boolean,
    localPlayerId?: string | null,
    hostId?: string | null,
  ): void {
    this.multiplayerEnabled = enabled;
    this.multiplayerPlayerId = localPlayerId ?? null;
    this.multiplayerIsHost =
      !!enabled && !!localPlayerId && !!hostId && localPlayerId === hostId;
    if (!enabled) {
      this.multiplayerIsHost = false;
      this.remotePlayer = null;
      this.remotePlayerId = null;
      this.remotePlayerName = null;
      this.remoteTargetSnapshot = null;
      this.remoteSnapshotBuffer = [];
      this.remoteCarriedByLocal = false;
      this.localCarriedByRemote = false;
      this.remoteProjectiles = [];
      this.carryHintTimer = 0;
      this.playerBounceCooldown = 0;
      this.reconcileOffsetX = 0;
      this.reconcileOffsetY = 0;
      this.predictionError = 0;
      this.reconciliationCount = 0;
    }
  }

  setMultiplayerHostId(hostId: string | null): void {
    this.multiplayerIsHost =
      !!this.multiplayerEnabled &&
      !!this.multiplayerPlayerId &&
      this.multiplayerPlayerId === hostId;
  }

  grantLocalPlayerLife(count = 1): void {
    const amount = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    if (amount === 0) return;
    this.player.lives += amount;
    this.particles.spawnScorePopup(this.player.centerX, this.player.y - 10, `+${amount} LIVE${amount === 1 ? '' : 'S'}`, '#22c55e');
  }

  setProgressionBonuses(bonuses: PlayerProgressionBonuses): void {
    this.progressionBonuses = { ...DEFAULT_PROGRESSION_BONUSES, ...bonuses };
    this.player.applyProgressionBonuses(this.progressionBonuses);
  }

  setGhostPath(
    points: Array<{ distance: number; x: number; y: number }>,
  ): void {
    this.ghostPlayback = points
      .filter(
        (p) =>
          Number.isFinite(p.distance) &&
          Number.isFinite(p.x) &&
          Number.isFinite(p.y),
      )
      .map((p) => ({
        distance: Number(p.distance),
        x: Number(p.x),
        y: Number(p.y),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 8000);
    this.ghostPlaybackIndex = 0;
  }

  exportGhostPath(): GhostPoint[] {
    return this.ghostRecording.map((p) => ({ ...p }));
  }

  exportRunCheckpoint(): Omit<RunCheckpoint, "savedAt"> {
    return {
      seed: this.worldSeed,
      characterId: this.player.characterId,
      x: this.player.x,
      y: this.player.y,
      vx: this.player.vx,
      vy: this.player.vy,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      score: Math.max(0, Math.floor(this.player.score)),
      coins: Math.max(0, Math.floor(this.player.coins)),
      distance: Math.max(0, Math.floor(this.player.distance)),
    };
  }

  restoreRunCheckpoint(checkpoint: RunCheckpoint): void {
    this.setSeed(checkpoint.seed, checkpoint.characterId);
    this.player.x = checkpoint.x;
    this.player.y = checkpoint.y;
    this.player.vx = checkpoint.vx;
    this.player.vy = checkpoint.vy;
    this.player.health = Math.max(
      1,
      Math.min(this.player.maxHealth, Math.floor(checkpoint.health)),
    );
    this.player.score = Math.max(0, Math.floor(checkpoint.score));
    this.player.coins = Math.max(0, Math.floor(checkpoint.coins));
    this.player.distance = Math.max(0, Math.floor(checkpoint.distance));
    this.player.distanceTraveled = Math.max(
      this.player.distanceTraveled,
      this.player.distance,
    );
    this.player.alive = true;
    this.player.onGround = false;
    this.chunkManager.update(this.player.centerX);
    this.spawnChunkEntities();
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this._state = "playing";
  }

  private createEnemyFromSnapshot(snapshot: NetEnemySnapshot): Enemy | null {
    let enemy: Enemy | null = null;
    switch (snapshot.type) {
      case "slime":
        enemy = new Slime(snapshot.x, snapshot.y, 0);
        break;
      case "beetle":
        enemy = new Beetle(snapshot.x, snapshot.y, 0);
        break;
      case "wisp":
        enemy = new Wisp(snapshot.x, snapshot.y, 0);
        break;
      case "bat":
        enemy = new Bat(snapshot.x, snapshot.y, 0);
        break;
      case "mite":
        enemy = new Mite(snapshot.x, snapshot.y, 0);
        break;
      case "jumper":
        enemy = new Jumper(snapshot.x, snapshot.y, 0);
        break;
      case "skeleton":
        enemy = new Skeleton(snapshot.x, snapshot.y, 0);
        break;
      case "alien":
        enemy = new Alien(snapshot.x, snapshot.y, 0);
        break;
      case "ufo":
        enemy = new UFO(snapshot.x, snapshot.y, 0);
        break;
      case "boss":
        enemy = new Boss(snapshot.x, snapshot.y, 0);
        break;
      default:
        return null;
    }

    enemy.netId = snapshot.id;
    enemy.x = snapshot.x;
    enemy.y = snapshot.y;
    enemy.vx = snapshot.vx;
    enemy.vy = snapshot.vy;
    enemy.health = snapshot.health;
    enemy.alive = snapshot.alive;
    enemy.facingRight = snapshot.facingRight;
    enemy.onGround = snapshot.onGround;
    return enemy;
  }

  /** Set interpolation delay — P2P uses a lower value for lower latency. */
  setInterpolationDelay(ms: number): void {
    this.interpolationDelayMs = Math.max(0, ms);
  }

  setRemotePlayerState(remote: RemotePlayerViewState | null): void {
    if (!this.multiplayerEnabled || !remote) {
      this.remotePlayer = null;
      this.remotePlayerId = null;
      this.remotePlayerName = null;
      this.remoteTargetSnapshot = null;
      this.remoteSnapshotBuffer = [];
      this.remoteCarriedByLocal = false;
      this.localCarriedByRemote = false;
      this.remoteProjectiles = [];
      this.lastEnemyVersionApplied = -1;
      this.lastEnemyChecksumApplied = 0;
      return;
    }

    this.remotePlayerId = remote.id;
    this.remotePlayerName = remote.name;
    this.remoteTargetSnapshot = remote.snapshot;
    this.remoteCarriedByLocal = remote.carriedById === this.multiplayerPlayerId;
    this.localCarriedByRemote =
      remote.carryTargetId === this.multiplayerPlayerId;

    if (!this.remotePlayer) {
      this.remotePlayer = new Player(DEFAULT_PLAYER_CONFIG);
      this.remotePlayer.applyCharacter(
        getCharacterById(remote.snapshot.characterId),
      );
      this.remotePlayer.x = remote.snapshot.x;
      this.remotePlayer.y = remote.snapshot.y;
    }

    const sampleTime = Number.isFinite(remote.serverTime)
      ? Number(remote.serverTime)
      : Date.now();
    const lastSample =
      this.remoteSnapshotBuffer[this.remoteSnapshotBuffer.length - 1];
    if (
      !lastSample ||
      Math.abs(lastSample.snapshot.x - remote.snapshot.x) > 0.5 ||
      Math.abs(lastSample.snapshot.y - remote.snapshot.y) > 0.5
    ) {
      this.remoteSnapshotBuffer.push({
        t: sampleTime,
        snapshot: remote.snapshot,
      });
      if (this.remoteSnapshotBuffer.length > 28) {
        this.remoteSnapshotBuffer.splice(
          0,
          this.remoteSnapshotBuffer.length - 28,
        );
      }
    } else {
      lastSample.t = sampleTime;
      lastSample.snapshot = remote.snapshot;
    }

    const rp = this.remotePlayer;
    rp.characterId = remote.snapshot.characterId;
    rp.width = remote.snapshot.width;
    rp.height = remote.snapshot.height;
    rp.health = remote.snapshot.health;
    rp.maxHealth = remote.snapshot.maxHealth;
    rp.distance = remote.snapshot.distance;
    rp.alive = remote.snapshot.alive !== false && remote.snapshot.health > 0;
  }

  getLocalPlayerProjectiles(): PlayerProjectileSnapshot[] {
    return this.player.projectiles.map((p) => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      vx: Math.round(p.vx * 10) / 10,
      life: Math.max(0, p.life),
      damage: p.damage,
      radius: p.radius,
      color: p.color,
      glowColor: p.glowColor,
    }));
  }

  setRemotePlayerProjectiles(projectiles: PlayerProjectileSnapshot[]): void {
    this.remoteProjectiles = projectiles
      .filter((p) => p.life > 0)
      .slice(0, 32)
      .map((p) => ({ ...p }));
  }

  private updateRemotePlayerSmoothing(dt: number): void {
    if (
      !this.multiplayerEnabled ||
      !this.remotePlayer ||
      !this.remoteTargetSnapshot
    )
      return;
    if (this.remoteCarriedByLocal) return;
    if (this.remoteSnapshotBuffer.length === 0) return;

    const rp = this.remotePlayer;
    const renderTime = Date.now() - this.interpolationDelayMs;
    let from = this.remoteSnapshotBuffer[0];
    let to = this.remoteSnapshotBuffer[this.remoteSnapshotBuffer.length - 1];

    for (let i = 0; i < this.remoteSnapshotBuffer.length - 1; i++) {
      const a = this.remoteSnapshotBuffer[i];
      const b = this.remoteSnapshotBuffer[i + 1];
      if (a.t <= renderTime && b.t >= renderTime) {
        from = a;
        to = b;
        break;
      }
      if (b.t < renderTime) {
        from = b;
        to = b;
      }
    }

    let target = to.snapshot;
    if (to.t > from.t && renderTime >= from.t && renderTime <= to.t) {
      const alpha = (renderTime - from.t) / (to.t - from.t);
      const lerp = (a: number, b: number) => a + (b - a) * alpha;
      target = {
        ...to.snapshot,
        x: lerp(from.snapshot.x, to.snapshot.x),
        y: lerp(from.snapshot.y, to.snapshot.y),
        vx: lerp(from.snapshot.vx, to.snapshot.vx),
        vy: lerp(from.snapshot.vy, to.snapshot.vy),
      };
    } else {
      const extraMs = Math.max(0, renderTime - to.t);
      if (extraMs > 0) {
        const clamped = Math.min(MP_MAX_EXTRAPOLATION_MS, extraMs) / 1000;
        target = {
          ...to.snapshot,
          x: to.snapshot.x + to.snapshot.vx * clamped,
          y: to.snapshot.y + to.snapshot.vy * clamped,
        };
      }
    }

    const dx = target.x - rp.x;
    const dy = target.y - rp.y;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq > 680 * 680) {
      rp.x = target.x;
      rp.y = target.y;
      rp.vx = target.vx;
      rp.vy = target.vy;
    } else {
      const posAlpha = 1 - Math.exp(-dt * MP_RECONCILE_SMOOTH_SPEED);
      const velAlpha = 1 - Math.exp(-dt * 7.2);
      rp.x += dx * posAlpha;
      rp.y += dy * posAlpha;
      rp.vx += (target.vx - rp.vx) * velAlpha;
      rp.vy += (target.vy - rp.vy) * velAlpha;
    }

    rp.facingRight = target.facingRight;
    rp.onGround = target.onGround;
  }

  /** Build sequenced input commands for server ack/reconciliation tracking. */
  buildNetInputCommand(
    seq: number,
    dtMs: number,
    clientTime: number,
  ): NetInputCommand {
    return this.input.buildNetInputCommand(seq, clientTime, dtMs);
  }

  private replayPendingInputs(pendingInputs: NetInputCommand[]): void {
    if (pendingInputs.length === 0) return;

    const replay = pendingInputs.slice(-Math.min(MP_INPUT_BUFFER_SIZE, 20));
    const tuning = this.player.getMovementTuning();
    const accel = tuning.speed * 8;
    const friction = tuning.speed * 10;

    for (const cmd of replay) {
      const dt = Math.max(1 / 120, Math.min(0.11, cmd.dtMs / 1000));

      const targetVx = cmd.moveX * tuning.speed;
      if (cmd.moveX < 0) {
        this.player.vx = Math.max(this.player.vx - accel * dt, targetVx);
        this.player.facingRight = false;
      } else if (cmd.moveX > 0) {
        this.player.vx = Math.min(this.player.vx + accel * dt, targetVx);
        this.player.facingRight = true;
      } else if (this.player.vx > 0) {
        this.player.vx = Math.max(0, this.player.vx - friction * dt);
      } else if (this.player.vx < 0) {
        this.player.vx = Math.min(0, this.player.vx + friction * dt);
      }

      if (cmd.dashPressed) {
        const dashDir = this.player.facingRight ? 1 : -1;
        this.player.vx = dashDir * 600;
      }
      if (cmd.jumpPressed && this.player.onGround) {
        this.player.vy = tuning.jumpVelocity;
        this.player.onGround = false;
        this.sfx.play("jump");
      }

      this.player.vy += tuning.gravity * dt;
      if (this.player.vy > 900) this.player.vy = 900;
      this.player.x += this.player.vx * dt;
      this.player.y += this.player.vy * dt;
      if (this.player.x < 0) {
        this.player.x = 0;
        this.player.vx = 0;
      }
    }
  }

  /** Apply authoritative local snapshot from server with thresholded smooth reconciliation. */
  reconcileLocalAuthoritative(
    snapshot: NetPlayerSnapshot,
    pendingInputs: NetInputCommand[] = [],
  ): number {
    const dx = snapshot.x - this.player.x;
    const dy = snapshot.y - this.player.y;
    const error = Math.hypot(dx, dy);
    this.predictionError = error;

    if (error >= MP_RECONCILE_SNAP_THRESHOLD) {
      this.player.x = snapshot.x;
      this.player.y = snapshot.y;
      this.player.vx = snapshot.vx;
      this.player.vy = snapshot.vy;
      this.reconcileOffsetX = 0;
      this.reconcileOffsetY = 0;
      this.reconciliationCount += 1;
      this.replayPendingInputs(pendingInputs);
      return error;
    }

    if (error >= MP_RECONCILE_MEDIUM_THRESHOLD) {
      this.reconcileOffsetX = dx;
      this.reconcileOffsetY = dy;
      this.reconciliationCount += 1;
      this.replayPendingInputs(pendingInputs);
      return error;
    }

    if (error >= MP_RECONCILE_SMALL_THRESHOLD) {
      const blend = 0.18;
      this.player.x += dx * blend;
      this.player.y += dy * blend;
    }
    if (pendingInputs.length > 0) this.replayPendingInputs(pendingInputs);
    return error;
  }

  getLocalPlayerSnapshot(): NetPlayerSnapshot {
    return {
      x: this.player.x,
      y: this.player.y,
      vx: this.player.vx,
      vy: this.player.vy,
      facingRight: this.player.facingRight,
      onGround: this.player.onGround,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      alive: this.player.alive,
      characterId: this.player.characterId,
      width: this.player.width,
      height: this.player.height,
      distance: this.player.distance,
    };
  }

  getEnemySnapshots(): NetEnemySnapshot[] {
    const trackedCenters: number[] = [this.player.centerX];
    if (this.remotePlayer) trackedCenters.push(this.remotePlayer.centerX);
    if (this.remoteTargetSnapshot)
      trackedCenters.push(
        this.remoteTargetSnapshot.x + this.remoteTargetSnapshot.width * 0.5,
      );
    const syncRadius = 3600;
    return this.enemies
      .filter((enemy) =>
        trackedCenters.some(
          (centerX) => Math.abs(enemy.x - centerX) < syncRadius,
        ),
      )
      .slice(0, 120)
      .map((enemy) => ({
        id: enemy.netId,
        type: enemy.type,
        x: Math.round(enemy.x * 10) / 10,
        y: Math.round(enemy.y * 10) / 10,
        vx: Math.round(enemy.vx * 10) / 10,
        vy: Math.round(enemy.vy * 10) / 10,
        health: enemy.health,
        alive: enemy.alive,
        facingRight: enemy.facingRight,
        onGround: enemy.onGround,
      }));
  }

  applyEnemySnapshots(
    snapshots: NetEnemySnapshot[],
    options?: { version?: number; checksum?: number },
  ): void {
    if (!this.multiplayerEnabled || this.multiplayerIsHost) return;

    const version = Number.isFinite(options?.version)
      ? Math.max(0, Math.floor(options!.version as number))
      : null;
    const checksum = Number.isFinite(options?.checksum)
      ? Math.max(0, Math.floor(options!.checksum as number))
      : null;
    if (version !== null) {
      if (version < this.lastEnemyVersionApplied) return;
      if (
        version === this.lastEnemyVersionApplied &&
        checksum !== null &&
        checksum === this.lastEnemyChecksumApplied
      ) {
        return;
      }
    }

    if (
      version !== null &&
      snapshots.length === 0 &&
      version > this.lastEnemyVersionApplied
    ) {
      this.enemies = [];
      this.lastEnemyVersionApplied = version;
      this.lastEnemyChecksumApplied = checksum ?? 0;
      return;
    }

    const byId = new Map(this.enemies.map((enemy) => [enemy.netId, enemy]));
    const seen = new Set<string>();
    for (const snapshot of snapshots) {
      seen.add(snapshot.id);
      const enemy = byId.get(snapshot.id);
      if (!enemy) {
        const spawned = this.createEnemyFromSnapshot(snapshot);
        if (spawned) this.enemies.push(spawned);
        continue;
      }
      enemy.x += (snapshot.x - enemy.x) * 0.65;
      enemy.y += (snapshot.y - enemy.y) * 0.65;
      enemy.vx = snapshot.vx;
      enemy.vy = snapshot.vy;
      enemy.health = snapshot.health;
      enemy.alive = snapshot.alive;
      enemy.facingRight = snapshot.facingRight;
      enemy.onGround = snapshot.onGround;
    }

    this.enemies = this.enemies.filter((enemy) => seen.has(enemy.netId));
    if (version !== null) this.lastEnemyVersionApplied = version;
    if (checksum !== null) this.lastEnemyChecksumApplied = checksum;
  }

  killEnemiesById(ids: string[]): void {
    if (!ids.length) return;
    const set = new Set(ids);
    for (const enemy of this.enemies) {
      if (!set.has(enemy.netId) || !enemy.alive) continue;
      enemy.health = 0;
      enemy.alive = false;
    }
  }

  private recentEnemyDefeatIds: string[] = [];

  drainRecentEnemyDefeatIds(): string[] {
    if (!this.recentEnemyDefeatIds.length) return [];
    const unique = Array.from(new Set(this.recentEnemyDefeatIds));
    this.recentEnemyDefeatIds = [];
    return unique;
  }

  private handleCarryInteraction(dt: number): void {
    if (!this.multiplayerEnabled || !this.remotePlayer || !this.remotePlayerId)
      return;
    this.carryHintTimer = Math.max(0, this.carryHintTimer - dt);

    const dx = this.remotePlayer.centerX - this.player.centerX;
    const dy = this.remotePlayer.centerY - this.player.centerY;
    const nearRemote = dx * dx + dy * dy <= 140 * 140;

    if (this.input.isPressed("KeyF")) {
      if (this.remoteCarriedByLocal) {
        this.remoteCarriedByLocal = false;
        this.onCarryIntent?.({ targetId: null, dropCarry: true });
      } else if (nearRemote) {
        this.remoteCarriedByLocal = true;
        this.carryHintTimer = 1.2;
        this.onCarryIntent?.({
          targetId: this.remotePlayerId,
          dropCarry: false,
        });
      }
    }

    if (this.remoteCarriedByLocal) {
      const xOffset = this.player.facingRight ? 10 : -10;
      this.remotePlayer.x = this.player.x + xOffset;
      this.remotePlayer.y = this.player.y - this.remotePlayer.height * 0.95;
      this.remotePlayer.vx = this.player.vx;
      this.remotePlayer.vy = this.player.vy;
      this.remotePlayer.facingRight = this.player.facingRight;
      this.remotePlayer.onGround = false;
    }
  }

  private prepareOpeningFrame(): void {
    this.chunkManager.update(this.player.centerX);
    const groundY = this.getGroundY(this.player.centerX);
    if (groundY !== Infinity) {
      this.player.y = groundY - this.player.height;
      this.player.vy = 0;
      this.player.onGround = true;
    }
    this.camera.snapTo(this.player.centerX, this.player.centerY);
    this.spawnChunkEntities();
  }

  private handleResize = (): void => {
    const rawDpr = window.devicePixelRatio || 1;
    const host = this.canvas.parentElement;
    const hostRect = host?.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();

    const hostWidth = Math.floor(
      host?.clientWidth ||
        hostRect?.width ||
        canvasRect.width ||
        window.innerWidth,
    );
    const hostHeight = Math.floor(
      host?.clientHeight ||
        hostRect?.height ||
        canvasRect.height ||
        window.innerHeight,
    );
    const width = Math.max(1, hostWidth);
    const height = Math.max(1, hostHeight);
    const dpr = getCanvasRenderDpr(rawDpr, width, height);
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (
      this.canvas.width === pixelWidth &&
      this.canvas.height === pixelHeight
    ) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.renderer.resize(width, height);
      this.camera.setScreenSize(width, height);
      this.camera.snapTo(this.player.centerX, this.player.centerY);
      return;
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.clearTerrainCache();
    this.renderer.resize(width, height);
    this.camera.setScreenSize(width, height);
    this.camera.snapTo(this.player.centerX, this.player.centerY);
  };

  start(): void {
    if (this._running) return;
    this._running = true;
    this.handleResize();
    this.renderer.clearTerrainCache();
    this.prepareOpeningFrame();
    // Layout can settle one frame after mount in embedded previews.
    requestAnimationFrame(() => {
      this.handleResize();
      this.prepareOpeningFrame();
    });
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop(): void {
    this._running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy(): void {
    this.stop();
    this.input.destroy();
    window.removeEventListener("resize", this.handleResize);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    // Note: the SFX singleton is shared across engine instances and across
    // split-screen players, so we intentionally do NOT dispose it here. It is
    // cleaned up automatically when the page unloads.
  }

  private loop = (currentTime: number): void => {
    if (!this._running) return;
    this.profiler.startFrame(currentTime);

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    if (dt > 0.1) dt = 0.1;

    if (this._state === "playing") {
      this.accumulated += dt;
      if (this.accumulated > MAX_ACCUMULATED)
        this.accumulated = MAX_ACCUMULATED;

      const updateStart = performance.now();
      while (this.accumulated >= FIXED_DT) {
        this.update(FIXED_DT);
        this.accumulated -= FIXED_DT;
      }
      this.input.endFrame();
      this.profiler.recordUpdateTime(performance.now() - updateStart);
    }

    const renderStart = performance.now();
    this.render();
    this.profiler.recordRenderTime(performance.now() - renderStart);
    this.profiler.endFrame();
    this.updateAdaptiveQuality();
    this.animationId = requestAnimationFrame(this.loop);
  };

  /** Adaptive quality: adjust particle count based on FPS */
  private updateAdaptiveQuality(): void {
    if (!this.adaptiveQualityEnabled) return;

    const metrics = this.profiler.getMetrics();
    this.qualityChangeTimer += Math.min(metrics.frameTime / 1000, MAX_ACCUMULATED);

    if (this.qualityChangeTimer >= this.qualityChangeCooldown) {
      this.qualityChangeTimer = 0;

      if (metrics.fps < 30 && this.currentQualityLevel !== "low") {
        // Drop quality
        this.currentQualityLevel = "low";
        this.particles.setReducedParticles(true);
      } else if (metrics.fps > 50 && this.currentQualityLevel !== "high") {
        // Increase quality
        this.currentQualityLevel = "high";
        this.particles.setReducedParticles(false);
      } else if (
        metrics.fps >= 35 &&
        metrics.fps < 50 &&
        this.currentQualityLevel !== "medium"
      ) {
        // Medium quality
        this.currentQualityLevel = "medium";
        this.particles.setReducedParticles(false);
      }
    }
  }

  private isPlatformReplacedByFallingHazard(
    chunkId: number,
    platform: PlatformData,
  ): boolean {
    return this.hazards.some(
      (h) =>
        h.type === "falling_platform" &&
        h.chunkId === chunkId &&
        Math.abs(h.x - platform.x) < 0.5 &&
        Math.abs(h.y - platform.y) < 0.5 &&
        Math.abs(h.width - platform.width) < 0.5,
    );
  }

  private getActivePlatforms(
    rangeCenterX?: number,
    range: number = Infinity,
  ): PlatformData[] {
    const chunks = this.chunkManager.getLoadedChunks();
    const platforms: PlatformData[] = [];
    const minX = rangeCenterX !== undefined ? rangeCenterX - range : -Infinity;
    const maxX = rangeCenterX !== undefined ? rangeCenterX + range : Infinity;

    for (const chunk of chunks) {
      for (const plat of chunk.platforms) {
        if (this.isPlatformReplacedByFallingHazard(chunk.index, plat)) continue;
        if (plat.x + plat.width <= minX || plat.x >= maxX) continue;

        if (plat.moveAmp && plat.moveSpeed) {
          const offsetY =
            Math.sin(this.gameTime * plat.moveSpeed) * plat.moveAmp;
          platforms.push({ x: plat.x, y: plat.y + offsetY, width: plat.width });
        } else {
          platforms.push(plat);
        }
      }
    }

    for (const h of this.hazards) {
      if (
        h.type !== "falling_platform" ||
        h.destroyed ||
        h.falling ||
        h.vy === undefined
      )
        continue;
      if (h.x + h.width <= minX || h.x >= maxX) continue;
      platforms.push({ x: h.x, y: h.y, width: h.width });
    }

    return platforms;
  }

  private getNearbyPlatforms(): PlatformData[] {
    return this.getActivePlatforms(this.player.centerX, 600);
  }

  private getGroundY(worldX: number): number {
    const chunks = this.chunkManager.getLoadedChunks();
    const playerLeft = worldX - this.player.width / 2;
    const playerRight = worldX + this.player.width / 2;
    for (const chunk of chunks) {
      for (const cave of chunk.caves) {
        if (playerLeft < cave.x + cave.width && playerRight > cave.x) {
          const surfaceY = chunk.getHeight(cave.x - chunk.worldX);
          if (cave.y <= surfaceY + 10) return Infinity;
        }
      }
    }
    return this.chunkManager.getHeight(worldX);
  }

  private checkWallCollision(): "left" | "right" | null {
    const px = this.player.x;
    const py = this.player.y;
    const margin = 2;
    const leftY = this.chunkManager.getHeight(px - margin);
    const rightY = this.chunkManager.getHeight(px + this.player.width + margin);
    const centerBottom = py + this.player.height;
    if (leftY < centerBottom - this.player.height * 0.4 && this.player.vx < 0)
      return "left";
    if (rightY < centerBottom - this.player.height * 0.4 && this.player.vx > 0)
      return "right";
    return null;
  }

  /** Simple seeded RNG for spawning */
  private seededRng(seed: number): number {
    const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  /** Spawn enemies/collectibles/hazards for newly loaded chunks */
  private spawnChunkEntities(): void {
    const chunks = this.chunkManager.getLoadedChunks();
    const playerX = this.player.centerX;
    const spawnAheadDistance = 2400;
    const spawnBehindDistance = 1400;
    for (const chunk of chunks) {
      const chunkStart = chunk.worldX;
      const chunkEnd = chunk.worldX + 800;
      // Avoid spawning entities in very distant chunks: far-ahead entities were
      // getting cleaned up before the player arrived and never respawned.
      if (
        chunkEnd < playerX - spawnBehindDistance ||
        chunkStart > playerX + spawnAheadDistance
      ) {
        continue;
      }
      if (this.spawnedChunks.has(chunk.index)) continue;
      this.spawnedChunks.add(chunk.index);

      const plats = chunk.platforms;
      const chunkWorldX = chunk.worldX;

      // Enemies — densityMult: 0.6 at start → 1.0 at primary ramp → up to ~1.8 later
      const progressionLevel = Math.max(0, Math.floor(chunkWorldX / 2500));
      const enemySpawns = spawnEnemiesForChunk(
        chunk.index,
        plats,
        (s) => this.seededRng(s),
        chunk.heights,
        chunkWorldX,
        progressionLevel,
      );

      // Apply level config filtering: restrict enemy types and density if a level is active.
      let filteredSpawns = enemySpawns;
      if (this.levelConfig) {
        const allowedTypes = this.levelConfig.enemies.map((e) => e.toLowerCase());
        filteredSpawns = enemySpawns.filter((s) => allowedTypes.includes(s.type));
        // Apply level enemy density (0.1–1.0) to reduce/increase enemy count
        const density = this.levelConfig.enemyDensity ?? 1.0;
        filteredSpawns = filteredSpawns.filter((_, i) => this.seededRng(chunk.index * 313 + i) < density);
      }

      // Fraction of base pool to use (capped at 100% of available spawns)
      const baseCount = Math.min(
        Math.ceil(filteredSpawns.length * Math.min(this.difficulty.densityMult, 1.0)),
        filteredSpawns.length,
      );
      const baseSpawns = filteredSpawns.slice(0, baseCount);
      // Beyond 100% density: each pool enemy has a probabilistic chance to spawn a second copy
      const bonusRate = Math.max(0, this.difficulty.densityMult - 1.0);
      const bonusSpawns = bonusRate > 0
        ? filteredSpawns.filter((_, i) => this.seededRng(chunk.index * 777 + i) < bonusRate)
        : [];
      const allSpawns = [...baseSpawns, ...bonusSpawns];

      for (const spawn of allSpawns) {
        if (chunk.index === 0 && spawn.x < START_SAFE_ZONE_END) continue;
        let enemy: Enemy;
        switch (spawn.type) {
          case "slime":
            enemy = new Slime(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "beetle":
            enemy = new Beetle(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "wisp":
            enemy = new Wisp(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "bat":
            enemy = new Bat(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "mite":
            enemy = new Mite(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "jumper":
            enemy = new Jumper(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "skeleton":
            enemy = new Skeleton(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "alien":
            enemy = new Alien(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "ufo":
            enemy = new UFO(spawn.x, spawn.y, spawn.chunkId);
            break;
          case "boss":
            enemy = new Boss(spawn.x, spawn.y, spawn.chunkId);
            break;
          default:
            continue;
        }
        enemy.applyDifficulty(
          this.difficulty.speedMult,
          this.difficulty.damageMult,
          this.difficulty.healthMult,
          this.difficulty.detectRangeMult,
          this.difficulty.shootCooldownMult,
        );
        this.enemies.push(enemy);
      }

      // Collectibles
      const newCollectibles = spawnCollectiblesForChunk(
        chunk.index,
        chunkWorldX,
        800,
        plats,
        (s) => this.seededRng(s),
        chunk.heights,
        progressionLevel,
      );
      // In level mode, adjust collectible frequency based on level's powerUpFrequency.
      let adjustedCollectibles = newCollectibles;
      if (this.levelConfig) {
        const freq = this.levelConfig.powerUpFrequency ?? 1.0;
        adjustedCollectibles = newCollectibles.filter((c) => {
          if (c.type === 'coin') return true; // always keep coins
          return this.seededRng(chunk.index * 999 + c.x) < freq;
        });
      }
      this.collectibles.push(...adjustedCollectibles);

      // Hazards
      const newHazards = spawnHazardsForChunk(
        chunk.index,
        plats,
        chunk.heights,
        chunkWorldX,
        (s) => this.seededRng(s),
      );
      // In level mode, apply hazard density scaling.
      let adjustedHazards = newHazards;
      if (this.levelConfig) {
        const hDensity = this.levelConfig.hazardDensity ?? 1.0;
        adjustedHazards = newHazards.filter((_, i) => this.seededRng(chunk.index * 456 + i) < hDensity);
      }
      this.hazards.push(...adjustedHazards);

      const replacedPlatforms = adjustedHazards.filter((h) => h.type === 'falling_platform');
      if (replacedPlatforms.length > 0) {
        for (let i = chunk.platforms.length - 1; i >= 0; i--) {
          const plat = chunk.platforms[i];
          const replaced = replacedPlatforms.some(
            (h) =>
              Math.abs(h.x - plat.x) < 0.5 &&
              Math.abs(h.y - plat.y) < 0.5 &&
              Math.abs(h.width - plat.width) < 0.5,
          );
          if (replaced) chunk.platforms.splice(i, 1);
        }
      }
    }
  }

  /** Update enemy ground state from terrain */
  private updateEnemyGround(
    enemy: Enemy,
    platforms: PlatformData[],
    dt: number,
  ): void {
    const enemyBottom = enemy.y + enemy.height;
    const prevBottom = enemyBottom - enemy.vy * dt;

    let supportY = this.chunkManager.getHeight(enemy.x + enemy.width / 2);
    for (const plat of platforms) {
      if (enemy.x + enemy.width <= plat.x || enemy.x >= plat.x + plat.width)
        continue;
      // Ignore platforms that are far above the enemy to avoid snapping upward.
      if (enemyBottom > plat.y + Math.max(14, enemy.height * 0.75)) continue;
      supportY = Math.min(supportY, plat.y);
    }

    if (
      enemy.vy >= 0 &&
      supportY !== Infinity &&
      prevBottom <= supportY + 3 &&
      enemyBottom >= supportY - 3
    ) {
      enemy.y = supportY - enemy.height;
      enemy.vy = 0;
      enemy.onGround = true;
      return;
    }

    enemy.onGround = false;
  }

  private isStompCollision(enemy: Enemy, dt: number): boolean {
    if (!enemy.stompable) return false;

    const playerBottom = this.player.bottom;
    const previousBottom = playerBottom - this.player.vy * dt;
    const enemyTop = enemy.y;
    const enemyMid = enemy.y + enemy.height * 0.62;
    const topContact =
      playerBottom <= enemy.y + Math.max(10, enemy.height * 0.72);
    const centerGrace = 8;
    const horizontalCenterOverlaps =
      this.player.centerX >= enemy.x - centerGrace &&
      this.player.centerX <= enemy.x + enemy.width + centerGrace;

    // Forgiving top-half stomp: accepts fast falls, edge hits, and small enemies.
    return (
      this.player.vy > -80 &&
      horizontalCenterOverlaps &&
      (topContact ||
        previousBottom <= enemyMid ||
        this.player.centerY < enemy.y + enemy.height * 0.55) &&
      playerBottom >= enemyTop - 8
    );
  }

  private separatePlayerFromEnemy(enemy: Enemy): void {
    const playerBounds = this.player.getBounds();
    const enemyBounds = enemy.getBounds();
    const overlapX = Math.min(
      playerBounds.x + playerBounds.width - enemyBounds.x,
      enemyBounds.x + enemyBounds.width - playerBounds.x,
    );
    const overlapY = Math.min(
      playerBounds.y + playerBounds.height - enemyBounds.y,
      enemyBounds.y + enemyBounds.height - playerBounds.y,
    );
    if (overlapX <= 0 || overlapY <= 0) return;

    if (
      overlapY < overlapX &&
      this.player.centerY < enemy.y + enemy.height * 0.55
    ) {
      this.player.y = enemy.y - this.player.height - 1;
      this.player.vy = Math.min(this.player.vy, -120);
      return;
    }

    const pushDir = this.player.centerX < enemy.x + enemy.width / 2 ? -1 : 1;
    this.player.x += pushDir * (overlapX + 3);
    this.player.vx = pushDir * Math.max(180, Math.abs(this.player.vx)) * this.player.knockbackScale;
    this.player.vy = Math.min(this.player.vy, -120) * this.player.knockbackScale;
  }

  private isRemotePlayerStompCollision(dt: number): boolean {
    if (!this.multiplayerEnabled || !this.remotePlayer) return false;
    if (this.playerBounceCooldown > 0) return false;
    if (this.remoteCarriedByLocal || this.localCarriedByRemote) return false;
    if (this.player.vy <= -60) return false;

    const remote = this.remotePlayer;
    const playerBottom = this.player.bottom;
    const previousBottom = playerBottom - this.player.vy * dt;
    const remoteTop = remote.y;
    const remoteMid = remote.y + remote.height * 0.62;
    const centerGrace = 9;
    const horizontalCenterOverlaps =
      this.player.centerX >= remote.x - centerGrace &&
      this.player.centerX <= remote.x + remote.width + centerGrace;

    return (
      horizontalCenterOverlaps &&
      (previousBottom <= remoteMid ||
        this.player.centerY < remote.y + remote.height * 0.58) &&
      playerBottom >= remoteTop - 8
    );
  }

  private awardEnemyDefeat(enemy: Enemy): void {
    const basePts = KILL_SCORES[enemy.type] ?? 100;
    const prevMultiplier = this.getComboMultiplier();
    this.comboCount += 1;
    if (this.comboCount > this.maxCombo) this.maxCombo = this.comboCount;
    this.comboTimer = this.COMBO_DECAY_SECONDS;
    const multiplier = this.getComboMultiplier();
    const pts = Math.round(basePts * multiplier);
    this.player.score += pts;
    this.enemiesDefeated += 1;
    this.particles.spawnEnemyDeath(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
    this.sfx.play("enemyDefeat");

    // Combo tier milestone — celebrate when the multiplier increases.
    if (multiplier > prevMultiplier && multiplier >= 2) {
      this.particles.spawnScorePopup(
        this.player.centerX,
        this.player.y - 28,
        `COMBO x${multiplier}!`,
        '#22c55e',
      );
      // Quick burst to visually reinforce the tier-up.
      this.camera.shake(3, 0.15);
      this.sfx.play("comboTier");
    }

    const popupText = multiplier > 1 ? `+${pts} x${multiplier}` : `+${pts}`;
    this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y, popupText, multiplier > 1 ? '#fbbf24' : undefined);
    if (this.multiplayerEnabled && !this.multiplayerIsHost) {
      this.recentEnemyDefeatIds.push(enemy.netId);
    }
  }

  /** Returns the current combo multiplier based on combo count. */
  private getComboMultiplier(): number {
    return comboMultiplierFor(this.comboCount);
  }

  private handleUfoAbduction(enemy: UFO, dt: number): void {
    if (!enemy.beamActive) return;

    const beam = enemy.getBeamBounds();
    const playerBounds = this.player.getBounds();
    if (!aabbOverlap(playerBounds, beam, -2)) return;

    if (this.player.shieldActive) {
      this.player.shieldActive = false;
      this.player.shieldTimer = 0;
      enemy.disrupt();
      this.camera.shake(4, 0.2);
      this.particles.spawnScorePopup(
        enemy.x + enemy.width / 2,
        enemy.y - 8,
        "DISRUPT!",
        "#67e8f9",
      );
      if (!enemy.alive) this.awardEnemyDefeat(enemy);
      return;
    }

    const beamCenterX = beam.x + beam.width / 2;
    const pullX = Math.max(
      -90,
      Math.min(90, (beamCenterX - this.player.centerX) * 1.8),
    );
    this.player.vx += pullX * dt;
    this.player.vy = Math.max(this.player.vy - 620 * dt, -360);
    this.player.onGround = false;

    if (
      this.player.centerY < enemy.y + enemy.height + 22 &&
      this.player.takeDamage(enemy.effectiveDamage)
    ) {
      this.player.vy = 180;
      enemy.disrupt();
      this.camera.shake(5, 0.25);
      this.particles.spawnHitFlash(this.player.centerX, this.player.centerY);
      this.particles.spawnScorePopup(
        this.player.centerX,
        this.player.y - 12,
        "ABDUCTED!",
        "#22d3ee",
      );
      this.sfx.play("damage");
    }
  }

  private update(dt: number): void {
    this.gameTime += dt;
    this.playerBounceCooldown = Math.max(0, this.playerBounceCooldown - dt);

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    }

    // Update chunks — use a position slightly ahead of the player so enemies spawn in view.
    const lookAheadPx =
      this.camera.x + this.camera.renderX > 0
        ? Math.max(
            this.player.centerX,
            this.camera.x + this.camera.viewportWidth * 0.6,
          )
        : this.player.centerX;
    this.chunkManager.update(lookAheadPx);

    // Spawn entities for new chunks
    this.spawnChunkEntities();

    // Cleanup far-away entities
    const px = this.player.centerX;
    const cleanupRange = 3000;
    // Also clean up enemy projectiles before removing enemies
    for (const enemy of this.enemies) {
      if (!enemy.alive || Math.abs(enemy.x - px) >= cleanupRange) {
        const maybeProjectiles = (enemy as Enemy & { projectiles?: unknown })
          .projectiles;
        if (Array.isArray(maybeProjectiles)) {
          maybeProjectiles.length = 0;
        }
      }
    }
    this.enemies = this.enemies.filter(
      (e) => e.alive && Math.abs(e.x - px) < cleanupRange,
    );
    this.collectibles = this.collectibles.filter(
      (c) => !c.collected && Math.abs(c.x - px) < cleanupRange,
    );
    this.hazards = this.hazards.filter(
      (h) => !h.destroyed && Math.abs(h.x - px) < cleanupRange,
    );

    // Cleanup spawned chunks tracking — only remove indices far behind the player so
    // backtracking up to ~18 chunks (14400px) doesn't re-spawn entities.
    const playerChunkIdx = Math.floor(this.player.centerX / 800);
    for (const spawnedIndex of Array.from(this.spawnedChunks)) {
      if (spawnedIndex < playerChunkIdx - 18) {
        this.spawnedChunks.delete(spawnedIndex);
      }
    }

    // Ground & platforms
    const groundY = this.getGroundY(this.player.centerX);
    const platforms = this.getNearbyPlatforms();
    const enemyPlatforms = this.getActivePlatforms();

    const wallSide = this.checkWallCollision();
    this.player.touchingWall = wallSide !== null;
    if (wallSide === "left") this.player.facingRight = false;
    if (wallSide === "right") this.player.facingRight = true;

    const carriedByRemote =
      this.multiplayerEnabled &&
      this.localCarriedByRemote &&
      !!this.remotePlayer;
    this.wasOnGround = this.player.onGround;
    if (carriedByRemote && this.remotePlayer) {
      const xOffset = this.remotePlayer.facingRight ? 12 : -12;
      this.player.x = this.remotePlayer.x + xOffset;
      this.player.y = this.remotePlayer.y - this.player.height * 0.92;
      this.player.vx = this.remotePlayer.vx;
      this.player.vy = this.remotePlayer.vy;
      this.player.onGround = false;
      this.player.facingRight = this.remotePlayer.facingRight;
    } else {
      this.player.update(dt, this.input, groundY, platforms);

      // Landing particles + SFX
      if (this.player.onGround && !this.wasOnGround) {
        this.particles.spawnLanding(this.player.centerX, this.player.bottom);
        this.sfx.play("land");
      }

      // Jump dust particles
      const jumpPressed =
        this.input.isPressed("Space") ||
        this.input.isPressed("ArrowUp") ||
        this.input.isPressed("KeyW");
      if (jumpPressed && (this.player.onGround || this.player.vy < -100)) {
        this.particles.spawnJumpDust(this.player.centerX, this.player.bottom);
      }
    }

    // Wall collision
    if (!carriedByRemote && wallSide) {
      const wallX =
        wallSide === "left"
          ? this.player.x - 1
          : this.player.x + this.player.width + 1;
      const wallY = this.chunkManager.getHeight(wallX);
      if (
        wallY <
        this.player.y + this.player.height - this.player.height * 0.35
      ) {
        if (wallSide === "left" && this.player.x > 0) {
          this.player.x = wallX + 1;
          this.player.vx = 0;
        } else if (wallSide === "right") {
          this.player.x = wallX - this.player.width - 1;
          this.player.vx = 0;
        }
      }
    }

    // Difficulty
    this.difficulty = getDifficulty(this.player.distanceTraveled);

    // Distance-based scoring — gain 1 point per 50 pixels traveled
    const prevDistance = this.player.distance;
    this.player.distance = Math.max(
      this.player.distance,
      Math.floor(this.player.x / 50),
    );
    if (this.player.distance > prevDistance) {
      this.player.score += this.player.distance - prevDistance;
    }

    this.ghostSampleTimer += dt;
    if (this.ghostSampleTimer >= 0.12) {
      this.ghostSampleTimer = 0;
      this.ghostRecording.push({
        distance: this.player.distance,
        x: this.player.x,
        y: this.player.y,
      });
      if (this.ghostRecording.length > 8000) {
        this.ghostRecording.splice(0, this.ghostRecording.length - 8000);
      }
    }

    if (
      Math.abs(this.reconcileOffsetX) > 0.01 ||
      Math.abs(this.reconcileOffsetY) > 0.01
    ) {
      const pull = 1 - Math.exp(-dt * MP_RECONCILE_SMOOTH_SPEED);
      const ox = this.reconcileOffsetX * pull;
      const oy = this.reconcileOffsetY * pull;
      this.player.x += ox;
      this.player.y += oy;
      this.reconcileOffsetX -= ox;
      this.reconcileOffsetY -= oy;
    }

    this.updateRemotePlayerSmoothing(dt);
    this.handleCarryInteraction(dt);
    this.onLocalPlayerSnapshot?.(this.getLocalPlayerSnapshot());

    if (this.isRemotePlayerStompCollision(dt) && this.remotePlayer) {
      const remote = this.remotePlayer;
      const wantsBoostedBounce =
        this.input.isDown("Space") ||
        this.input.isDown("ArrowUp") ||
        this.input.isDown("KeyW");
      this.player.y = Math.min(
        this.player.y,
        remote.y - this.player.height - 1,
      );
      this.player.stompBounce(wantsBoostedBounce);
      remote.vy = Math.max(remote.vy, 120);
      this.playerBounceCooldown = 0.18;
      this.camera.shake(1.6, 0.1);
      this.particles.spawnLanding(
        this.player.centerX,
        Math.min(this.player.bottom, remote.y + 2),
      );
      this.particles.spawnScorePopup(
        this.player.centerX,
        this.player.y - 8,
        "BOUNCE!",
        "#93c5fd",
      );
    }

    // Update falling platforms
    for (const h of this.hazards) {
      if (h.type !== "falling_platform" || h.destroyed) continue;
      // Check if player is standing on it
      if (h.vy !== undefined) {
        if (!h.falling) {
          if (
            this.player.x + this.player.width > h.x &&
            this.player.x < h.x + h.width &&
            Math.abs(this.player.y + this.player.height - h.y) < 4 &&
            this.player.onGround
          ) {
            h.crumbleTimer = (h.crumbleTimer ?? 0) + dt;
            if (h.crumbleTimer > 0.5) {
              h.falling = true;
            }
          }
        } else {
          h.vy = (h.vy ?? 0) + 800 * dt;
          h.y += h.vy * dt;
          if (h.y > 2000) h.destroyed = true;
        }
      }
    }

    // Update enemies
    const playerBounds = this.player.getBounds();
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;

      if (!this.multiplayerEnabled || this.multiplayerIsHost) {
        enemy.update(dt, this.player.centerX, this.player.centerY);
        this.updateEnemyGround(enemy, enemyPlatforms, dt);
        if (enemy instanceof UFO) this.handleUfoAbduction(enemy, dt);
      }

      // Enemy-player collision — shrink player hitbox 4px for forgiving feel
      if (aabbOverlap(playerBounds, enemy.getBounds(), 4)) {
        const isStomp = this.isStompCollision(enemy, dt);

        if (isStomp) {
          enemy.takeDamage(1);
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
          const wantsBoostedBounce =
            this.input.isDown("Space") ||
            this.input.isDown("ArrowUp") ||
            this.input.isDown("KeyW");
          this.player.stompBounce(wantsBoostedBounce);
          this.camera.shake(2, 0.12);
          this.particles.spawnLanding(
            this.player.centerX,
            Math.min(this.player.bottom, enemy.y + 2),
          );
        } else if (this.player.dashing) {
          enemy.takeDamage(2);
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
        } else if (this.player.shieldActive) {
          this.player.shieldActive = false;
          this.player.shieldTimer = 0;
          enemy.takeDamage(enemy.stompable ? 1 : 2);
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
          const kb = (this.player.centerX < enemy.x ? -180 : 180) * this.player.knockbackScale;
          this.player.vx = kb;
          this.player.vy = -180 * this.player.knockbackScale;
          this.camera.shake(4, 0.18);
          this.particles.spawnScorePopup(
            enemy.x + enemy.width / 2,
            enemy.y,
            "SHIELD BASH!",
            "#67e8f9",
          );
          this.sfx.play("shieldBreak");
        } else {
          if (this.player.takeDamage(enemy.effectiveDamage)) {
            const kb = (this.player.centerX < enemy.x ? -200 : 200) * this.player.knockbackScale;
            this.player.vx = kb;
            this.player.vy = -250 * this.player.knockbackScale;
            this.camera.shake(6, 0.3);
            this.particles.spawnHitFlash(this.player.centerX, this.player.centerY);
            this.particles.spawnScorePopup(
              this.player.centerX,
              this.player.y - 10,
              "-1 ♥",
              "#ef4444",
            );
            this.sfx.play("damage");
            this.separatePlayerFromEnemy(enemy);
          } else {
            this.separatePlayerFromEnemy(enemy);
          }
        }
      }

      // Player projectiles hitting enemies
      for (const proj of this.player.projectiles) {
        const size = proj.radius * 2;
        if (
          aabbOverlap(
            {
              x: proj.x - proj.radius,
              y: proj.y - proj.radius,
              width: size,
              height: size,
            },
            enemy.getBounds(),
          )
        ) {
          enemy.takeDamage(proj.damage);
          proj.life = 0;
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
        }
      }

      // Skeleton/Boss projectiles hitting player
      if ("projectiles" in enemy && Array.isArray(enemy.projectiles)) {
        for (const proj of enemy.projectiles as {
          x: number;
          y: number;
          width: number;
          height: number;
          life: number;
          damage: number;
        }[]) {
          if (proj.life <= 0) continue;
          if (
            aabbOverlap(
              {
                x: proj.x - proj.width / 2,
                y: proj.y - proj.height / 2,
                width: proj.width,
                height: proj.height,
              },
              playerBounds,
            )
          ) {
            if (this.player.takeDamage(proj.damage)) {
              proj.life = 0;
              this.particles.spawnHitFlash(this.player.centerX, this.player.centerY);
              this.particles.spawnScorePopup(
                this.player.centerX,
                this.player.y - 10,
                "-1 ♥",
                "#ef4444",
              );
              this.sfx.play("damage");
            }
          }
        }
      }
    }

    // Spike hazards — use tighter hitbox (shrink by 4px) and respect invulnerability
    for (const h of this.hazards) {
      if (h.type !== "spike") continue;
      if (
        aabbOverlap(
          playerBounds,
          { x: h.x, y: h.y, width: h.width, height: h.height },
          4,
        )
      ) {
        if (this.player.takeDamage(1)) {
          this.player.vy = -300;
          this.camera.shake(5, 0.25);
          this.particles.spawnHitFlash(this.player.centerX, this.player.centerY);
          this.particles.spawnScorePopup(
            this.player.centerX,
            this.player.y - 10,
            "-1 ♥",
            "#ef4444",
          );
          this.sfx.play("damage");
        }
      }
    }

    // Collectibles
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.animTimer += dt;

      // Magnet attraction
      if (this.player.magnetActive && c.type === "coin") {
        const dx = this.player.centerX - (c.x + c.width / 2);
        const dy = this.player.centerY - (c.y + c.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < this.player.magnetRadius && dist > 0) {
          c.x += (dx / dist) * 400 * dt;
          c.y += (dy / dist) * 400 * dt;
        }
      }

      // Collectible collision — generous hitbox (don't shrink, use full overlap)
      const playerCollectBounds = {
        x: playerBounds.x - 4,
        y: playerBounds.y - 4,
        width: playerBounds.width + 8,
        height: playerBounds.height + 8,
      };
      if (aabbOverlap(playerCollectBounds, c)) {
        c.collected = true;
        switch (c.type) {
          case "coin":
            this.player.addCoins(1);
            this.particles.spawnCoinSparkle(
              c.x + c.width / 2,
              c.y + c.height / 2,
            );
            this.particles.spawnScorePopup(c.x, c.y, "+10", "#fbbf24");
            this.sfx.play("coin");
            break;
          case "health":
            if (this.player.health < this.player.maxHealth) {
              this.player.heal(1);
              this.particles.spawnScorePopup(c.x, c.y, "+1 ♥", "#22c55e");
            } else {
              this.particles.spawnScorePopup(c.x, c.y, "FULL!", "#86efac");
            }
            this.sfx.play("powerup");
            break;
          case "speedBoost":
            this.player.applySpeedBoost(1.5, c.value);
            this.particles.spawnScorePopup(c.x, c.y, "SPEED!", "#3b82f6");
            this.sfx.play("powerup");
            break;
          case "doubleJump":
            this.player.restoreDoubleJump();
            this.particles.spawnScorePopup(c.x, c.y, "2x JUMP!", "#a855f7");
            this.sfx.play("powerup");
            break;
          case "shield":
            this.player.applyShield(c.value * 8);
            this.particles.spawnScorePopup(c.x, c.y, "SHIELD!", "#06b6d4");
            this.sfx.play("powerup");
            break;
          case "magnet":
            this.player.applyMagnet(c.value);
            this.particles.spawnScorePopup(c.x, c.y, "MAGNET!", "#f59e0b");
            this.sfx.play("powerup");
            break;
          case "slingshot":
            this.player.equipWeapon("slingshot", c.value);
            this.particles.spawnScorePopup(c.x, c.y, "SLINGSHOT!", "#f59e0b");
            this.sfx.play("powerup");
            break;
          case "bow":
            this.player.equipWeapon("bow", c.value);
            this.particles.spawnScorePopup(c.x, c.y, "BOW UP!", "#eab308");
            this.sfx.play("powerup");
            break;
          case "healingAura":
            this.player.applyHealingAura(c.value);
            this.particles.spawnScorePopup(c.x, c.y, "HEAL AURA!", "#14b8a6");
            this.sfx.play("powerup");
            break;
          case "portal": {
            const targetX = c.portalTargetX ?? c.x + 640;
            this.chunkManager.update(targetX + 400);
            this.spawnChunkEntities();
            const arrivalGround = this.getGroundY(targetX);
            const fallbackGround = this.chunkManager.getHeight(targetX);
            const safeGround = Number.isFinite(arrivalGround)
              ? arrivalGround
              : Number.isFinite(fallbackGround)
                ? fallbackGround
                : this.player.y + this.player.height;
            this.player.x = targetX;
            this.player.y = safeGround - this.player.height;
            this.player.vx = Math.max(this.player.vx, 160);
            this.player.vy = -120;
            this.player.onGround = false;
            this.camera.shake(4, 0.2);
            const flavor =
              c.portalFlavor === "bunker" ? "BUNKER ROUTE!" : "SHORTCUT!";
            this.particles.spawnScorePopup(c.x, c.y - 10, flavor, "#22c55e");
            this.particles.spawnScorePopup(
              targetX,
              safeGround - 22,
              "WARP +",
              "#86efac",
            );
            break;
          }
        }
      }
    }

    // Camera
    this.camera.update(this.player.centerX, this.player.centerY, dt);

    // Particles
    const biome = getBiomeAt(this.player.centerX);
    const screenW = this.camera.viewportWidth;
    const screenH = this.camera.viewportHeight;
    this.particles.update(
      this.camera.x,
      this.camera.y,
      screenW,
      screenH,
      biome.type,
      dt,
    );

    // Level mode: target distance / time limit completion.
    if (this.levelConfig && !this.levelCompleted) {
      if (this.levelConfig.timeLimit !== null) {
        this.levelTimeRemaining = Math.max(0, this.levelTimeRemaining - dt);
        if (
          this.levelTimeRemaining <= 0 &&
          this.player.distance < this.levelConfig.targetDistance
        ) {
          this.player.alive = false;
        }
      }

      if (this.player.distance >= this.levelConfig.targetDistance) {
        this.levelCompleted = true;
        this._state = "paused";
        this.sfx.play("levelComplete");
        this.onLevelComplete?.({
          score: Math.max(0, Math.floor(this.player.score)),
          coins: Math.max(0, Math.floor(this.player.coins)),
          distance: Math.max(0, Math.floor(this.player.distance)),
          timeMs: Math.max(0, Math.floor(this.gameTime * 1000)),
          enemiesDefeated: this.enemiesDefeated,
        });
        return;
      }
    }

    // Death by falling
    if (this.player.y > 1500) {
      this.player.alive = false;
    }

    if (!this.player.alive && this.player.tryAutoRevive()) {
      this.placePlayerOnSafeReviveGround();
      this.camera.shake(4, 0.25);
      this.particles.spawnScorePopup(
        this.player.centerX,
        this.player.y - 10,
        "REVIVE!",
        "#f97316",
      );
    }

    if (!this.player.alive && this.player.tryCoinRevive(25)) {
      this.placePlayerOnSafeReviveGround();
      this.camera.shake(5, 0.3);
      this.particles.spawnScorePopup(
        this.player.centerX,
        this.player.y - 10,
        "REVIVE -25 🪙 +1 ♥",
        "#fbbf24",
      );
    }

    // Lives system: spend a life to respawn instead of going straight to game over.
    if (!this.player.alive && this.player.lives > 0) {
      this.player.lives -= 1;
      this.player.alive = true;
      this.player.health = this.player.maxHealth;
      this.player.invulnerable = true;
      this.player.invulnerableTimer = 2.5;
      this.player.score = Math.max(0, this.player.score - 50); // small death penalty
      this.placePlayerOnSafeReviveGround();
      this.player.vx = 0;
      this.player.vy = -200;
      this.player.onGround = false;
      this.camera.shake(4, 0.3);
      this.particles.spawnScorePopup(this.player.centerX, this.player.y - 10, `${this.player.lives} LIVE${this.player.lives === 1 ? '' : 'S'} LEFT`, '#f97316');
    }

    if (!this.player.alive) {
      this._state = "gameover";
      this.camera.shake(8, 0.5);
      this.sfx.play("gameOver");
      this.onGameOver?.();
    }

    // Power-ups for HUD
    const powerUps: string[] = [];
    if (this.player.shieldActive) powerUps.push("🛡️");
    if (this.player.magnetActive) powerUps.push("🧲");
    if (this.player.speedBoostTimer > 0) powerUps.push("⚡");
    if (
      this.player.currentWeapon === "slingshot" &&
      this.player.hasWeaponPickup
    )
      powerUps.push("🎯");
    if (
      this.player.currentWeapon === "bow" &&
      (this.player.hasWeaponPickup || this.player.characterId === "ranger")
    )
      powerUps.push("🏹");
    if (this.player.healingAuraActive) powerUps.push("💚");

    const profilerMetrics = this.profiler.getMetrics();

    this.onStatsUpdate?.({
      score: this.player.score,
      coins: this.player.coins,
      distance: this.player.distance,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      lives: this.player.lives,
      biome: biome.name,
      powerUps,
      fps: profilerMetrics.fps,
      comboCount: this.comboCount,
      comboMultiplier: this.getComboMultiplier(),
      maxCombo: this.maxCombo,
      comboTimeRemaining: this.comboTimer > 0 ? this.comboTimer : 0,
      enemiesDefeated: this.enemiesDefeated,
      dayPhase: this.getDayPhase(),
      ...(this.levelConfig
        ? {
            levelTimeRemaining:
              this.levelConfig.timeLimit !== null
                ? this.levelTimeRemaining
                : undefined,
            levelTarget: this.levelConfig.targetDistance,
          }
        : {}),
    });

    this.onNetworkDebug?.({
      predictionError: this.predictionError,
      reconciliationCount: this.reconciliationCount,
      interpolationDelayMs: this.interpolationDelayMs,
      remoteBufferSize: this.remoteSnapshotBuffer.length,
    });
  }

  /** Place player on safe ground after reviving (handles falling deaths). */
  private placePlayerOnSafeReviveGround(): void {
    if (this.player.y > 1200) {
      const reviveGround = this.getGroundY(this.player.centerX);
      this.player.y = Number.isFinite(reviveGround)
        ? reviveGround - this.player.height - 8
        : 300;
    }
  }

  /** Day/night cycle — based on game time, full cycle every 120s. */
  private getDayPhase(): 'dawn' | 'day' | 'dusk' | 'night' {
    const cycleSeconds = 120;
    const phase = (this.gameTime % cycleSeconds) / cycleSeconds; // 0.0–1.0
    if (phase < 0.15) return 'dawn';
    if (phase < 0.50) return 'day';
    if (phase < 0.65) return 'dusk';
    return 'night';
  }

  private render(): void {
    const ctx = this.ctx;
    let width = this.camera.viewportWidth;
    let height = this.camera.viewportHeight;
    if (width <= 2 || height <= 2) {
      this.handleResize();
      width = this.camera.viewportWidth;
      height = this.camera.viewportHeight;
    }
    ctx.clearRect(0, 0, width, height);

    const chunks = this.chunkManager.getLoadedChunks();

    this.renderer.drawSky(this.camera);
    this.renderer.drawParallax(this.camera);
    this.renderer.drawTerrain(chunks, this.camera);
    this.renderer.drawPlatforms(chunks, this.camera, this.gameTime);
    this.renderer.drawDecorations(chunks, this.camera);

    // Hazards - frustum culling
    for (const h of this.hazards) {
      if (!this.camera.isVisible(h.x, h.y, h.width, h.height)) continue;
      renderHazard(ctx, h, this.camera.renderX, this.camera.renderY);
    }

    // Collectibles - frustum culling
    for (const c of this.collectibles) {
      if (c.collected) continue;
      if (!this.camera.isVisible(c.x, c.y, c.width, c.height)) continue;
      this.renderer.drawCollectible(c, this.camera);
    }

    // Enemies - frustum culling
    for (const enemy of this.enemies) {
      if (!enemy.alive) continue;
      if (!this.camera.isVisible(enemy.x, enemy.y, enemy.width, enemy.height))
        continue;
      enemy.render(ctx, this.camera.renderX, this.camera.renderY);
    }

    // Player projectiles
    for (const p of this.player.projectiles) {
      const sx = p.x - this.camera.renderX;
      const sy = p.y - this.camera.renderY;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = p.glowColor;
      ctx.beginPath();
      ctx.arc(sx, sy, p.radius + 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (this.multiplayerEnabled && this.remoteProjectiles.length > 0) {
      for (const p of this.remoteProjectiles) {
        const sx = p.x - this.camera.renderX;
        const sy = p.y - this.camera.renderY;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = p.glowColor;
        ctx.beginPath();
        ctx.arc(sx, sy, p.radius + 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Personal best ghost
    if (this.ghostPlayback.length > 0) {
      const currentDistance = this.player.distance;
      while (
        this.ghostPlaybackIndex < this.ghostPlayback.length - 1 &&
        this.ghostPlayback[this.ghostPlaybackIndex + 1].distance <=
          currentDistance
      ) {
        this.ghostPlaybackIndex += 1;
      }
      const ghost = this.ghostPlayback[this.ghostPlaybackIndex];
      if (ghost) {
        const gx = ghost.x - this.camera.renderX;
        const gy = ghost.y - this.camera.renderY;
        ctx.save();
        ctx.globalAlpha = 0.34;
        ctx.fillStyle = "#93c5fd";
        ctx.beginPath();
        ctx.roundRect(gx, gy, this.player.width, this.player.height, 6);
        ctx.fill();
        ctx.restore();
      }
    }

    // Player
    this.renderer.drawPlayer(this.player, this.camera);

    if (
      this.multiplayerEnabled &&
      this.remotePlayer &&
      this.remotePlayer.alive
    ) {
      this.renderer.drawPlayer(this.remotePlayer, this.camera);
      const rsx =
        this.remotePlayer.x - this.camera.renderX + this.remotePlayer.width / 2;
      const rsy = this.remotePlayer.y - this.camera.renderY - 8;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(rsx - 48, rsy - 12, 96, 14);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.remotePlayerName ?? "Peer", rsx, rsy - 5);
    }

    // Shield visual
    if (this.player.shieldActive) {
      const sx = this.player.x - this.camera.renderX + this.player.width / 2;
      const sy = this.player.y - this.camera.renderY + this.player.height / 2;
      ctx.strokeStyle = "#06b6d480";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, this.player.width * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#06b6d415";
      ctx.fill();
    }

    if (this.player.healingAuraActive) {
      const sx = this.player.x - this.camera.renderX + this.player.width / 2;
      const sy = this.player.y - this.camera.renderY + this.player.height / 2;
      ctx.strokeStyle = "#14b8a680";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, this.player.width * 1.05, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Dash trail
    if (this.player.dashing) {
      ctx.fillStyle = "#4488cc40";
      const sx =
        this.player.x - this.camera.renderX - this.player.dashDirection * 20;
      const sy = this.player.y - this.camera.renderY;
      ctx.fillRect(sx, sy, this.player.width, this.player.height);
    }

    if (
      this.multiplayerEnabled &&
      this.remotePlayer &&
      this.remotePlayer.alive &&
      this.carryHintTimer > 0
    ) {
      ctx.fillStyle = "rgba(15,23,42,0.7)";
      ctx.fillRect(width / 2 - 120, height - 96, 240, 34);
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const hint = this.remoteCarriedByLocal
        ? "Press F to drop your teammate"
        : "Press F near teammate to pick them up";
      ctx.fillText(hint, width / 2, height - 79);
    }

    this.renderer.drawParticles(this.particles.getParticles(), this.camera);

    // Day/night tint overlay
    const phase = this.getDayPhase();
    if (phase === 'night') {
      ctx.fillStyle = 'rgba(10, 14, 40, 0.38)';
      ctx.fillRect(0, 0, width, height);
    } else if (phase === 'dusk') {
      ctx.fillStyle = 'rgba(60, 30, 10, 0.18)';
      ctx.fillRect(0, 0, width, height);
    } else if (phase === 'dawn') {
      ctx.fillStyle = 'rgba(80, 50, 20, 0.12)';
      ctx.fillRect(0, 0, width, height);
    }

    // Pause overlay
    if (this._state === "paused") {
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      ctx.fillRect(0, 0, width, height);
    }
  }
}
