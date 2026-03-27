/**
 * Player entity — the character controlled by the player.
 */

import { InputManager } from '../input/input';
import type { Platform } from '../world/chunk';

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
  facingRight = true;
  wallSliding = false;
  touchingWall = false;
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
  update(dt: number, input: InputManager, groundY: number, platforms: Platform[] = []): void {
    // Horizontal movement with acceleration/friction
    const moveLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
    const moveRight = input.isDown('ArrowRight') || input.isDown('KeyD');
    const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const maxSpeed = this.config.speed * (sprint ? 1.6 : 1);
    const accel = maxSpeed * 8;
    const friction = maxSpeed * 10;

    if (moveLeft) {
      this.vx = Math.max(this.vx - accel * dt, -maxSpeed);
      this.facingRight = false;
    } else if (moveRight) {
      this.vx = Math.min(this.vx + accel * dt, maxSpeed);
      this.facingRight = true;
    } else {
      // Friction
      if (this.vx > 0) this.vx = Math.max(0, this.vx - friction * dt);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + friction * dt);
    }

    const wantJump = input.isPressed('Space') || input.isPressed('ArrowUp') || input.isPressed('KeyW');

    // Wall slide
    this.wallSliding = false;
    if (!this.onGround && this.touchingWall && this.vy > 0) {
      if (moveLeft && !this.facingRight || moveRight && this.facingRight) {
        this.wallSliding = true;
        this.vy = Math.min(this.vy, 120); // slow fall
      }
    }

    // Jump — ground, coyote time, wall jump, or double jump
    if (wantJump) {
      if (this.onGround || this.coyoteTimer < this.COYOTE_FRAMES) {
        this.vy = this.config.jumpVelocity;
        this.onGround = false;
        this.coyoteTimer = this.COYOTE_FRAMES;
        this.touchingWall = false;
        this.wallSliding = false;
      } else if (this.wallSliding) {
        // Wall jump
        this.vy = this.config.jumpVelocity * 0.9;
        this.vx = this.facingRight ? -maxSpeed * 0.7 : maxSpeed * 0.7;
        this.facingRight = !this.facingRight;
        this.touchingWall = false;
        this.wallSliding = false;
      } else if (this.canDoubleJump) {
        this.useDoubleJump();
      }
    }

    // Apply gravity (reduced when wall sliding)
    this.vy += this.config.gravity * dt;

    // Clamp fall speed
    if (this.vy > 800) this.vy = 800;

    // Move horizontally
    this.x += this.vx * dt;

    // Don't let player go left of world start
    if (this.x < 0) { this.x = 0; this.vx = 0; }

    // Move vertically
    this.y += this.vy * dt;

    // Platform collision (one-way, can jump through from below)
    let onPlatform = false;
    if (this.vy >= 0) { // Only collide when falling or standing
      for (const plat of platforms) {
        const prevBottom = (this.y + this.height) - this.vy * dt;

        // Check if player's feet are at platform level and moving down
        if (this.x + this.width > plat.x && this.x < plat.x + plat.width) {
          if (prevBottom <= plat.y + 2 && this.y + this.height >= plat.y) {
            this.y = plat.y - this.height;
            this.vy = 0;
            onPlatform = true;
            break;
          }
          // Also: already standing on platform
          if (Math.abs(this.y + this.height - plat.y) < 4 && this.vy >= 0) {
            this.y = plat.y - this.height;
            this.vy = 0;
            onPlatform = true;
            break;
          }
        }
      }
    }

    // Ground collision
    this.wasOnGround = this.onGround;
    const playerBottom = this.y + this.height;

    if (playerBottom >= groundY && groundY !== Infinity) {
      this.y = groundY - this.height;
      this.vy = 0;
      this.onGround = true;
      this.coyoteTimer = 0;
      this.hasDoubleJumped = false;
    } else if (onPlatform) {
      this.onGround = true;
      this.coyoteTimer = 0;
      this.hasDoubleJumped = false;
    } else {
      this.onGround = false;
    }

    // Coyote time
    if (!this.onGround && this.wasOnGround) this.coyoteTimer = 0;
    if (!this.onGround) this.coyoteTimer++;

    // Distance tracking
    this.distance = Math.max(this.distance, Math.floor(this.x / 50));
    this.distanceTraveled += Math.abs(this.vx * dt);
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
