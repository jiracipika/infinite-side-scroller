/**
 * Player entity — the character controlled by the player.
 */

import { InputManager } from '../input/input';

export interface PlayerConfig {
  /** Starting world X position */
  startX: number;
  /** Starting world Y position */
  startY: number;
  /** Horizontal speed (pixels per second) */
  speed: number;
  /** Jump velocity (pixels per second, upward) */
  jumpVelocity: number;
  /** Gravity (pixels per second squared) */
  gravity: number;
  /** Player size */
  width: number;
  height: number;
}

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  startX: 200,
  startY: 300,
  speed: 300,
  jumpVelocity: -500,
  gravity: 1200,
  width: 24,
  height: 32,
};

export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  readonly width: number;
  readonly height: number;

  private config: PlayerConfig;
  /** Is the player standing on ground? */
  onGround = false;
  /** Was the player on ground last frame? (for coyote time) */
  private wasOnGround = false;
  /** Frames since leaving ground (for coyote time) */
  private coyoteTimer = 0;
  private readonly COYOTE_FRAMES = 6;

  constructor(config: PlayerConfig = DEFAULT_PLAYER_CONFIG) {
    this.config = config;
    this.x = config.startX;
    this.y = config.startY;
    this.width = config.width;
    this.height = config.height;
  }

  /**
   * Update player physics and input.
   * @param dt - Delta time in seconds
   * @param input - Input manager
   * @param groundY - The Y coordinate of the ground surface at player's position
   */
  update(dt: number, input: InputManager, groundY: number): void {
    // Horizontal movement
    this.vx = 0;
    if (input.isDown('ArrowLeft') || input.isDown('KeyA')) {
      this.vx = -this.config.speed;
    }
    if (input.isDown('ArrowRight') || input.isDown('KeyD')) {
      this.vx = this.config.speed;
    }

    // Jump — allow if on ground or within coyote time
    if (
      (input.isPressed('Space') || input.isPressed('ArrowUp') || input.isPressed('KeyW')) &&
      (this.onGround || this.coyoteTimer < this.COYOTE_FRAMES)
    ) {
      this.vy = this.config.jumpVelocity;
      this.onGround = false;
      this.coyoteTimer = this.COYOTE_FRAMES;
    }

    // Apply gravity
    this.vy += this.config.gravity * dt;

    // Clamp fall speed
    if (this.vy > 800) this.vy = 800;

    // Move horizontally
    this.x += this.vx * dt;

    // Move vertically
    this.y += this.vy * dt;

    // Ground collision — player stands on terrain
    this.wasOnGround = this.onGround;
    const playerBottom = this.y + this.height;
    const playerTop = this.y;

    if (playerBottom >= groundY) {
      this.y = groundY - this.height;
      this.vy = 0;
      this.onGround = true;
      this.coyoteTimer = 0;
    } else {
      this.onGround = false;
    }

    // Coyote time counter
    if (!this.onGround && this.wasOnGround) {
      this.coyoteTimer = 0;
    }
    if (!this.onGround) {
      this.coyoteTimer++;
    }
  }

  /** Get the center X position */
  get centerX(): number {
    return this.x + this.width / 2;
  }

  /** Get the center Y position */
  get centerY(): number {
    return this.y + this.height / 2;
  }

  /** Get the bounding box bottom */
  get bottom(): number {
    return this.y + this.height;
  }
}
