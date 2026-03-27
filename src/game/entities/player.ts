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
  health = 100;
  maxHealth = 100;
  alive = true;
  score = 0;
  coins = 0;
  distance = 0;
  distanceTraveled = 0;
  
  invulnerable = false;
  invulnerableTimer = 0;

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

  /** Apply damage to the player */
  takeDamage(amount: number): boolean {
    if (this.invulnerable || !this.alive) return false;
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = true;
    this.invulnerableTimer = 60; // 1 second of invulnerability
    if (this.health <= 0) {
      this.alive = false;
    }
    return true;
  }

  /** Heal the player */
  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  /** Add coins */
  addCoins(amount: number): void {
    this.coins += amount;
    this.score += amount * 10;
  }

  /** Get bounding box for collision */
  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  /** Check if player is stomping (falling) */
  isStomping(): boolean {
    return this.vy > 0;
  }

  /** Bounce after stomping an enemy */
  stompBounce(): void {
    this.vy = this.config.jumpVelocity * 0.6;
  }

  /** Apply a temporary speed boost */
  private speedBoostTimer = 0;
  applySpeedBoost(multiplier: number, duration: number = 3): void {
    this.config.speed = DEFAULT_PLAYER_CONFIG.speed * multiplier;
    this.speedBoostTimer = duration * 60;
  }

  /** Enable/disable double jump */
  private _doubleJump = false;
  hasDoubleJumped = false;
  setDoubleJump(enabled: boolean): void {
    this._doubleJump = enabled;
    this.hasDoubleJumped = false;
  }
  get canDoubleJump(): boolean { return this._doubleJump && !this.hasDoubleJumped; }
  useDoubleJump(): void {
    if (this.canDoubleJump) {
      this.vy = this.config.jumpVelocity;
      this.hasDoubleJumped = true;
    }
  }
}
