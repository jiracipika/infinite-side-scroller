/**
 * Player - Main character controller
 * Handles physics, movement, jumping mechanics, health, and rendering.
 */

import { InputState } from '../input';

// Physics constants
const GRAVITY = 1800; // px/s²
const TERMINAL_VELOCITY = 900;
const MOVE_SPEED = 350;
const SPRINT_SPEED = 550;
const JUMP_FORCE = -520;
const DOUBLE_JUMP_FORCE = -440;
const WALL_SLIDE_SPEED = 80;
const WALL_JUMP_FORCE_X = 400;
const WALL_JUMP_FORCE_Y = -480;
const COYOTE_TIME = 0.1; // seconds after leaving ground
const JUMP_BUFFER = 0.12; // seconds of pre-jump forgiveness
const IFRAME_DURATION = 1.0; // invincibility frames after damage

export interface PlayerConfig {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export class Player {
  // Position & velocity
  x: number;
  y: number;
  vx = 0;
  vy = 0;

  // Dimensions
  width: number;
  height: number;

  // State flags
  onGround = false;
  onWall = 0; // -1 left, 0 none, 1 right
  facingRight = true;
  isSprinting = false;

  // Jump mechanics
  jumpsRemaining = 2;
  canDoubleJump = true; // can be toggled by pickup
  coyoteTimer = 0;
  jumpBufferTimer = 0;

  // Health
  health: number;
  maxHealth = 5;
  iFrameTimer = 0;
  alive = true;

  // Animation
  animFrame = 0;
  animTimer = 0;
  isHurt = false;

  // Speed boost
  speedBoostTimer = 0;
  speedBoostMultiplier = 1;

  // Score
  score = 0;
  distanceTraveled = 0;

  // Physics flags for collision response
  wasOnGround = false;

  constructor(config: PlayerConfig) {
    this.x = config.x;
    this.y = config.y;
    this.width = config.width ?? 32;
    this.height = config.height ?? 48;
    this.health = this.maxHealth;
  }

  /** Update player each frame */
  update(dt: number, input: InputState) {
    if (!this.alive) return;

    // --- Invincibility frames ---
    if (this.iFrameTimer > 0) {
      this.iFrameTimer -= dt;
      this.isHurt = this.iFrameTimer > 0;
    } else {
      this.isHurt = false;
    }

    // --- Speed boost timer ---
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      this.speedBoostMultiplier = 1.6;
    } else {
      this.speedBoostMultiplier = 1;
    }

    // --- Horizontal movement ---
    this.isSprinting = input.sprint;
    const speed = (this.isSprinting ? SPRINT_SPEED : MOVE_SPEED) * this.speedBoostMultiplier;

    if (input.left) {
      this.vx = -speed;
      this.facingRight = false;
    } else if (input.right) {
      this.vx = speed;
      this.facingRight = true;
    } else {
      // Decelerate
      this.vx *= 0.8;
      if (Math.abs(this.vx) < 10) this.vx = 0;
    }

    // --- Gravity ---
    this.vy += GRAVITY * dt;
    if (this.vy > TERMINAL_VELOCITY) this.vy = TERMINAL_VELOCITY;

    // --- Wall sliding ---
    if (this.onWall !== 0 && this.vy > 0 && !this.onGround) {
      this.vy = Math.min(this.vy, WALL_SLIDE_SPEED);
    }

    // --- Coyote time ---
    if (this.onGround) {
      this.coyoteTimer = COYOTE_TIME;
      this.jumpsRemaining = this.canDoubleJump ? 2 : 1;
    } else {
      this.coyoteTimer -= dt;
    }

    // --- Jump buffer ---
    if (input.jumpPressed) {
      this.jumpBufferTimer = JUMP_BUFFER;
    } else {
      this.jumpBufferTimer -= dt;
    }

    // --- Execute jump ---
    if (this.jumpBufferTimer > 0) {
      const canCoyoteJump = this.coyoteTimer > 0 && this.jumpsRemaining > 0;
      const canWallJump = this.onWall !== 0;
      const canDoubleJump = this.jumpsRemaining > 0;

      if (canCoyoteJump) {
        this.vy = JUMP_FORCE;
        this.jumpsRemaining--;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
      } else if (canWallJump) {
        this.vy = WALL_JUMP_FORCE_Y;
        this.vx = -this.onWall * WALL_JUMP_FORCE_X;
        this.facingRight = this.onWall === -1;
        this.jumpsRemaining = this.canDoubleJump ? 1 : 0;
        this.jumpBufferTimer = 0;
      } else if (canDoubleJump) {
        this.vy = DOUBLE_JUMP_FORCE;
        this.jumpsRemaining--;
        this.jumpBufferTimer = 0;
      }
    }

    // --- Apply velocity ---
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.wasOnGround = this.onGround;

    // --- Animation ---
    this.animTimer += dt;
    if (Math.abs(this.vx) > 20 && this.onGround) {
      if (this.animTimer > 0.1) {
        this.animTimer = 0;
        this.animFrame = (this.animFrame + 1) % 4;
      }
    } else if (!this.onGround) {
      this.animFrame = this.vy < 0 ? 5 : 6; // jump up / fall down
    } else {
      this.animFrame = 0;
    }

    // Track distance
    this.distanceTraveled += Math.abs(this.vx * dt);
  }

  /** Apply damage, returns true if actually damaged */
  takeDamage(amount = 1): boolean {
    if (this.iFrameTimer > 0 || !this.alive) return false;
    this.health -= amount;
    this.iFrameTimer = IFRAME_DURATION;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
    return true;
  }

  /** Heal player */
  heal(amount = 1) {
    this.health = Math.min(this.health + amount, this.maxHealth);
  }

  /** Enable/disable double jump */
  setDoubleJump(enabled: boolean) {
    this.canDoubleJump = enabled;
    if (enabled) this.jumpsRemaining = Math.max(this.jumpsRemaining, 1);
  }

  /** Apply speed boost */
  applySpeedBoost(duration = 5) {
    this.speedBoostTimer = duration;
  }

  /** Get bounding box */
  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  /** Check if player is stomping (falling onto enemy from above) */
  isStomping(): boolean {
    return this.vy > 100; // must be moving downward fast enough
  }

  /** Bounce off enemy after stomp */
  stompBounce() {
    this.vy = JUMP_FORCE * 0.65;
    this.jumpsRemaining = this.canDoubleJump ? 2 : 1;
  }

  /** Render player */
  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (!this.alive) return;

    // Flash during invincibility
    if (this.isHurt && Math.floor(this.iFrameTimer * 10) % 2 === 0) return;

    const sx = this.x - cameraX;
    const sy = this.y;

    ctx.save();

    // Body
    const bodyColor = this.speedBoostTimer > 0 ? '#FFD700' : '#4A90D9';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(sx, sy, this.width, this.height);

    // Eyes
    ctx.fillStyle = '#fff';
    const eyeOffsetX = this.facingRight ? 6 : -6;
    const eyeY = sy + 10;
    ctx.fillRect(sx + this.width / 2 + eyeOffsetX - 5, eyeY, 5, 5);
    ctx.fillRect(sx + this.width / 2 + eyeOffsetX + 3, eyeY, 5, 5);

    // Pupils
    ctx.fillStyle = '#000';
    const pupilShift = this.facingRight ? 2 : -1;
    ctx.fillRect(sx + this.width / 2 + eyeOffsetX - 4 + pupilShift, eyeY + 2, 2, 2);
    ctx.fillRect(sx + this.width / 2 + eyeOffsetX + 4 + pupilShift, eyeY + 2, 2, 2);

    // Legs animation
    if (this.onGround && Math.abs(this.vx) > 20) {
      const legOffset = Math.sin(this.animFrame * Math.PI / 2) * 3;
      ctx.fillStyle = bodyColor;
      ctx.fillRect(sx + 4, sy + this.height, 8, 4 + legOffset);
      ctx.fillRect(sx + this.width - 12, sy + this.height, 8, 4 - legOffset);
    }

    ctx.restore();
  }
}
