/**
 * Main game engine — ties everything together.
 * Manages the game loop, updates all systems, and renders each frame.
 *
 * Usage:
 *   const game = new GameEngine(canvas);
 *   game.start();
 *   // later: game.stop();
 */

import { Camera, DEFAULT_CAMERA_CONFIG } from './camera';
import { ChunkManager } from '../world/chunk-manager';
import { InputManager } from '../input/input';
import { Player, DEFAULT_PLAYER_CONFIG } from '../entities/player';
import { ParticleSystem } from '../entities/particles';
import { GameRenderer } from '../rendering/renderer';
import { getBiomeAt } from '../world/biomes';

/** Fixed timestep for physics (seconds) */
const FIXED_DT = 1 / 60;

/** Max accumulated time before we force updates (prevents spiral of death) */
const MAX_ACCUMULATED = 0.1;

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
  private running = false;

  /** World seed — change this for a different world */
  readonly worldSeed = 42;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;

    // Initialize systems
    this.input = new InputManager();
    this.camera = new Camera(DEFAULT_CAMERA_CONFIG);
    this.chunkManager = new ChunkManager(this.worldSeed);
    this.player = new Player(DEFAULT_PLAYER_CONFIG);
    this.particles = new ParticleSystem();
    this.renderer = new GameRenderer(this.ctx);

    // Initial setup
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
  }

  private handleResize = (): void => {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Set canvas size accounting for device pixel ratio
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);

    this.renderer.resize(width, height);
    this.camera.setScreenSize(width, height);
  };

  /** Start the game loop */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  /** Stop the game loop */
  stop(): void {
    this.running = false;
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

  /**
   * Main game loop using requestAnimationFrame.
   * Uses fixed timestep with variable rendering for consistent physics.
   */
  private loop = (currentTime: number): void => {
    if (!this.running) return;

    // Calculate delta time in seconds, capped to prevent huge jumps
    let dt = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    if (dt > 0.1) dt = 0.1;

    // Accumulate time and run fixed-step updates
    this.accumulated += dt;
    if (this.accumulated > MAX_ACCUMULATED) {
      this.accumulated = MAX_ACCUMULATED;
    }

    while (this.accumulated >= FIXED_DT) {
      this.update(FIXED_DT);
      this.accumulated -= FIXED_DT;
    }

    // Render (once per frame, not per physics step)
    this.render();

    this.animationId = requestAnimationFrame(this.loop);
  };

  /**
   * Fixed-step update — physics, input, world generation.
   */
  private update(dt: number): void {
    // Update chunks around player
    this.chunkManager.update(this.player.centerX);

    // Get ground height at player position
    const groundY = this.chunkManager.getHeight(this.player.centerX);

    // Update player
    this.player.update(dt, this.input, groundY);

    // Update camera to follow player
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

    // Clear input state at end of frame
    this.input.endFrame();
  }

  /**
   * Render everything to the canvas.
   */
  private render(): void {
    const ctx = this.ctx;
    const width = this.canvas.getBoundingClientRect().width;
    const height = this.canvas.getBoundingClientRect().height;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Get loaded chunks
    const chunks = this.chunkManager.getLoadedChunks();

    // Draw layers in order (back to front)
    this.renderer.drawSky(this.camera);
    this.renderer.drawParallax(this.camera);
    this.renderer.drawTerrain(chunks, this.camera);
    this.renderer.drawPlatforms(chunks, this.camera);
    this.renderer.drawDecorations(chunks, this.camera);
    this.renderer.drawParticles(this.particles.getParticles(), this.camera);
    this.renderer.drawPlayer(this.player, this.camera);
  }
}
