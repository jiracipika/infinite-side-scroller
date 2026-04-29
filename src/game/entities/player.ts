/**
 * Player entity — the character controlled by the player.
 */

import { InputManager } from '../input/input';
import type { Platform } from '../world/chunk';
import type { CharacterDef } from '../data/characters';

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

export type WeaponType = 'orb' | 'slingshot' | 'bow';

export interface PlayerProjectile {
  x: number;
  y: number;
  vx: number;
  life: number;
  damage: number;
  radius: number;
  color: string;
  glowColor: string;
}

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

  private config: PlayerConfig;
  private baseSpeed: number;
  onGround = false;
  facingRight = true;
  wallSliding = false;
  touchingWall = false;
  private wasOnGround = false;
  private coyoteTimer = 0;
  private readonly COYOTE_TIME = 0.1; // seconds of coyote time
  private jumpBufferTimer = 0;
  private readonly JUMP_BUFFER_TIME = 0.12;

  // Projectiles
  projectiles: PlayerProjectile[] = [];
  private shootCooldown = 0;
  private weaponType: WeaponType = 'orb';
  private weaponTimer = 0;
  private healerRegenTimer = 0;
  private healingAuraTimer = 0;
  private healingAuraTickTimer = 0;

  constructor(config: PlayerConfig = DEFAULT_PLAYER_CONFIG) {
    this.config = config;
    this.baseSpeed = config.speed;
    this.x = config.startX;
    this.y = config.startY;
    this.width = config.width;
    this.height = config.height;
  }

  /** Apply a character definition's stats and visuals */
  applyCharacter(char: CharacterDef): void {
    this.characterId = char.id;
    this.width = char.width;
    this.height = char.height;
    this.maxHealth = char.maxHealth;
    this.health = char.maxHealth;
    this.config = {
      ...DEFAULT_PLAYER_CONFIG,
      speed: DEFAULT_PLAYER_CONFIG.speed * char.speed,
      jumpVelocity: DEFAULT_PLAYER_CONFIG.jumpVelocity * char.jumpVelocity,
      width: char.width,
      height: char.height,
    };
    this.baseSpeed = this.config.speed;
    this.weaponType = this.getBaseWeaponForCharacter();
    this.weaponTimer = 0;
    this.healerRegenTimer = 0;
    this.healingAuraTimer = 0;
    this.healingAuraTickTimer = 0;
  }

  update(dt: number, input: InputManager, groundY: number, platforms: Platform[] = []): void {
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
    if (this.speedBoostTimer > 0) { this.speedBoostTimer -= dt; if (this.speedBoostTimer <= 0) this.config.speed = this.baseSpeed; }
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        this.weaponTimer = 0;
        this.weaponType = this.getBaseWeaponForCharacter();
      }
    }
    if (this.characterId === 'healer' && this.health < this.maxHealth && this.alive) {
      this.healerRegenTimer += dt;
      if (this.healerRegenTimer >= 5.2) {
        this.healerRegenTimer = 0;
        this.heal(1);
      }
    } else {
      this.healerRegenTimer = 0;
    }
    if (this.healingAuraTimer > 0 && this.alive) {
      this.healingAuraTimer = Math.max(0, this.healingAuraTimer - dt);
      this.healingAuraTickTimer += dt;
      if (this.healingAuraTickTimer >= 2.2) {
        this.healingAuraTickTimer = 0;
        this.heal(1);
      }
    } else {
      this.healingAuraTickTimer = 0;
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
      this._updateProjectiles(dt);
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

    // Shoot projectile (KeyZ or KeyE)
    const wantShoot = input.isPressed('KeyZ') || input.isPressed('KeyE');
    if (wantShoot && this.shootCooldown <= 0) {
      const shot = this.getShotProfile();
      this.projectiles.push({
        x: this.x + (this.facingRight ? this.width : 0),
        y: this.y + this.height / 2,
        vx: this.facingRight ? shot.speed : -shot.speed,
        life: shot.life,
        damage: shot.damage,
        radius: shot.radius,
        color: shot.color,
        glowColor: shot.glowColor,
      });
      this.shootCooldown = shot.cooldown;
    }

    const wantJump = input.isPressed('Space') || input.isPressed('ArrowUp') || input.isPressed('KeyW');
    if (wantJump) this.jumpBufferTimer = this.JUMP_BUFFER_TIME;

    // Wall slide — only if falling and pressing toward wall
    this.wallSliding = false;
    if (!this.onGround && this.touchingWall && this.vy > 0) {
      if ((moveLeft && !this.facingRight) || (moveRight && this.facingRight)) {
        this.wallSliding = true;
        this.vy = Math.min(this.vy, 120);
      }
    }

    this.tryConsumeJump(maxSpeed);

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

    // If jump was buffered slightly before landing, consume it immediately.
    if (this.jumpBufferTimer > 0 && this.onGround) {
      this.tryConsumeJump(maxSpeed);
    }

    this.distanceTraveled += Math.abs(this.vx * dt);

    this._updateProjectiles(dt);
  }

  private tryConsumeJump(maxSpeed: number): boolean {
    if (this.jumpBufferTimer <= 0) return false;

    if (this.onGround || this.coyoteTimer < this.COYOTE_TIME) {
      this.vy = this.config.jumpVelocity;
      this.onGround = false;
      this.coyoteTimer = this.COYOTE_TIME; // consume coyote time
      this.touchingWall = false;
      this.wallSliding = false;
      this.jumpBufferTimer = 0;
      return true;
    }

    if (this.wallSliding) {
      this.vy = this.config.jumpVelocity * 0.9;
      this.vx = this.facingRight ? -maxSpeed * 0.7 : maxSpeed * 0.7;
      this.facingRight = !this.facingRight;
      this.touchingWall = false;
      this.wallSliding = false;
      this.jumpBufferTimer = 0;
      return true;
    }

    if (this.canDoubleJump) {
      this.useDoubleJump();
      this.jumpBufferTimer = 0;
      return true;
    }

    return false;
  }

  private _updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter(p => {
      p.x += p.vx * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  get centerX(): number { return this.x + this.width / 2; }
  get centerY(): number { return this.y + this.height / 2; }
  get bottom(): number { return this.y + this.height; }

  takeDamage(amount: number): boolean {
    if (this.invulnerable || !this.alive) return false;
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

  stompBounce(boosted: boolean = false): void {
    this.vy = this.config.jumpVelocity * (boosted ? 0.82 : 0.58);
    this.onGround = false;
    this.hasDoubleJumped = false;
  }

  applySpeedBoost(multiplier: number, duration: number = 5): void {
    this.config.speed = this.baseSpeed * multiplier;
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

  equipWeapon(type: WeaponType, duration: number = 10): void {
    this.weaponType = type;
    this.weaponTimer = Math.max(this.weaponTimer, duration);
  }

  applyHealingAura(duration: number = 10): void {
    this.healingAuraTimer = Math.max(this.healingAuraTimer, duration);
    this.healingAuraTickTimer = 0;
  }

  get currentWeapon(): WeaponType {
    return this.weaponType;
  }

  get hasWeaponPickup(): boolean {
    return this.weaponTimer > 0;
  }

  get healingAuraActive(): boolean {
    return this.healingAuraTimer > 0;
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

  private getBaseWeaponForCharacter(): WeaponType {
    return this.characterId === 'ranger' ? 'bow' : 'orb';
  }

  private getShotProfile(): {
    speed: number;
    life: number;
    damage: number;
    cooldown: number;
    radius: number;
    color: string;
    glowColor: string;
  } {
    if (this.weaponType === 'slingshot') {
      return {
        speed: 540,
        life: 1.2,
        damage: 1,
        cooldown: 0.18,
        radius: 3,
        color: '#f59e0b',
        glowColor: 'rgba(251,191,36,0.45)',
      };
    }

    if (this.weaponType === 'bow') {
      const rangerBonus = this.characterId === 'ranger';
      return {
        speed: rangerBonus ? 790 : 740,
        life: 1.7,
        damage: rangerBonus ? 3 : 2,
        cooldown: rangerBonus ? 0.24 : 0.31,
        radius: 3,
        color: rangerBonus ? '#facc15' : '#f59e0b',
        glowColor: rangerBonus ? 'rgba(250,204,21,0.45)' : 'rgba(245,158,11,0.38)',
      };
    }

    return {
      speed: 400,
      life: 1.5,
      damage: 1,
      cooldown: 0.3,
      radius: 4,
      color: '#60a5fa',
      glowColor: 'rgba(147,197,253,0.5)',
    };
  }
}
