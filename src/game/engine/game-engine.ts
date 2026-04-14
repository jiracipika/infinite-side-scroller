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
import { Bat } from '../entities/Bat';
import { Skeleton } from '../entities/Skeleton';
import { Jumper } from '../entities/Jumper';
import { Boss } from '../entities/Boss';
import { ParticleSystem } from '../entities/particles';
import { GameRenderer } from '../rendering/renderer';
import { getBiomeAt } from '../world/biomes';
import { getDifficulty } from '../difficulty';
import type { Collectible } from '../entities/Collectibles';
import { spawnCollectiblesForChunk, spawnEnemiesForChunk } from '../entities/Collectibles';
import { spawnHazardsForChunk, renderHazard, type Hazard } from '../hazards';
import { getCharacterById, type CharacterDef } from '../data/characters';
import type { Platform as PlatformData } from '../world/chunk';
import { PerformanceProfiler } from './performance-profiler';
import { EntityPools } from './entity-pools';

const FIXED_DT = 1 / 60;
const MAX_ACCUMULATED = 0.1;

export type EngineState = 'playing' | 'paused' | 'gameover';

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

  // Input throttling
  private lastJumpPressTime = 0;
  private lastAttackPressTime = 0;
  private inputThrottleMs = 100;

  worldSeed = 42;
  difficulty = getDifficulty(0);

  onGameOver?: () => void;
  onStatsUpdate?: (stats: { score: number; coins: number; distance: number; health: number; maxHealth: number; biome: string; powerUps: string[]; fps: number }) => void;

  private wasOnGround = true;

  // Entity management
  private enemies: Enemy[] = [];
  private collectibles: Collectible[] = [];
  private hazards: Hazard[] = [];
  private lastChunkKey = '';

  // Track which chunks have spawned entities
  private spawnedChunks = new Set<number>();

  // Game time for animations
  private gameTime = 0;

  private _characterId: string = 'knight';

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
    this.lastChunkKey = '';
    this._state = 'playing';
    this.difficulty = getDifficulty(0);
    this.wasOnGround = true;
    this.currentQualityLevel = 'high';
    this.particles.setReducedParticles(false);
    this.gameTime = 0;
    // Reset timing to avoid first-frame spike after restart
    this.lastTime = performance.now();
    this.accumulated = 0;
  }

  private handleResize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
    this.renderer.resize(width, height);
    this.camera.setScreenSize(width, height);
  };

  start(): void {
    if (this._running) return;
    this._running = true;
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

  private getNearbyPlatforms(): PlatformData[] {
    const chunks = this.chunkManager.getLoadedChunks();
    const platforms: PlatformData[] = [];
    const px = this.player.centerX;
    const range = 600;
    for (const chunk of chunks) {
      for (const plat of chunk.platforms) {
        // Include platforms that overlap the range (not just fully contained)
        if (plat.x + plat.width > px - range && plat.x < px + range) {
          // Apply moving platform offset
          if (plat.moveAmp && plat.moveSpeed) {
            const offsetY = Math.sin(this.gameTime * plat.moveSpeed) * plat.moveAmp;
            platforms.push({ x: plat.x, y: plat.y + offsetY, width: plat.width });
          } else {
            platforms.push(plat);
          }
        }
      }
    }
    return platforms;
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
    for (const chunk of chunks) {
      if (this.spawnedChunks.has(chunk.index)) continue;
      this.spawnedChunks.add(chunk.index);

      const plats = chunk.platforms;
      const chunkWorldX = chunk.worldX;

      // Enemies — densityMult: 0.6 at start → 1.0 at primary ramp → up to ~1.8 later
      const enemySpawns = spawnEnemiesForChunk(chunk.index, plats, (s) => this.seededRng(s), chunk.heights, chunkWorldX);
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
        let enemy: Enemy;
        switch (spawn.type) {
          case 'slime': enemy = new Slime(spawn.x, spawn.y, spawn.chunkId); break;
          case 'bat': enemy = new Bat(spawn.x, spawn.y, spawn.chunkId); break;
          case 'jumper': enemy = new Jumper(spawn.x, spawn.y, spawn.chunkId); break;
          case 'skeleton': enemy = new Skeleton(spawn.x, spawn.y, spawn.chunkId); break;
          case 'boss': enemy = new Boss(spawn.x, spawn.y, spawn.chunkId); break;
          default: continue;
        }
        enemy.applyDifficulty(
          this.difficulty.speedMult,
          this.difficulty.damageMult,
          this.difficulty.healthMult,
          this.difficulty.detectRangeMult,
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
    }
  }

  /** Update enemy ground state from terrain */
  private updateEnemyGround(enemy: Enemy): void {
    const groundY = this.chunkManager.getHeight(enemy.x + enemy.width / 2);
    if (enemy.y + enemy.height >= groundY && groundY !== Infinity) {
      enemy.y = groundY - enemy.height;
      enemy.vy = 0;
      enemy.onGround = true;
    } else {
      // Also check platforms
      for (const h of this.hazards) {
        if (h.type === 'falling_platform' && !h.destroyed && h.vy !== undefined && (h.vy === 0 || h.falling === false)) {
          if (enemy.x + enemy.width > h.x && enemy.x < h.x + h.width) {
            if (enemy.vy >= 0 && enemy.y + enemy.height >= h.y && enemy.y + enemy.height <= h.y + 12) {
              enemy.y = h.y - enemy.height;
              enemy.vy = 0;
              enemy.onGround = true;
              return;
            }
          }
        }
      }
      enemy.onGround = false;
    }
  }

  private update(dt: number): void {
    this.gameTime += dt;

        // Update chunks — use a position slightly ahead of the player so enemies spawn in view
    const lookAheadPx = this.camera.x + this.camera.renderX > 0
      ? Math.max(this.player.centerX, this.camera.x + (this.camera as any).screenWidth * 0.6)
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
        if ('projectiles' in enemy && Array.isArray((enemy as any).projectiles)) {
          (enemy as any).projectiles.length = 0;
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

    // Build platform list including non-falling hazards for player collision
    const allPlatforms = [...platforms];
    for (const h of this.hazards) {
      if (h.type === 'falling_platform' && !h.destroyed && !h.falling && h.vy !== undefined) {
        allPlatforms.push({ x: h.x, y: h.y, width: h.width } as PlatformData);
      }
    }

    const wallSide = this.checkWallCollision();
    this.player.touchingWall = wallSide !== null;
    if (wallSide === 'left') this.player.facingRight = false;
    if (wallSide === 'right') this.player.facingRight = true;

    this.wasOnGround = this.player.onGround;
    this.player.update(dt, this.input, groundY, allPlatforms);

    // Landing particles
    if (this.player.onGround && !this.wasOnGround) {
      this.particles.spawnLanding(this.player.centerX, this.player.bottom);
    }

    // Jump dust particles
    const jumpPressed = this.input.isPressed('Space') || this.input.isPressed('ArrowUp') || this.input.isPressed('KeyW');
    if (jumpPressed && (this.player.onGround || this.player.vy < -100)) {
      this.particles.spawnJumpDust(this.player.centerX, this.player.bottom);
    }

    // Wall collision
    if (wallSide) {
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
      this.updateEnemyGround(enemy);

      // Score per kill scales by enemy type
      const KILL_SCORES: Record<string, number> = { slime: 100, bat: 150, jumper: 200, skeleton: 250, boss: 1000 };

      // Enemy-player collision — shrink player hitbox 4px for forgiving feel
      if (aabbOverlap(playerBounds, enemy.getBounds(), 4)) {
        // Stomp: player clearly falling AND feet in top 40% of enemy
        const playerFeetY = this.player.y + this.player.height;
        const isStomp = enemy.stompable
          && this.player.vy > 50
          && playerFeetY < enemy.y + enemy.height * 0.4;

        if (isStomp) {
          enemy.takeDamage(1);
          if (!enemy.alive) {
            const pts = KILL_SCORES[enemy.type] ?? 100;
            this.player.score += pts;
            this.particles.spawnEnemyDeath(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y, `+${pts}`);
          }
          this.player.stompBounce();
        } else if (this.player.dashing) {
          enemy.takeDamage(2);
          if (!enemy.alive) {
            const pts = KILL_SCORES[enemy.type] ?? 100;
            this.player.score += pts;
            this.particles.spawnEnemyDeath(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y, `+${pts}`);
          }
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
          if (!enemy.alive) {
            const pts = KILL_SCORES[enemy.type] ?? 100;
            this.player.score += pts;
            this.particles.spawnEnemyDeath(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
            this.particles.spawnScorePopup(enemy.x + enemy.width / 2, enemy.y, `+${pts}`);
          }
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
    const screenW = this.canvas.getBoundingClientRect().width;
    const screenH = this.canvas.getBoundingClientRect().height;
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
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;
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
      renderHazard(ctx, h, this.camera.renderX);
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
      enemy.render(ctx, this.camera.renderX);
    }

    // Player projectiles
    ctx.fillStyle = '#60a5fa';
    for (const p of this.player.projectiles) {
      const sx = p.x - this.camera.renderX;
      ctx.beginPath();
      ctx.arc(sx, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      // Glow
      ctx.fillStyle = '#93c5fd80';
      ctx.beginPath();
      ctx.arc(sx, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#60a5fa';
    }

    // Player
    this.renderer.drawPlayer(this.player, this.camera);

    // Shield visual
    if (this.player.shieldActive) {
      const sx = this.player.x - this.camera.renderX + this.player.width / 2;
      const sy = this.player.y + this.player.height / 2;
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
      ctx.fillRect(sx, this.player.y, this.player.width, this.player.height);
    }

    this.renderer.drawParticles(this.particles.getParticles(), this.camera);

    // Pause overlay
    if (this._state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, width, height);
    }
  }
}
