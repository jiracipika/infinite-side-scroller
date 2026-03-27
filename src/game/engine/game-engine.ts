/**
 * Main game engine — ties everything together.
 * Manages the game loop, updates all systems, and renders each frame.
 */

import { Camera, DEFAULT_CAMERA_CONFIG } from './camera';
import { ChunkManager } from '../world/chunk-manager';
import { InputManager } from '../input/input';
import { Player, DEFAULT_PLAYER_CONFIG } from '../entities/player';
import { ParticleSystem } from '../entities/particles';
import { GameRenderer } from '../rendering/renderer';
import { getBiomeAt } from '../world/biomes';
import { getDifficulty } from '../difficulty';
import type { Chunk, Platform as PlatformData } from '../world/chunk';

/** Fixed timestep for physics (seconds) */
const FIXED_DT = 1 / 60;

/** Max accumulated time before we force updates (prevents spiral of death) */
const MAX_ACCUMULATED = 0.1;

export type EngineState = 'playing' | 'paused' | 'gameover';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private renderer: GameRenderer;
  private camera: Camera;
  private chunkManager: ChunkManager;
  private input: InputManager;
  private player: Player;
  private particles: ParticleSystem;

  private animationId: number | null = null;
  private lastTime = 0;
  private accumulated = 0;
  private _running = false;
  private _state: EngineState = 'playing';

  /** World seed — change this for a different world */
  worldSeed = 42;

  /** Difficulty config based on distance */
  difficulty = getDifficulty(0);

  /** Callback when player dies */
  onGameOver?: () => void;

  /** Callback for stat updates (HUD) */
  onStatsUpdate?: (stats: { score: number; coins: number; distance: number; health: number; maxHealth: number; biome: string }) => void;

  /** Track previous onGround for landing particles */
  private wasOnGround = true;

  constructor(canvas: HTMLCanvasElement, seed?: number) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    if (seed !== undefined) this.worldSeed = seed;

    this.input = new InputManager();
    this.camera = new Camera(DEFAULT_CAMERA_CONFIG);
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.player.setDoubleJump(true); // Double jump enabled by default
    this.particles = new ParticleSystem();
    this.renderer = new GameRenderer(this.ctx);

    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  get state(): EngineState { return this._state; }

  pause(): void { this._state = 'paused'; }
  resume(): void { this._state = 'playing'; this.lastTime = performance.now(); this.accumulated = 0; }

  setSeed(seed: number): void {
    this.worldSeed = seed;
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.player.setDoubleJump(true);
    this.particles.clear();
    this._state = 'playing';
    this.difficulty = getDifficulty(0);
    this.wasOnGround = true;
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

  /** Start the game loop */
  start(): void {
    if (this._running) return;
    this._running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /** Stop the game loop */
  stop(): void {
    this._running = false;
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /** Clean up all resources */
  destroy(): void {
    this.stop();
    this.input.destroy();
    window.removeEventListener('resize', this.handleResize);
  }

  private loop = (currentTime: number): void => {
    if (!this._running) return;

    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    if (dt > 0.1) dt = 0.1;

    // Only update when playing
    if (this._state === 'playing') {
      this.accumulated += dt;
      if (this.accumulated > MAX_ACCUMULATED) {
        this.accumulated = MAX_ACCUMULATED;
      }

      while (this.accumulated >= FIXED_DT) {
        this.update(FIXED_DT);
        this.accumulated -= FIXED_DT;
      }
    }

    // Always render (even when paused — shows frozen frame)
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  };

  /**
   * Get all platforms near the player for collision.
   */
  private getNearbyPlatforms(): PlatformData[] {
    const chunks = this.chunkManager.getLoadedChunks();
    const platforms: PlatformData[] = [];
    const px = this.player.centerX;
    const range = 600; // Load platforms within this range

    for (const chunk of chunks) {
      for (const plat of chunk.platforms) {
        if (plat.x > px - range && plat.x + plat.width < px + range) {
          platforms.push(plat);
        }
      }
    }
    return platforms;
  }

  /**
   * Get the effective ground Y at player position, considering gaps.
   */
  private getGroundY(worldX: number): number {
    // Check if player is over a gap
    const chunks = this.chunkManager.getLoadedChunks();
    const playerLeft = worldX - this.player.width / 2;
    const playerRight = worldX + this.player.width / 2;

    for (const chunk of chunks) {
      for (const cave of chunk.caves) {
        // If player is horizontally inside a cave that reaches the surface, treat as gap
        if (playerLeft < cave.x + cave.width && playerRight > cave.x) {
          const surfaceY = chunk.getHeight(cave.x - chunk.worldX);
          // Cave starts at surface level = it's a pit
          if (cave.y <= surfaceY + 10) {
            return Infinity; // No ground here — it's a gap
          }
        }
      }
    }

    return this.chunkManager.getHeight(worldX);
  }

  /**
   * Check if there's a wall to the left or right of the player.
   * Returns 'left', 'right', or null.
   */
  private checkWallCollision(): 'left' | 'right' | null {
    const px = this.player.x;
    const py = this.player.y;
    const pw = this.player.width;
    const ph = this.player.height;
    const margin = 2;

    // Check terrain height difference at player edges
    const leftY = this.chunkManager.getHeight(px - margin);
    const rightY = this.chunkManager.getHeight(px + pw + margin);
    const centerBottom = py + ph;

    // Wall on left if terrain is much higher on the left side
    if (leftY < centerBottom - ph * 0.4 && this.player.vx < 0) {
      return 'left';
    }
    // Wall on right if terrain is much higher on the right side
    if (rightY < centerBottom - ph * 0.4 && this.player.vx > 0) {
      return 'right';
    }
    return null;
  }

  private update(dt: number): void {
    // Update chunks around player
    this.chunkManager.update(this.player.centerX);

    // Get ground/platform data
    const groundY = this.getGroundY(this.player.centerX);
    const platforms = this.getNearbyPlatforms();

    // Check wall collision
    const wallSide = this.checkWallCollision();
    this.player.touchingWall = wallSide !== null;
    if (wallSide === 'left') this.player.facingRight = false;
    if (wallSide === 'right') this.player.facingRight = true;

    // Store previous ground state
    this.wasOnGround = this.player.onGround;

    // Update player with platform collision data
    this.player.update(dt, this.input, groundY, platforms);

    // Landing particles
    if (this.player.onGround && !this.wasOnGround) {
      this.particles.spawnLanding(this.player.centerX, this.player.bottom);
    }

    // Jump particles
    if (this.input.isPressed('Space') || this.input.isPressed('ArrowUp') || this.input.isPressed('KeyW')) {
      if (this.player.onGround || this.player.vy < -100) {
        this.particles.spawnJumpDust(this.player.centerX, this.player.bottom);
      }
    }

    // Wall collision — prevent moving through terrain walls
    if (wallSide) {
      // Get terrain height at the blocked side
      const wallX = wallSide === 'left' ? this.player.x - 1 : this.player.x + this.player.width + 1;
      const wallY = this.chunkManager.getHeight(wallX);
      const playerTop = this.player.y;
      const playerBottom = this.player.y + this.player.height;

      // If wall is tall enough to block movement (more than half player height)
      if (wallY < playerBottom - this.player.height * 0.35) {
        if (wallSide === 'left' && this.player.x > 0) {
          this.player.x = wallX + 1;
          this.player.vx = 0;
        } else if (wallSide === 'right') {
          this.player.x = wallX - this.player.width - 1;
          this.player.vx = 0;
        }
      }
    }

    // Update difficulty based on distance
    this.difficulty = getDifficulty(this.player.distanceTraveled);

    // Update camera
    this.camera.update(this.player.centerX, this.player.centerY);

    // Update particles
    const biome = getBiomeAt(this.player.centerX);
    const screenW = this.canvas.getBoundingClientRect().width;
    const screenH = this.canvas.getBoundingClientRect().height;
    this.particles.update(
      this.camera.x, this.camera.y,
      screenW, screenH,
      biome.type, dt
    );

    // Check death (fell off the world)
    if (this.player.y > 1500) {
      this.player.alive = false;
    }

    // Game over
    if (!this.player.alive) {
      this._state = 'gameover';
      this.camera.shake(8, 0.5);
      this.onGameOver?.();
    }

    // Emit stats for HUD
    this.onStatsUpdate?.({
      score: this.player.score,
      coins: this.player.coins,
      distance: this.player.distance,
      health: this.player.health,
      maxHealth: this.player.maxHealth,
      biome: biome.name,
    });

    // Clear input state at end of frame
    this.input.endFrame();
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
    this.renderer.drawPlatforms(chunks, this.camera);
    this.renderer.drawDecorations(chunks, this.camera);
    this.renderer.drawParticles(this.particles.getParticles(), this.camera);
    this.renderer.drawPlayer(this.player, this.camera);

    // Pause overlay
    if (this._state === 'paused') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.fillRect(0, 0, width, height);
    }
  }
}
