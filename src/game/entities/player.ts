/**
 * Player entity — the character controlled by the player.
 */

import { InputManager } from '../input/input';
import type { Platform } from '../world/chunk';
import type { CharacterDef } from '../data/characters';
import type { WeaponDef } from '../data/weapons';
import { getWeaponForCharacter } from '../data/weapons';
import type { PlayerProjectile } from '../data/weapons';
import { playSFX } from '../audio/SoundEngine';

export interface PlayerConfig {
  startX: number;
  startY: number;
  speed: number;
  jumpVelocity: number;
  gravity: number;
  width: number;
  height: number;
}

export const DEFAULT_PLAYER_CONFIG: PlayerConfig = {
  startX: 200,
  startY: 300,
  speed: 280,
  jumpVelocity: -520,
  gravity: 1400,
  width: 24,
  height: 32,
};

export class Player {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  width: number;
  height: number;
  health = 3;
  maxHealth = 3;
  alive = true;
  score = 0;
  coins = 0;
  distance = 0;
  distanceTraveled = 0;

  characterId: string = 'knight';

  invulnerable = false;
  invulnerableTimer = 0;

  // Weapon system
  currentWeapon: WeaponDef;
  projectiles: PlayerProjectile[] = [];
  private shootCooldown = 0;

  // Melee attack state
  isAttacking = false;
  attackTimer = 0;
  attackArc = { start: 0, current: 0 }; // current angle during swing

  // Dash attack
  dashing = false;
  dashTimer = 0;
  dashCooldown = 0;
  dashDirection = 1;
  private readonly DASH_DURATION = 0.15;
  private readonly DASH_SPEED = 600;
  private readonly DASH_COOLDOWN = 0.8;

  // Shield power-up
  shieldActive = false;
  shieldTimer = 0;

  // Magnet power-up
  magnetActive = false;
  magnetTimer = 0;

  // Speed boost
  speedBoostTimer = 0;

  // Invincibility power-up
  invincibilityActive = false;
  invincibilityTimer = 0;

  // Time slow power-up
  timeSlowActive = false;
  timeSlowTimer = 0;

  private config: PlayerConfig;
  onGround = false;
  facingRight = true;
  wallSliding = false;
  touchingWall = false;
  private wasOnGround = false;
  private coyoteTimer = 0;
  private readonly COYOTE_TIME = 0.1; // seconds of coyote time

  constructor(config: PlayerConfig = DEFAULT_PLAYER_CONFIG) {
    this.config = config;
    this.x = config.startX;
    this.y = config.startY;
    this.width = config.width;
    this.height = config.height;
    this.currentWeapon = getWeaponForCharacter('knight');
  }

  /** Apply a character definition's stats and visuals */
  applyCharacter(char: CharacterDef): void {
    this.characterId = char.id;
    this.width = char.width;
    this.height = char.height;
    this.maxHealth = char.maxHealth;
    this.health = char.maxHealth;
    this.currentWeapon = getWeaponForCharacter(char.id);
    this.config = {
      ...DEFAULT_PLAYER_CONFIG,
      speed: DEFAULT_PLAYER_CONFIG.speed * char.speed,
      jumpVelocity: DEFAULT_PLAYER_CONFIG.jumpVelocity * char.jumpVelocity,
      width: char.width,
      height: char.height,
    };
  }

  update(dt: number, input: InputManager, groundY: number, platforms: Platform[] = [], enemies?: { x: number; y: number; width: number; height: number; alive: boolean }[]): void {
    // Tick timers (dt-based)
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
        this.invulnerableTimer = 0;
      }
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.shieldTimer > 0) { this.shieldTimer -= dt; if (this.shieldTimer <= 0) this.shieldActive = false; }
    if (this.magnetTimer > 0) { this.magnetTimer -= dt; if (this.magnetTimer <= 0) this.magnetActive = false; }
    if (this.speedBoostTimer > 0) { this.speedBoostTimer -= dt; if (this.speedBoostTimer <= 0) this.config.speed = DEFAULT_PLAYER_CONFIG.speed; }
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.invincibilityTimer > 0) { this.invincibilityTimer -= dt; if (this.invincibilityTimer <= 0) this.invincibilityActive = false; }
    if (this.timeSlowTimer > 0) { this.timeSlowTimer -= dt; if (this.timeSlowTimer <= 0) this.timeSlowActive = false; }

    // Melee attack timer
    if (this.isAttacking) {
      this.attackTimer -= dt;
      // Animate the arc: interpolate from arcStart to arcEnd over attackDuration
      const weapon = this.currentWeapon;
      const duration = weapon.attackDuration ?? 0.25;
      const progress = 1 - Math.max(0, this.attackTimer) / duration;
      const arcStart = weapon.arcStart ?? -Math.PI / 3;
      const arcEnd = weapon.arcEnd ?? Math.PI / 3;
      this.attackArc.current = arcStart + (arcEnd - arcStart) * progress;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.attackTimer = 0;
      }
    }

    // Dash attack
    const wantDash = input.isPressed('KeyX') || input.isPressed('ShiftLeft');
    if (wantDash && this.dashCooldown <= 0 && !this.dashing) {
      this.dashing = true;
      this.dashTimer = this.DASH_DURATION;
      this.dashCooldown = this.DASH_COOLDOWN;
      this.dashDirection = this.facingRight ? 1 : -1;
      this.invulnerable = true;
      this.invulnerableTimer = Math.max(this.invulnerableTimer, this.DASH_DURATION);
      playSFX('dash');
    }

    if (this.dashing) {
      this.dashTimer -= dt;
      this.vx = this.dashDirection * this.DASH_SPEED;
      this.vy = 0; // float during dash
      if (this.dashTimer <= 0) {
        this.dashing = false;
      }
      // Still move
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < 0) { this.x = 0; this.vx = 0; }
      this.distanceTraveled += Math.abs(this.vx * dt);
      this._updateProjectiles(dt, enemies);
      return;
    }

    // Horizontal movement
    const moveLeft = input.isDown('ArrowLeft') || input.isDown('KeyA');
    const moveRight = input.isDown('ArrowRight') || input.isDown('KeyD');
    const sprint = input.isDown('ShiftRight');
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
      if (this.vx > 0) this.vx = Math.max(0, this.vx - friction * dt);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + friction * dt);
    }

    // Shoot / attack using weapon system (KeyZ or KeyE)
    const wantShoot = input.isPressed('KeyZ') || input.isPressed('KeyE');
    if (wantShoot && this.shootCooldown <= 0 && !this.isAttacking) {
      this._fireWeapon(enemies);
    }

    const wantJump = input.isPressed('Space') || input.isPressed('ArrowUp') || input.isPressed('KeyW');

    // Wall slide — only if falling and pressing toward wall
    this.wallSliding = false;
    if (!this.onGround && this.touchingWall && this.vy > 0) {
      if ((moveLeft && !this.facingRight) || (moveRight && this.facingRight)) {
        this.wallSliding = true;
        this.vy = Math.min(this.vy, 120);
      }
    }

    if (wantJump) {
      if (this.onGround || this.coyoteTimer < this.COYOTE_TIME) {
        this.vy = this.config.jumpVelocity;
        this.onGround = false;
        this.coyoteTimer = this.COYOTE_TIME; // consume coyote time
        this.touchingWall = false;
        this.wallSliding = false;
        playSFX('jump');
      } else if (this.wallSliding) {
        this.vy = this.config.jumpVelocity * 0.9;
        this.vx = this.facingRight ? -maxSpeed * 0.7 : maxSpeed * 0.7;
        this.facingRight = !this.facingRight;
        this.touchingWall = false;
        this.wallSliding = false;
        playSFX('jump');
      } else if (this.canDoubleJump) {
        this.useDoubleJump();
        playSFX('doubleJump');
      }
    }

    this.vy += this.config.gravity * dt;
    if (this.vy > 900) this.vy = 900; // terminal velocity

    this.x += this.vx * dt;
    if (this.x < 0) { this.x = 0; this.vx = 0; }
    this.y += this.vy * dt;

    // Platform collision — one-way platforms (can jump through from below)
    let onPlatform = false;
    if (this.vy >= 0) {
      for (const plat of platforms) {
        if (this.x + this.width > plat.x && this.x < plat.x + plat.width) {
          const prevBottom = (this.y + this.height) - this.vy * dt;
          const currBottom = this.y + this.height;
          // Player was above platform last frame and is now at or below it
          if (prevBottom <= plat.y + 2 && currBottom >= plat.y - 2) {
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

    if (!this.onGround && this.wasOnGround) this.coyoteTimer = 0; // just left ground, start coyote timer
    if (!this.onGround) this.coyoteTimer += dt;

    this.distanceTraveled += Math.abs(this.vx * dt);

    this._updateProjectiles(dt, enemies);
  }

  /** Fire the current weapon */
  private _fireWeapon(enemies?: { x: number; y: number; width: number; height: number; alive: boolean }[]): void {
    const weapon = this.currentWeapon;
    this.shootCooldown = weapon.cooldown;

    if (weapon.type === 'melee') {
      // Melee attack: start the swing animation
      this.isAttacking = true;
      this.attackTimer = weapon.attackDuration ?? 0.25;
      this.attackArc = {
        start: weapon.arcStart ?? -Math.PI / 3,
        current: weapon.arcStart ?? -Math.PI / 3,
      };
      playSFX('attack_swing');
    } else if (weapon.type === 'ranged') {
      // Ranged: spawn projectiles in a spread pattern
      playSFX('shoot');
      const count = weapon.projectileCount ?? 1;
      const spread = weapon.spreadAngle ?? 0;
      const speed = weapon.projectileSpeed ?? 400;
      const dir = this.facingRight ? 1 : -1;
      const baseAngle = this.facingRight ? 0 : Math.PI;

      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * spread;
        const angle = baseAngle + offset;
        this.projectiles.push({
          x: this.x + (this.facingRight ? this.width : 0),
          y: this.y + this.height / 2,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: weapon.range / speed,
          damage: weapon.damage,
          weaponId: weapon.id,
          trail: [],
        });
      }
    } else if (weapon.type === 'homing') {
      // Homing: spawn a single projectile that curves toward nearest enemy
      const speed = weapon.projectileSpeed ?? 300;
      const dir = this.facingRight ? 1 : -1;
      let targetAngle = this.facingRight ? 0 : Math.PI;

      // Find nearest enemy to aim roughly toward
      if (enemies && enemies.length > 0) {
        let nearestDist = Infinity;
        let nearestEnemy: { x: number; y: number; width: number; height: number } | null = null;
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = (e.x + e.width / 2) - (this.x + this.width / 2);
          const dy = (e.y + e.height / 2) - (this.y + this.height / 2);
          const dist = dx * dx + dy * dy;
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = e;
          }
        }
        if (nearestEnemy) {
          const dx = (nearestEnemy.x + nearestEnemy.width / 2) - (this.x + this.width / 2);
          const dy = (nearestEnemy.y + nearestEnemy.height / 2) - (this.y + this.height / 2);
          targetAngle = Math.atan2(dy, dx);
        }
      }

      this.projectiles.push({
        x: this.x + (this.facingRight ? this.width : 0),
        y: this.y + this.height / 2,
        vx: Math.cos(targetAngle) * speed,
        vy: Math.sin(targetAngle) * speed,
        life: weapon.range / speed,
        damage: weapon.damage,
        weaponId: weapon.id,
        homingStrength: weapon.homingStrength ?? 4,
        trail: [],
      });
    }
  }

  private _updateProjectiles(dt: number, enemies?: { x: number; y: number; width: number; height: number; alive: boolean }[]): void {
    this.projectiles = this.projectiles.filter(p => {
      // Store trail position for rendering
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 6) p.trail.shift();
      }

      // Homing: steer toward nearest enemy
      if (p.homingStrength && enemies && enemies.length > 0) {
        let nearestDist = Infinity;
        let nearestEnemy: { x: number; y: number; width: number; height: number } | null = null;
        for (const e of enemies) {
          if (!e.alive) continue;
          const dx = (e.x + e.width / 2) - p.x;
          const dy = (e.y + e.height / 2) - p.y;
          const dist = dx * dx + dy * dy;
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestEnemy = e;
          }
        }
        if (nearestEnemy) {
          const dx = (nearestEnemy.x + nearestEnemy.width / 2) - p.x;
          const dy = (nearestEnemy.y + nearestEnemy.height / 2) - p.y;
          const targetAngle = Math.atan2(dy, dx);
          const currentAngle = Math.atan2(p.vy, p.vx);
          let angleDiff = targetAngle - currentAngle;
          // Normalize to [-PI, PI]
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
          const turnRate = p.homingStrength * dt;
          const newAngle = currentAngle + Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), turnRate);
          const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
          p.vx = Math.cos(newAngle) * speed;
          p.vy = Math.sin(newAngle) * speed;
        }
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  get centerX(): number { return this.x + this.width / 2; }
  get centerY(): number { return this.y + this.height / 2; }
  get bottom(): number { return this.y + this.height; }

  /** Get the melee attack hitbox (area in front of the player during attack) */
  getMeleeHitbox(): { x: number; y: number; width: number; height: number } | null {
    if (!this.isAttacking) return null;
    const weapon = this.currentWeapon;
    const range = weapon.range;
    const dir = this.facingRight ? 1 : -1;
    return {
      x: this.facingRight ? this.x + this.width : this.x - range,
      y: this.y - 4,
      width: range,
      height: this.height + 8,
    };
  }

  takeDamage(amount: number): boolean {
    if (this.invulnerable || !this.alive || this.invincibilityActive) return false;
    if (this.shieldActive) {
      this.shieldActive = false;
      this.shieldTimer = 0;
      return false;
    }
    this.health = Math.max(0, this.health - amount);
    this.invulnerable = true;
    this.invulnerableTimer = 1.5; // 1.5 seconds of invulnerability
    if (this.health <= 0) this.alive = false;
    return true;
  }

  heal(amount: number): void {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  addCoins(amount: number): void {
    this.coins += amount;
    this.score += amount * 10;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  isStomping(): boolean { return this.vy > 0; }

  stompBounce(): void {
    this.vy = this.config.jumpVelocity * 0.6;
  }

  applySpeedBoost(multiplier: number, duration: number = 5): void {
    this.config.speed = DEFAULT_PLAYER_CONFIG.speed * multiplier;
    this.speedBoostTimer = duration;
  }

  applyShield(duration: number = 8): void {
    this.shieldActive = true;
    this.shieldTimer = duration;
  }

  applyMagnet(duration: number = 8): void {
    this.magnetActive = true;
    this.magnetTimer = duration;
  }

  applyInvincibility(duration: number = 5): void {
    this.invincibilityActive = true;
    this.invincibilityTimer = duration;
  }

  applyTimeSlow(duration: number = 6): void {
    this.timeSlowActive = true;
    this.timeSlowTimer = duration;
  }

  private _doubleJump = false;
  hasDoubleJumped = false;
  setDoubleJump(enabled: boolean): void {
    this._doubleJump = enabled;
    this.hasDoubleJumped = false;
  }
  /** Restore double jump so it can be used again mid-air (power-up effect) */
  restoreDoubleJump(): void {
    this._doubleJump = true;
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
