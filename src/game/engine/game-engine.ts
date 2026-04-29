/**
 * Main game engine — ties everything together.
 * Manages the game loop, updates all systems, and renders each frame.
 */

import { Camera, DEFAULT_CAMERA_CONFIG } from './camera';
import { ChunkManager } from '../world/chunk-manager';
import { InputManager } from '../input/input';
import { Player, DEFAULT_PLAYER_CONFIG } from '../entities/player';
import { Enemy } from '../entities/Enemy';
import { Slime } from '../entities/Slime';
import { Beetle } from '../entities/Beetle';
import { Wisp } from '../entities/Wisp';
import { Bat } from '../entities/Bat';
import { Mite } from '../entities/Mite';
import { Skeleton } from '../entities/Skeleton';
import { Jumper } from '../entities/Jumper';
import { Boss } from '../entities/Boss';
import { Alien } from '../entities/Alien';
import { UFO } from '../entities/UFO';
import { ParticleSystem } from '../entities/particles';
import { GameRenderer } from '../rendering/renderer';
import { getBiomeAt } from '../world/biomes';
import { getDifficulty } from '../difficulty';
import type { Collectible } from '../entities/Collectibles';
import { spawnCollectiblesForChunk, spawnEnemiesForChunk } from '../entities/Collectibles';
import { spawnHazardsForChunk, renderHazard, type Hazard } from '../hazards';
import { getCharacterById } from '../data/characters';
import type { Platform as PlatformData } from '../world/chunk';
import { PerformanceProfiler } from './performance-profiler';
import { EntityPools } from './entity-pools';
import type { NetPlayerSnapshot } from '../multiplayer/types';

const FIXED_DT = 1 / 60;
const MAX_ACCUMULATED = 0.1;
const START_SAFE_ZONE_END = 760;

export type EngineState = 'playing' | 'paused' | 'gameover';

export interface RemotePlayerViewState {
  id: string;
  name: string;
  snapshot: NetPlayerSnapshot;
  carryTargetId: string | null;
  carriedById: string | null;
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

  return ax < b.x + b.width && ax + aw > b.x && ay < b.y + b.height && ay + ah > b.y;
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

  // Adaptive quality
  private adaptiveQualityEnabled = true;
  private currentQualityLevel = 'high'; // 'high', 'medium', 'low'
  private qualityChangeTimer = 0;
  private qualityChangeCooldown = 2.0; // seconds between quality changes

  private animationId: number | null = null;
  private lastTime = 0;
  private accumulated = 0;
  private _running = false;
  private _state: EngineState = 'playing';

  worldSeed = 42;
  difficulty = getDifficulty(0);

  onGameOver?: () => void;
  onStatsUpdate?: (stats: { score: number; coins: number; distance: number; health: number; maxHealth: number; biome: string; powerUps: string[]; fps: number }) => void;
  onLocalPlayerSnapshot?: (snapshot: NetPlayerSnapshot) => void;
  onCarryIntent?: (payload: { targetId: string | null; dropCarry: boolean }) => void;

  private wasOnGround = true;

  // Entity management
  private enemies: Enemy[] = [];
  private collectibles: Collectible[] = [];
  private hazards: Hazard[] = [];

  // Track which chunks have spawned entities
  private spawnedChunks = new Set<number>();

  // Game time for animations
  private gameTime = 0;

  private _characterId: string = 'knight';
  private multiplayerEnabled = false;
  private multiplayerPlayerId: string | null = null;
  private remotePlayerId: string | null = null;
  private remotePlayerName: string | null = null;
  private remotePlayer: Player | null = null;
  private remoteCarriedByLocal = false;
  private localCarriedByRemote = false;
  private carryHintTimer = 0;

  constructor(canvas: HTMLCanvasElement, seed?: number, characterId?: string) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    if (seed !== undefined) this.worldSeed = seed;
    if (characterId) this._characterId = characterId;

    this.input = new InputManager();
    this.camera = new Camera(DEFAULT_CAMERA_CONFIG);
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.player.applyCharacter(getCharacterById(this._characterId));
    this.player.setDoubleJump(true);
    this.particles = new ParticleSystem();
    this.renderer = new GameRenderer(this.ctx);

    // Initialize performance and entity pools
    this.profiler = new PerformanceProfiler();
    this.entityPools = new EntityPools();

    this.handleResize();
    this.prepareOpeningFrame();
    window.addEventListener('resize', this.handleResize);
  }

  get state(): EngineState { return this._state; }

  pause(): void { this._state = 'paused'; }
  resume(): void { this._state = 'playing'; this.lastTime = performance.now(); this.accumulated = 0; }

  setSeed(seed: number, characterId?: string): void {
    this.worldSeed = seed;
    if (characterId) this._characterId = characterId;
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.player.applyCharacter(getCharacterById(this._characterId));
    this.player.setDoubleJump(true);
    this.particles.clear();
    this.entityPools.clear();
    this.profiler.reset();
    this.renderer.clearTerrainCache();
    this.enemies = [];
    this.collectibles = [];
    this.hazards = [];
    this.spawnedChunks.clear();
    this._state = 'playing';
    this.difficulty = getDifficulty(0);
    this.wasOnGround = true;
    this.currentQualityLevel = 'high';
    this.particles.setReducedParticles(false);
    this.gameTime = 0;
    this.remotePlayer = null;
    this.remotePlayerId = null;
    this.remotePlayerName = null;
    this.remoteCarriedByLocal = false;
    this.localCarriedByRemote = false;
    this.carryHintTimer = 0;
    this.prepareOpeningFrame();
    // Reset timing to avoid first-frame spike after restart
    this.lastTime = performance.now();
    this.accumulated = 0;
  }

  setMultiplayerEnabled(enabled: boolean, localPlayerId?: string | null): void {
    this.multiplayerEnabled = enabled;
    this.multiplayerPlayerId = localPlayerId ?? null;
    if (!enabled) {
      this.remotePlayer = null;
      this.remotePlayerId = null;
      this.remotePlayerName = null;
      this.remoteCarriedByLocal = false;
      this.localCarriedByRemote = false;
      this.carryHintTimer = 0;
    }
  }

  setRemotePlayerState(remote: RemotePlayerViewState | null): void {
    if (!this.multiplayerEnabled || !remote) {
      this.remotePlayer = null;
      this.remotePlayerId = null;
      this.remotePlayerName = null;
      this.remoteCarriedByLocal = false;
      this.localCarriedByRemote = false;
      return;
    }

    this.remotePlayerId = remote.id;
    this.remotePlayerName = remote.name;
    this.remoteCarriedByLocal = remote.carriedById === this.multiplayerPlayerId;
    this.localCarriedByRemote = remote.carryTargetId === this.multiplayerPlayerId;

    if (!this.remotePlayer) {
      this.remotePlayer = new Player(DEFAULT_PLAYER_CONFIG);
      this.remotePlayer.applyCharacter(getCharacterById(remote.snapshot.characterId));
    }

    const rp = this.remotePlayer;
    rp.characterId = remote.snapshot.characterId;
    rp.width = remote.snapshot.width;
    rp.height = remote.snapshot.height;
    rp.x = remote.snapshot.x;
    rp.y = remote.snapshot.y;
    rp.vx = remote.snapshot.vx;
    rp.vy = remote.snapshot.vy;
    rp.facingRight = remote.snapshot.facingRight;
    rp.onGround = remote.snapshot.onGround;
    rp.health = remote.snapshot.health;
    rp.maxHealth = remote.snapshot.maxHealth;
    rp.distance = remote.snapshot.distance;
    rp.alive = remote.snapshot.health > 0;
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
      characterId: this.player.characterId,
      width: this.player.width,
      height: this.player.height,
      distance: this.player.distance,
    };
  }

  private handleCarryInteraction(dt: number): void {
    if (!this.multiplayerEnabled || !this.remotePlayer || !this.remotePlayerId) return;
    this.carryHintTimer = Math.max(0, this.carryHintTimer - dt);

    const dx = this.remotePlayer.centerX - this.player.centerX;
    const dy = this.remotePlayer.centerY - this.player.centerY;
    const nearRemote = (dx * dx + dy * dy) <= 140 * 140;

    if (this.input.isPressed('KeyF')) {
      if (this.remoteCarriedByLocal) {
        this.remoteCarriedByLocal = false;
        this.onCarryIntent?.({ targetId: null, dropCarry: true });
      } else if (nearRemote) {
        this.remoteCarriedByLocal = true;
        this.carryHintTimer = 1.2;
        this.onCarryIntent?.({ targetId: this.remotePlayerId, dropCarry: false });
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
    const dpr = window.devicePixelRatio || 1;
    const host = this.canvas.parentElement;
    const hostRect = host?.getBoundingClientRect();
    const canvasRect = this.canvas.getBoundingClientRect();

    const width = Math.max(
      1,
      Math.floor(host?.clientWidth ?? 0),
      Math.floor(hostRect?.width ?? 0),
      Math.floor(canvasRect.width),
      Math.floor(window.innerWidth),
    );
    const height = Math.max(
      1,
      Math.floor(host?.clientHeight ?? 0),
      Math.floor(hostRect?.height ?? 0),
      Math.floor(canvasRect.height),
      Math.floor(window.innerHeight),
    );
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));

    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    if (this.canvas.width === pixelWidth && this.canvas.height === pixelHeight) {
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.renderer.resize(width, height);
      this.camera.setScreenSize(width, height);
      return;
    }

    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.canvas.width = pixelWidth;
    this.canvas.height = pixelHeight;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.renderer.clearTerrainCache();
    this.renderer.resize(width, height);
    this.camera.setScreenSize(width, height);
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
    window.removeEventListener('resize', this.handleResize);
  }

  private loop = (currentTime: number): void => {
    if (!this._running) return;
    this.profiler.startFrame();

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    if (dt > 0.1) dt = 0.1;

    if (this._state === 'playing') {
      this.accumulated += dt;
      if (this.accumulated > MAX_ACCUMULATED) this.accumulated = MAX_ACCUMULATED;

      const updateStart = performance.now();
      while (this.accumulated >= FIXED_DT) {
        this.update(FIXED_DT);
        this.accumulated -= FIXED_DT;
      }
      this.input.endFrame();
      this.profiler.recordUpdateTime(performance.now() - updateStart);
    }

    this.render();
    this.profiler.endFrame();
    this.updateAdaptiveQuality();
    this.animationId = requestAnimationFrame(this.loop);
  };

  /** Adaptive quality: adjust particle count based on FPS */
  private updateAdaptiveQuality(): void {
    if (!this.adaptiveQualityEnabled) return;

    const metrics = this.profiler.getMetrics();
    this.qualityChangeTimer += 1 / 60; // Approximate frame time

    if (this.qualityChangeTimer >= this.qualityChangeCooldown) {
      this.qualityChangeTimer = 0;

      if (metrics.fps < 30 && this.currentQualityLevel !== 'low') {
        // Drop quality
        this.currentQualityLevel = 'low';
        this.particles.setReducedParticles(true);
      } else if (metrics.fps > 50 && this.currentQualityLevel !== 'high') {
        // Increase quality
        this.currentQualityLevel = 'high';
        this.particles.setReducedParticles(false);
      } else if (metrics.fps >= 35 && metrics.fps < 50 && this.currentQualityLevel !== 'medium') {
        // Medium quality
        this.currentQualityLevel = 'medium';
        this.particles.setReducedParticles(false);
      }
    }
  }

  private isPlatformReplacedByFallingHazard(chunkId: number, platform: PlatformData): boolean {
    return this.hazards.some((h) =>
      h.type === 'falling_platform'
      && h.chunkId === chunkId
      && Math.abs(h.x - platform.x) < 0.5
      && Math.abs(h.y - platform.y) < 0.5
      && Math.abs(h.width - platform.width) < 0.5
    );
  }

  private getActivePlatforms(rangeCenterX?: number, range: number = Infinity): PlatformData[] {
    const chunks = this.chunkManager.getLoadedChunks();
    const platforms: PlatformData[] = [];
    const minX = rangeCenterX !== undefined ? rangeCenterX - range : -Infinity;
    const maxX = rangeCenterX !== undefined ? rangeCenterX + range : Infinity;

    for (const chunk of chunks) {
      for (const plat of chunk.platforms) {
        if (this.isPlatformReplacedByFallingHazard(chunk.index, plat)) continue;
        if (plat.x + plat.width <= minX || plat.x >= maxX) continue;

        if (plat.moveAmp && plat.moveSpeed) {
          const offsetY = Math.sin(this.gameTime * plat.moveSpeed) * plat.moveAmp;
          platforms.push({ x: plat.x, y: plat.y + offsetY, width: plat.width });
        } else {
          platforms.push(plat);
        }
      }
    }

    for (const h of this.hazards) {
      if (h.type !== 'falling_platform' || h.destroyed || h.falling || h.vy === undefined) continue;
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

  private checkWallCollision(): 'left' | 'right' | null {
    const px = this.player.x;
    const py = this.player.y;
    const margin = 2;
    const leftY = this.chunkManager.getHeight(px - margin);
    const rightY = this.chunkManager.getHeight(px + this.player.width + margin);
    const centerBottom = py + this.player.height;
    if (leftY < centerBottom - this.player.height * 0.4 && this.player.vx < 0) return 'left';
    if (rightY < centerBottom - this.player.height * 0.4 && this.player.vx > 0) return 'right';
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
      if (chunkEnd < playerX - spawnBehindDistance || chunkStart > playerX + spawnAheadDistance) {
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
      // Fraction of base pool to use (capped at 100% of available spawns)
      const baseCount = Math.min(
        Math.ceil(enemySpawns.length * Math.min(this.difficulty.densityMult, 1.0)),
        enemySpawns.length,
      );
      const baseSpawns = enemySpawns.slice(0, baseCount);
      // Beyond 100% density: each pool enemy has a probabilistic chance to spawn a second copy
      const bonusRate = Math.max(0, this.difficulty.densityMult - 1.0);
      const bonusSpawns = bonusRate > 0
        ? enemySpawns.filter((_, i) => this.seededRng(chunk.index * 777 + i) < bonusRate)
        : [];
      const allSpawns = [...baseSpawns, ...bonusSpawns];

      for (const spawn of allSpawns) {
        if (chunk.index === 0 && spawn.x < START_SAFE_ZONE_END) continue;
        let enemy: Enemy;
        switch (spawn.type) {
          case 'slime': enemy = new Slime(spawn.x, spawn.y, spawn.chunkId); break;
          case 'beetle': enemy = new Beetle(spawn.x, spawn.y, spawn.chunkId); break;
          case 'wisp': enemy = new Wisp(spawn.x, spawn.y, spawn.chunkId); break;
          case 'bat': enemy = new Bat(spawn.x, spawn.y, spawn.chunkId); break;
          case 'mite': enemy = new Mite(spawn.x, spawn.y, spawn.chunkId); break;
          case 'jumper': enemy = new Jumper(spawn.x, spawn.y, spawn.chunkId); break;
          case 'skeleton': enemy = new Skeleton(spawn.x, spawn.y, spawn.chunkId); break;
          case 'alien': enemy = new Alien(spawn.x, spawn.y, spawn.chunkId); break;
          case 'ufo': enemy = new UFO(spawn.x, spawn.y, spawn.chunkId); break;
          case 'boss': enemy = new Boss(spawn.x, spawn.y, spawn.chunkId); break;
          default: continue;
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
      const newCollectibles = spawnCollectiblesForChunk(chunk.index, chunkWorldX, 800, plats, (s) => this.seededRng(s), chunk.heights);
      this.collectibles.push(...newCollectibles);

      // Hazards
      const newHazards = spawnHazardsForChunk(
        chunk.index, plats, chunk.heights, chunkWorldX, (s) => this.seededRng(s)
      );
      this.hazards.push(...newHazards);

      const replacedPlatforms = newHazards.filter((h) => h.type === 'falling_platform');
      if (replacedPlatforms.length > 0) {
        for (let i = chunk.platforms.length - 1; i >= 0; i--) {
          const plat = chunk.platforms[i];
          const replaced = replacedPlatforms.some((h) =>
            Math.abs(h.x - plat.x) < 0.5
            && Math.abs(h.y - plat.y) < 0.5
            && Math.abs(h.width - plat.width) < 0.5
          );
          if (replaced) chunk.platforms.splice(i, 1);
        }
      }
    }
  }

  /** Update enemy ground state from terrain */
  private updateEnemyGround(enemy: Enemy, platforms: PlatformData[], dt: number): void {
    const enemyBottom = enemy.y + enemy.height;
    const prevBottom = enemyBottom - enemy.vy * dt;

    let supportY = this.chunkManager.getHeight(enemy.x + enemy.width / 2);
    for (const plat of platforms) {
      if (enemy.x + enemy.width <= plat.x || enemy.x >= plat.x + plat.width) continue;
      // Ignore platforms that are far above the enemy to avoid snapping upward.
      if (enemyBottom > plat.y + Math.max(14, enemy.height * 0.75)) continue;
      supportY = Math.min(supportY, plat.y);
    }

    if (
      enemy.vy >= 0
      && supportY !== Infinity
      && prevBottom <= supportY + 3
      && enemyBottom >= supportY - 3
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
    const centerGrace = 8;
    const horizontalCenterOverlaps =
      this.player.centerX >= enemy.x - centerGrace &&
      this.player.centerX <= enemy.x + enemy.width + centerGrace;

    // Forgiving top-half stomp: accepts fast falls, edge hits, and small enemies.
    return (
      this.player.vy > -80 &&
      horizontalCenterOverlaps &&
      (previousBottom <= enemyMid || this.player.centerY < enemy.y + enemy.height * 0.55) &&
      playerBottom >= enemyTop - 8
    );
  }

  private awardEnemyDefeat(enemy: Enemy): void {
    const pts = KILL_SCORES[enemy.type] ?? 100;
    this.player.score += pts;
    this.particles.spawnEnemyDeath(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
    this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y, `+${pts}`);
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
      this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y - 8, 'DISRUPT!', '#67e8f9');
      if (!enemy.alive) this.awardEnemyDefeat(enemy);
      return;
    }

    const beamCenterX = beam.x + beam.width / 2;
    const pullX = Math.max(-90, Math.min(90, (beamCenterX - this.player.centerX) * 1.8));
    this.player.vx += pullX * dt;
    this.player.vy = Math.max(this.player.vy - 620 * dt, -360);
    this.player.onGround = false;

    if (this.player.centerY < enemy.y + enemy.height + 22 && this.player.takeDamage(enemy.effectiveDamage)) {
      this.player.vy = 180;
      enemy.disrupt();
      this.camera.shake(5, 0.25);
      this.particles.spawnScorePopup(this.player.centerX, this.player.y - 12, 'ABDUCTED!', '#22d3ee');
    }
  }

  private update(dt: number): void {
    this.gameTime += dt;

    // Update chunks — use a position slightly ahead of the player so enemies spawn in view.
    const lookAheadPx = this.camera.x + this.camera.renderX > 0
      ? Math.max(this.player.centerX, this.camera.x + this.camera.viewportWidth * 0.6)
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
        const maybeProjectiles = (enemy as Enemy & { projectiles?: unknown }).projectiles;
        if (Array.isArray(maybeProjectiles)) {
          maybeProjectiles.length = 0;
        }
      }
    }
    this.enemies = this.enemies.filter(e => e.alive && Math.abs(e.x - px) < cleanupRange);
    this.collectibles = this.collectibles.filter(c => !c.collected && Math.abs(c.x - px) < cleanupRange);
    this.hazards = this.hazards.filter(h => !h.destroyed && Math.abs(h.x - px) < cleanupRange);

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
    if (wallSide === 'left') this.player.facingRight = false;
    if (wallSide === 'right') this.player.facingRight = true;

    const carriedByRemote = this.multiplayerEnabled && this.localCarriedByRemote && !!this.remotePlayer;
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

      // Landing particles
      if (this.player.onGround && !this.wasOnGround) {
        this.particles.spawnLanding(this.player.centerX, this.player.bottom);
      }

      // Jump dust particles
      const jumpPressed = this.input.isPressed('Space') || this.input.isPressed('ArrowUp') || this.input.isPressed('KeyW');
      if (jumpPressed && (this.player.onGround || this.player.vy < -100)) {
        this.particles.spawnJumpDust(this.player.centerX, this.player.bottom);
      }
    }

    // Wall collision
    if (!carriedByRemote && wallSide) {
      const wallX = wallSide === 'left' ? this.player.x - 1 : this.player.x + this.player.width + 1;
      const wallY = this.chunkManager.getHeight(wallX);
      if (wallY < this.player.y + this.player.height - this.player.height * 0.35) {
        if (wallSide === 'left' && this.player.x > 0) {
          this.player.x = wallX + 1; this.player.vx = 0;
        } else if (wallSide === 'right') {
          this.player.x = wallX - this.player.width - 1; this.player.vx = 0;
        }
      }
    }

    // Difficulty
    this.difficulty = getDifficulty(this.player.distanceTraveled);

    // Distance-based scoring — gain 1 point per 50 pixels traveled
    const prevDistance = this.player.distance;
    this.player.distance = Math.max(this.player.distance, Math.floor(this.player.x / 50));
    if (this.player.distance > prevDistance) {
      this.player.score += (this.player.distance - prevDistance);
    }

    this.handleCarryInteraction(dt);
    this.onLocalPlayerSnapshot?.(this.getLocalPlayerSnapshot());

    // Update falling platforms
    for (const h of this.hazards) {
      if (h.type !== 'falling_platform' || h.destroyed) continue;
      // Check if player is standing on it
      if (h.vy !== undefined) {
        if (!h.falling) {
          if (
            this.player.x + this.player.width > h.x && this.player.x < h.x + h.width &&
            Math.abs(this.player.y + this.player.height - h.y) < 4 && this.player.onGround
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

      enemy.update(dt, this.player.centerX, this.player.centerY);
      this.updateEnemyGround(enemy, enemyPlatforms, dt);
      if (enemy instanceof UFO) this.handleUfoAbduction(enemy, dt);

      // Enemy-player collision — shrink player hitbox 4px for forgiving feel
      if (aabbOverlap(playerBounds, enemy.getBounds(), 4)) {
        const isStomp = this.isStompCollision(enemy, dt);

        if (isStomp) {
          enemy.takeDamage(1);
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
          const wantsBoostedBounce = this.input.isDown('Space') || this.input.isDown('ArrowUp') || this.input.isDown('KeyW');
          this.player.stompBounce(wantsBoostedBounce);
          this.camera.shake(2, 0.12);
          this.particles.spawnLanding(this.player.centerX, Math.min(this.player.bottom, enemy.y + 2));
        } else if (this.player.dashing) {
          enemy.takeDamage(2);
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
        } else if (this.player.shieldActive) {
          this.player.shieldActive = false;
          this.player.shieldTimer = 0;
          enemy.takeDamage(enemy.stompable ? 1 : 2);
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
          const kb = this.player.centerX < enemy.x ? -180 : 180;
          this.player.vx = kb;
          this.player.vy = -180;
          this.camera.shake(4, 0.18);
          this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y, 'SHIELD BASH!', '#67e8f9');
        } else {
          if (this.player.takeDamage(enemy.effectiveDamage)) {
            const kb = this.player.centerX < enemy.x ? -200 : 200;
            this.player.vx = kb;
            this.player.vy = -250;
            this.camera.shake(6, 0.3);
            this.particles.spawnScorePopup(this.player.centerX, this.player.y - 10, '-1 ♥', '#ef4444');
          }
        }
      }

      // Player projectiles hitting enemies
      for (const proj of this.player.projectiles) {
        if (aabbOverlap({ x: proj.x - 4, y: proj.y - 4, width: 8, height: 8 }, enemy.getBounds())) {
          enemy.takeDamage(proj.damage);
          proj.life = 0;
          if (!enemy.alive) this.awardEnemyDefeat(enemy);
        }
      }

      // Skeleton/Boss projectiles hitting player
      if ('projectiles' in enemy && Array.isArray(enemy.projectiles)) {
        for (const proj of enemy.projectiles as { x: number; y: number; width: number; height: number; life: number; damage: number }[]) {
          if (proj.life <= 0) continue;
          if (aabbOverlap({ x: proj.x - proj.width / 2, y: proj.y - proj.height / 2, width: proj.width, height: proj.height }, playerBounds)) {
            if (this.player.takeDamage(proj.damage)) {
              proj.life = 0;
              this.particles.spawnScorePopup(this.player.centerX, this.player.y - 10, '-1 ♥', '#ef4444');
            }
          }
        }
      }
    }

    // Spike hazards — use tighter hitbox (shrink by 4px) and respect invulnerability
    for (const h of this.hazards) {
      if (h.type !== 'spike') continue;
      if (aabbOverlap(playerBounds, { x: h.x, y: h.y, width: h.width, height: h.height }, 4)) {
        if (this.player.takeDamage(1)) {
          this.player.vy = -300;
          this.camera.shake(5, 0.25);
          this.particles.spawnScorePopup(this.player.centerX, this.player.y - 10, '-1 ♥', '#ef4444');
        }
      }
    }

    // Collectibles
    for (const c of this.collectibles) {
      if (c.collected) continue;
      c.animTimer += dt;

      // Magnet attraction
      if (this.player.magnetActive && c.type === 'coin') {
        const dx = this.player.centerX - (c.x + c.width / 2);
        const dy = this.player.centerY - (c.y + c.height / 2);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150 && dist > 0) {
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
          case 'coin':
            this.player.addCoins(1);
            this.particles.spawnCoinSparkle(c.x + c.width / 2, c.y + c.height / 2);
            this.particles.spawnScorePopup(c.x, c.y, '+10', '#fbbf24');
            break;
          case 'health':
            if (this.player.health < this.player.maxHealth) {
              this.player.heal(1);
              this.particles.spawnScorePopup(c.x, c.y, '+1 ♥', '#22c55e');
            } else {
              this.particles.spawnScorePopup(c.x, c.y, 'FULL!', '#86efac');
            }
            break;
          case 'speedBoost':
            this.player.applySpeedBoost(1.5, c.value);
            this.particles.spawnScorePopup(c.x, c.y, 'SPEED!', '#3b82f6');
            break;
          case 'doubleJump':
            this.player.restoreDoubleJump();
            this.particles.spawnScorePopup(c.x, c.y, '2x JUMP!', '#a855f7');
            break;
          case 'shield':
            this.player.applyShield(c.value * 8);
            this.particles.spawnScorePopup(c.x, c.y, 'SHIELD!', '#06b6d4');
            break;
          case 'magnet':
            this.player.applyMagnet(c.value);
            this.particles.spawnScorePopup(c.x, c.y, 'MAGNET!', '#f59e0b');
            break;
        }
      }
    }

    // Camera
    this.camera.update(this.player.centerX, this.player.centerY);

    // Particles
    const biome = getBiomeAt(this.player.centerX);
    const screenW = this.camera.viewportWidth;
    const screenH = this.camera.viewportHeight;
    this.particles.update(this.camera.x, this.camera.y, screenW, screenH, biome.type, dt);

    // Death by falling
    if (this.player.y > 1500) {
      this.player.alive = false;
    }

    if (!this.player.alive) {
      this._state = 'gameover';
      this.camera.shake(8, 0.5);
      this.onGameOver?.();
    }

    // Power-ups for HUD
    const powerUps: string[] = [];
    if (this.player.shieldActive) powerUps.push('🛡️');
    if (this.player.magnetActive) powerUps.push('🧲');
    if (this.player.speedBoostTimer > 0) powerUps.push('⚡');

    const profilerMetrics = this.profiler.getMetrics();

    this.onStatsUpdate?.({
      score: this.player.score,
      coins: this.player.coins,
      distance: this.player.distance,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      biome: biome.name,
      powerUps,
      fps: profilerMetrics.fps,
    });
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
      if (!this.camera.isVisible(enemy.x, enemy.y, enemy.width, enemy.height)) continue;
      enemy.render(ctx, this.camera.renderX, this.camera.renderY);
    }

    // Player projectiles
    ctx.fillStyle = '#60a5fa';
    for (const p of this.player.projectiles) {
      const sx = p.x - this.camera.renderX;
      const sy = p.y - this.camera.renderY;
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = '#93c5fd80';
      ctx.beginPath();
      ctx.arc(sx, sy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
    }

    // Player
    this.renderer.drawPlayer(this.player, this.camera);

    if (this.multiplayerEnabled && this.remotePlayer) {
      this.renderer.drawPlayer(this.remotePlayer, this.camera);
      const rsx = this.remotePlayer.x - this.camera.renderX + this.remotePlayer.width / 2;
      const rsy = this.remotePlayer.y - this.camera.renderY - 8;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(rsx - 48, rsy - 12, 96, 14);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.remotePlayerName ?? 'Peer', rsx, rsy - 5);
    }

    // Shield visual
    if (this.player.shieldActive) {
      const sx = this.player.x - this.camera.renderX + this.player.width / 2;
      const sy = this.player.y - this.camera.renderY + this.player.height / 2;
      ctx.strokeStyle = '#06b6d480';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, this.player.width * 0.8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#06b6d415';
      ctx.fill();
    }

    // Dash trail
    if (this.player.dashing) {
      ctx.fillStyle = '#4488cc40';
      const sx = this.player.x - this.camera.renderX - this.player.dashDirection * 20;
      const sy = this.player.y - this.camera.renderY;
      ctx.fillRect(sx, sy, this.player.width, this.player.height);
    }

    if (this.multiplayerEnabled && this.remotePlayer && this.carryHintTimer > 0) {
      ctx.fillStyle = 'rgba(15,23,42,0.7)';
      ctx.fillRect(width / 2 - 120, height - 96, 240, 34);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hint = this.remoteCarriedByLocal ? 'Press F to drop your teammate' : 'Press F near teammate to pick them up';
      ctx.fillText(hint, width / 2, height - 79);
    }

    this.renderer.drawParticles(this.particles.getParticles(), this.camera);

    // Pause overlay
    if (this._state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, width, height);
    }
  }
}
