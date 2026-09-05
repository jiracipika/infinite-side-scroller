/**
 * Player entity — the character controlled by the player.
 */

import { InputManager } from "../input/input";
import type { Platform } from "../world/chunk";
import type { CharacterDef } from "../data/characters";
import {
  DEFAULT_PROGRESSION_BONUSES,
  type PlayerProgressionBonuses,
} from "../../lib/progression";

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

export type WeaponType = "orb" | "slingshot" | "bow" | "magicBolt";

/**
 * A timed power-up with its remaining duration (seconds).
 * Used by the HUD to render countdown bars so players can anticipate expiry.
 */
export type PowerUpType =
  | "shield"
  | "speedBoost"
  | "magnet"
  | "slingshot"
  | "bow"
  | "healingAura";

export interface PowerUpTimer {
  type: PowerUpType;
  remaining: number;
}

export interface PlayerProjectile {
  x: number;
  y: number;
  vx: number;
  life: number;
  damage: number;
  radius: number;
  color: string;
  glowColor: string;
  /**
   * Magic bolts pierce: they survive the first enemy hit instead of being
   * destroyed. The engine decrements this on each enemy hit; when it reaches
   * 0 the projectile is removed like a normal one.
   */
  pierce?: number;
  /** Trail positions for the magic bolt visual — last N positions, newest first. */
  trail?: Array<{ x: number; y: number }>;
  /** Marks the projectile as a magic bolt so the renderer can draw its trail. */
  isMagicBolt?: boolean;
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
  lives = 2;
  private coinsAtLastLife = 0;

  characterId: string = "knight";

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

  // Melee attack — sword / blade swing arc for knight, ninja, tank, cyborg.
  // The swing spawns a hitbox in front of the player for a brief window and
  // is rendered as a white/cyan semi-transparent arc by the engine.
  meleeActive = false;
  meleeTimer = 0;          // remaining active-hitbox time
  meleeCooldown = 0;       // cooldown remaining before next swing
  meleeDirection = 1;      // 1 = facing right, -1 = facing left
  private meleeMaxDuration = 0.2;
  private meleeMaxRange = 48;
  private meleeDamageValue = 2;
  private meleeMaxCooldown = 0.4;
  private meleeEnabled = false;

  // Magic bolt — Mage's enhanced projectile. When true, the default orb shot
  // is replaced by a piercing purple bolt with a trail and double damage.
  private hasMagicBolt = false;

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

  /**
   * Airborne flip/pose intensity for the renderer (0 = neutral). Set to 1
   * when the double jump is consumed, then decays smoothly to 0 so the
   * sprite reads a quick tumble rather than a permanent pose. The renderer
   * adds an eased rotation from this value; gameplay physics ignore it.
   */
  airbornePose = 0;
  private readonly JUMP_BUFFER_TIME = 0.12;

  // Projectiles
  projectiles: PlayerProjectile[] = [];
  private shootCooldown = 0;
  private weaponType: WeaponType = "orb";
  private weaponTimer = 0;
  private healerRegenTimer = 0;
  private healingAuraTimer = 0;
  private healingAuraTickTimer = 0;
  /**
   * Optional callback fired whenever the player gains health (regen, aura,
   * coin-luck heal, health pickup). The engine uses this to spawn heal
   * particles at the player's position, giving visual feedback for passive
   * healing that previously happened silently.
   */
  onHeal: (() => void) | null = null;
  private progressionBonuses: PlayerProgressionBonuses = {
    ...DEFAULT_PROGRESSION_BONUSES,
  };
  private autoReviveUsed = false;
  private coinFractionRemainder = 0;
  private characterSpeedScale = 1;
  private characterJumpScale = 1;
  private characterKnockbackResistance = 0;
  private baseMaxHealth = 3;

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
    this.baseMaxHealth = char.maxHealth;
    this.characterSpeedScale = char.speed;
    this.characterJumpScale = char.jumpVelocity;
    this.characterKnockbackResistance = Math.max(0, Math.min(1, char.knockbackResistance ?? 0));
    this.config = {
      ...DEFAULT_PLAYER_CONFIG,
      speed: DEFAULT_PLAYER_CONFIG.speed * char.speed,
      jumpVelocity: DEFAULT_PLAYER_CONFIG.jumpVelocity * char.jumpVelocity,
      width: char.width,
      height: char.height,
    };
    this.baseSpeed = this.config.speed;
    this.applyProgressionBonuses(this.progressionBonuses);
    this.health = this.maxHealth;
    this.weaponType = this.getBaseWeaponForCharacter();
    this.weaponTimer = 0;
    this.healerRegenTimer = 0;
    this.healingAuraTimer = 0;
    this.healingAuraTickTimer = 0;
    this.autoReviveUsed = false;
    this.coinFractionRemainder = 0;
    this.setDoubleJump(this.hasInnateDoubleJump());

    // Melee combat — knight, ninja, tank, cyborg carry blades.
    this.meleeEnabled = !!char.hasMelee;
    this.meleeMaxCooldown = char.meleeCooldown ?? 0.4;
    this.meleeDamageValue = char.meleeDamage ?? 2;
    this.meleeMaxRange = char.meleeRange ?? 48;
    this.meleeMaxDuration = char.meleeDuration ?? 0.2;
    this.meleeActive = false;
    this.meleeTimer = 0;
    this.meleeCooldown = 0;

    // Magic bolt — Mage's signature enhanced projectile.
    this.hasMagicBolt = !!char.hasMagicBolt;
  }

  applyProgressionBonuses(bonuses: PlayerProgressionBonuses): void {
    this.progressionBonuses = { ...DEFAULT_PROGRESSION_BONUSES, ...bonuses };
    const previousMax = this.maxHealth;
    this.config = {
      ...this.config,
      speed:
        DEFAULT_PLAYER_CONFIG.speed *
        this.characterSpeedScale *
        this.progressionBonuses.speedMultiplier,
      jumpVelocity:
        DEFAULT_PLAYER_CONFIG.jumpVelocity *
        this.characterJumpScale *
        this.progressionBonuses.jumpMultiplier,
    };
    this.baseSpeed = this.config.speed;
    this.maxHealth = Math.max(
      1,
      Math.floor(this.baseMaxHealth + this.progressionBonuses.extraMaxHealth),
    );
    if (this.health > this.maxHealth) this.health = this.maxHealth;
    if (this.health >= previousMax) this.health = this.maxHealth;
    this.autoReviveUsed = false;
  }

  update(
    dt: number,
    input: InputManager,
    groundY: number,
    platforms: Platform[] = [],
  ): void {
    // Tick timers (dt-based)
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      if (this.invulnerableTimer <= 0) {
        this.invulnerable = false;
        this.invulnerableTimer = 0;
      }
    }
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    // Melee cooldown tick
    if (this.meleeCooldown > 0) {
      this.meleeCooldown -= dt;
      if (this.meleeCooldown < 0) this.meleeCooldown = 0;
    }
    // Melee active-hitbox timer
    if (this.meleeTimer > 0) {
      this.meleeTimer -= dt;
      if (this.meleeTimer <= 0) {
        this.meleeTimer = 0;
        this.meleeActive = false;
      }
    }
    if (this.shieldTimer > 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) this.shieldActive = false;
    }
    if (this.magnetTimer > 0) {
      this.magnetTimer -= dt;
      if (this.magnetTimer <= 0) this.magnetActive = false;
    }
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer -= dt;
      if (this.speedBoostTimer <= 0) this.config.speed = this.baseSpeed;
    }
    // (Jump buffer decay lives next to the press read below — it must freeze
    // while dashing, which the dash early-return would otherwise skip.)

    // Airborne tumble pose decays smoothly (about 0.5s to fully settle).
    if (this.airbornePose > 0) {
      this.airbornePose = Math.max(0, this.airbornePose - dt * 2);
    }
    if (this.shootCooldown > 0) this.shootCooldown -= dt;
    if (this.weaponTimer > 0) {
      this.weaponTimer -= dt;
      if (this.weaponTimer <= 0) {
        this.weaponTimer = 0;
        this.weaponType = this.getBaseWeaponForCharacter();
      }
    }
    if (
      this.characterId === "healer" &&
      this.health < this.maxHealth &&
      this.alive
    ) {
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

    // Jump buffering — record the press FIRST so it survives the dash
    // early-return below and is honored the moment the dash ends, instead of
    // being silently dropped.
    const wantJump =
      input.isPressed("Space") ||
      input.isPressed("ArrowUp") ||
      input.isPressed("KeyW");
    if (wantJump) this.jumpBufferTimer = this.JUMP_BUFFER_TIME;
    // A dash (0.15s) outlives the jump buffer (0.12s) — freeze the buffer
    // while dashing so a jump pressed mid-dash fires as a dash-jump the
    // moment the dash ends instead of expiring unused.
    else if (this.jumpBufferTimer > 0 && !this.dashing)
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);

    // Resolve intent before dash so simultaneous direction + dash works
    // for keyboard, touch and analog gamepads alike.
    const horizontalAxis = typeof input.getHorizontalAxis === "function"
      ? input.getHorizontalAxis()
      : (input.isDown("ArrowLeft") || input.isDown("KeyA"))
        ? -1
        : (input.isDown("ArrowRight") || input.isDown("KeyD"))
          ? 1
          : 0;

    // Dash attack
    const wantDash = input.isPressed("KeyX") || input.isPressed("ShiftLeft");
    if (wantDash && this.dashCooldown <= 0 && !this.dashing) {
      this.dashing = true;
      this.dashTimer = this.DASH_DURATION;
      this.dashCooldown =
        this.DASH_COOLDOWN * this.progressionBonuses.dashCooldownMultiplier;
      if (horizontalAxis !== 0) this.facingRight = horizontalAxis > 0;
      this.dashDirection = this.facingRight ? 1 : -1;
      this.invulnerable = true;
      this.invulnerableTimer = Math.max(
        this.invulnerableTimer,
        this.DASH_DURATION,
      );
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
      if (this.x < 0) {
        this.x = 0;
        this.vx = 0;
      }
      this.distanceTraveled += Math.abs(this.vx * dt);
      this._updateProjectiles(dt);
      return;
    }

    // Melee attack (KeyC / KeyJ) — spawns a hitbox arc for melee-enabled
    // characters. The actual enemy collision is resolved by the engine each
    // frame while meleeActive is true; here we only arm the swing.
    if (this.meleeEnabled) {
      const wantMelee = input.isPressed("KeyC") || input.isPressed("KeyJ");
      if (wantMelee && this.meleeCooldown <= 0 && !this.meleeActive) {
        this.meleeActive = true;
        this.meleeTimer = this.meleeMaxDuration;
        this.meleeCooldown = this.meleeMaxCooldown;
        this.meleeDirection = this.facingRight ? 1 : -1;
      }
    }

    // Horizontal movement
    const moveLeft = horizontalAxis < 0;
    const moveRight = horizontalAxis > 0;
    const sprint = input.isDown("ShiftRight");
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
    const wantShoot = input.isPressed("KeyZ") || input.isPressed("KeyE");
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
        pierce: shot.pierce,
        isMagicBolt: shot.isMagicBolt,
      });
      this.shootCooldown = shot.cooldown;
    }

    // Jump press is read at the top of update() (before the dash early-return)
    // so a jump tapped during a dash is buffered and honored when it ends
    // instead of being silently dropped.

    // Wall slide — only if falling and pressing toward wall
    this.wallSliding = false;
    if (!this.onGround && this.touchingWall && this.vy > 0) {
      if ((moveLeft && !this.facingRight) || (moveRight && this.facingRight)) {
        this.wallSliding = true;
        this.vy = Math.min(this.vy, 120);
      }
    }

    // Pre-collision jump attempt: handles coyote/wall/double-jump cases.
    // The double-jump branch is suppressed when a landing is imminent this
    // very step, so a press a hair above the ground resolves as a ground jump
    // (via the post-collision retry below) instead of wasting the double jump.
    const imminentLanding = this.vy >= 0 && this.wouldLandThisStep(dt, groundY, platforms);
    this.tryConsumeJump(maxSpeed, imminentLanding);

    this.vy += this.config.gravity * dt;
    if (this.vy > 900) this.vy = 900; // terminal velocity

    this.x += this.vx * dt;
    if (this.x < 0) {
      this.x = 0;
      this.vx = 0;
    }
    this.y += this.vy * dt;

    // Platform collision — one-way platforms (can jump through from below)
    let onPlatform = false;
    if (this.vy >= 0) {
      for (const plat of platforms) {
        if (this.x + this.width > plat.x && this.x < plat.x + plat.width) {
          const prevBottom = this.y + this.height - this.vy * dt;
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
      this.airbornePose = 0; // landing clears any residual tumble
    } else if (onPlatform) {
      this.onGround = true;
      this.coyoteTimer = 0;
      this.hasDoubleJumped = false;
      this.airbornePose = 0; // landing clears any residual tumble
    } else {
      this.onGround = false;
    }

    if (!this.onGround && this.wasOnGround) this.coyoteTimer = 0; // just left ground, start coyote timer
    if (!this.onGround) this.coyoteTimer += dt;

    // If a jump was buffered slightly before landing, consume it now — after
    // collision has resolved, so it fires as a full ground jump (and leaves
    // the double jump available) rather than being spent mid-air a frame
    // earlier as a wasted double jump.
    if (this.jumpBufferTimer > 0 && this.onGround) {
      this.tryConsumeJump(maxSpeed);
    }

    this.distanceTraveled += Math.abs(this.vx * dt);

    this._updateProjectiles(dt);
  }

  private tryConsumeJump(maxSpeed: number, suppressDoubleJump = false): boolean {
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

    if (this.canDoubleJump && !suppressDoubleJump) {
      this.useDoubleJump();
      this.jumpBufferTimer = 0;
      return true;
    }

    // Buffer kept when suppressed (about to land) or nothing matched — the
    // post-collision retry or a subsequent frame will resolve it.
    return false;
  }

  /**
   * Predict whether gravity + movement this step would put the player at or
   * past a landing surface (ground or one-way platform top). Used to hold a
   * fresh jump press for the ground branch instead of spending it as a double
   * jump a few pixels above touchdown. Gravity is applied after the jump
   * check inside update(), so this uses the post-gravity vy the collision
   * step will actually resolve with.
   */
  private wouldLandThisStep(dt: number, groundY: number, platforms: Platform[]): boolean {
    const stepVy = Math.min(this.vy + this.config.gravity * dt, 900);
    const previousBottom = this.y + this.height;
    const projectedBottom = previousBottom + stepVy * dt;
    const projectedX = Math.max(0, this.x + this.vx * dt);
    if (groundY !== Infinity && projectedBottom >= groundY) return true;
    if (stepVy >= 0) {
      for (const plat of platforms) {
        // Match the actual one-way collision test, including its tolerance
        // and post-movement horizontal bounds. An overhead platform is not
        // a landing, nor is a ledge we leave during this step.
        if (projectedX + this.width > plat.x && projectedX < plat.x + plat.width &&
            previousBottom <= plat.y + 2 && projectedBottom >= plat.y - 2) {
          return true;
        }
      }
    }
    return false;
  }

  private _updateProjectiles(dt: number) {
    let writeIdx = 0;
    for (let readIdx = 0; readIdx < this.projectiles.length; readIdx++) {
      const p = this.projectiles[readIdx];
      p.x += p.vx * dt;
      p.life -= dt;
      // Magic bolts push their current position onto the trail for the
      // renderer's afterglow effect. Keep the last 8 positions so the trail
      // is visible but bounded.
      if (p.isMagicBolt) {
        if (!p.trail) p.trail = [];
        p.trail.unshift({ x: p.x, y: p.y });
        if (p.trail.length > 8) p.trail.length = 8;
      }
      if (p.life > 0) {
        this.projectiles[writeIdx++] = p;
      }
    }
    this.projectiles.length = writeIdx;
  }

  /** Expose movement parameters for net prediction/replay (read-only snapshot). */
  getMovementTuning(): {
    speed: number;
    jumpVelocity: number;
    gravity: number;
  } {
    return {
      speed: this.config.speed,
      jumpVelocity: this.config.jumpVelocity,
      gravity: this.config.gravity,
    };
  }

  get centerX(): number {
    return this.x + this.width / 2;
  }
  get centerY(): number {
    return this.y + this.height / 2;
  }
  get bottom(): number {
    return this.y + this.height;
  }

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
    const before = this.health;
    this.health = Math.min(this.maxHealth, this.health + amount);
    if (this.health > before && this.onHeal) this.onHeal();
  }

  addCoins(amount: number): void {
    const total =
      amount * this.progressionBonuses.coinMultiplier +
      this.coinFractionRemainder;
    const gained = Math.max(0, Math.floor(total));
    this.coinFractionRemainder = Math.max(0, total - gained);
    this.coins += gained;
    this.score += gained * 10;
    if (
      this.progressionBonuses.healOnCoinChance > 0 &&
      this.health < this.maxHealth &&
      Math.random() < this.progressionBonuses.healOnCoinChance
    ) {
      this.heal(1);
    }
    // Award an extra life every 100 coins after progression multipliers are applied.
    if (this.coins - this.coinsAtLastLife >= 100) {
      this.coinsAtLastLife = Math.floor(this.coins / 100) * 100;
      this.lives++;
    }
  }

  /** Grant an extra life (used by cross-player life awards). */
  grantLife(): void {
    this.lives++;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  isStomping(): boolean {
    return this.vy > 0;
  }

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
    this.shieldTimer =
      duration * this.progressionBonuses.shieldDurationMultiplier;
  }

  applyMagnet(duration: number = 8): void {
    this.magnetActive = true;
    this.magnetTimer =
      duration * this.progressionBonuses.magnetDurationMultiplier;
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

  /**
   * Melee hitbox: a rectangle in front of the player for the duration of the
   * swing. Returns null when no swing is active.
   */
  getMeleeHitbox(): { x: number; y: number; width: number; height: number } | null {
    if (!this.meleeActive) return null;
    const range = this.meleeMaxRange;
    const dir = this.meleeDirection;
    // The hitbox spans the player's height vertically (slightly taller for
    // forgiveness) and extends `range` pixels in the facing direction.
    const padding = 4;
    return {
      x: dir > 0 ? this.x + this.width - padding : this.x - range + padding,
      y: this.y - 4,
      width: range + padding * 2,
      height: this.height + 8,
    };
  }

  get meleeDamage(): number {
    return this.meleeDamageValue;
  }

  get hasMeleeWeapon(): boolean {
    return this.meleeEnabled;
  }

  /** Normalized swing progress 0..1 for rendering the arc animation. */
  get meleeProgress(): number {
    if (this.meleeMaxDuration <= 0 || !this.meleeActive) return 0;
    return 1 - this.meleeTimer / this.meleeMaxDuration;
  }

  /**
   * Snapshot of all currently-active timed power-ups with their remaining
   * durations. Consumed by the engine → HUD pipeline to render countdown
   * indicators so players can see when effects will expire.
   *
   * Entries with 0 remaining time are omitted — only active effects appear.
   * The snapshot is a plain object (not live) so callers can use it without
   * worrying about mutation between frames.
   */
  getActivePowerUpTimers(): PowerUpTimer[] {
    const result: PowerUpTimer[] = [];
    if (this.shieldActive && this.shieldTimer > 0)
      result.push({ type: "shield", remaining: this.shieldTimer });
    if (this.speedBoostTimer > 0)
      result.push({ type: "speedBoost", remaining: this.speedBoostTimer });
    if (this.magnetActive && this.magnetTimer > 0)
      result.push({ type: "magnet", remaining: this.magnetTimer });
    if (this.weaponTimer > 0)
      result.push({ type: this.weaponType === "bow" ? "bow" : "slingshot", remaining: this.weaponTimer });
    if (this.healingAuraTimer > 0)
      result.push({ type: "healingAura", remaining: this.healingAuraTimer });
    return result;
  }

  get magnetRadius(): number {
    return 150 + this.progressionBonuses.magnetRadiusBonus;
  }

  /** Multiplier applied to incoming knockback velocity (0 = none, 1 = full). */
  get knockbackScale(): number {
    return 1 - this.characterKnockbackResistance;
  }

  tryAutoRevive(): boolean {
    if (
      !this.progressionBonuses.autoReviveOnce ||
      this.autoReviveUsed ||
      this.alive
    )
      return false;
    this.autoReviveUsed = true;
    this.alive = true;
    this.health = Math.max(1, Math.ceil(this.maxHealth * 0.5));
    this.invulnerable = true;
    this.invulnerableTimer = Math.max(this.invulnerableTimer, 2.5);
    this.vy = this.config.jumpVelocity * 0.75;
    this.onGround = false;
    return true;
  }

  /**
   * Spend run coins to recover from death. This is separate from the
   * progression auto-revive so multiplayer can keep a paid revive in-session.
   */
  tryCoinRevive(cost: number = 25): boolean {
    const reviveCost = Math.max(0, Math.floor(cost));
    if (this.alive || this.coins < reviveCost) return false;

    this.coins -= reviveCost;
    this.health = Math.max(1, this.maxHealth);
    this.alive = true;
    this.invulnerable = true;
    this.invulnerableTimer = Math.max(this.invulnerableTimer, 2.5);
    this.vy = this.config.jumpVelocity * 0.7;
    this.onGround = false;
    this.hasDoubleJumped = false;
    return true;
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
  get canDoubleJump(): boolean {
    return (this._doubleJump || this.hasInnateDoubleJump()) && !this.hasDoubleJumped;
  }
  useDoubleJump(): void {
    if (this.canDoubleJump) {
      this.vy = this.config.jumpVelocity;
      this.hasDoubleJumped = true;
      // Visual: engage the tumble pose (renderer eases rotation from this).
      this.airbornePose = 1;
    }
  }

  private hasInnateDoubleJump(): boolean {
    return this.characterId === "ninja" || this.characterId === "mage" || this.characterId === "spirit";
  }

  private getBaseWeaponForCharacter(): WeaponType {
    if (this.characterId === "ranger") return "bow";
    if (this.hasMagicBolt) return "magicBolt";
    return "orb";
  }

  private getShotProfile(): {
    speed: number;
    life: number;
    damage: number;
    cooldown: number;
    radius: number;
    color: string;
    glowColor: string;
    pierce: number;
    isMagicBolt: boolean;
  } {
    if (this.weaponType === "magicBolt") {
      return {
        speed: 460 * this.progressionBonuses.projectileSpeedMultiplier,
        life: 1.8,
        damage: 2 + this.progressionBonuses.projectileDamageBonus,
        cooldown: 0.34,
        radius: 6,
        color: "#a855f7",
        glowColor: "rgba(168,85,247,0.55)",
        // Pierce through the first enemy hit before being consumed.
        pierce: 1,
        isMagicBolt: true,
      };
    }

    if (this.weaponType === "slingshot") {
      return {
        speed: 540 * this.progressionBonuses.projectileSpeedMultiplier,
        life: 1.2,
        damage: 1 + this.progressionBonuses.projectileDamageBonus,
        cooldown: 0.18,
        radius: 3,
        color: "#f59e0b",
        glowColor: "rgba(251,191,36,0.45)",
        pierce: 0,
        isMagicBolt: false,
      };
    }

    if (this.weaponType === "bow") {
      const rangerBonus = this.characterId === "ranger";
      return {
        speed:
          (rangerBonus ? 790 : 740) *
          this.progressionBonuses.projectileSpeedMultiplier,
        life: 1.7,
        damage:
          (rangerBonus ? 3 : 2) + this.progressionBonuses.projectileDamageBonus,
        cooldown: rangerBonus ? 0.24 : 0.31,
        radius: 3,
        color: rangerBonus ? "#facc15" : "#f59e0b",
        glowColor: rangerBonus
          ? "rgba(250,204,21,0.45)"
          : "rgba(245,158,11,0.38)",
        pierce: 0,
        isMagicBolt: false,
      };
    }

    return {
      speed: 400 * this.progressionBonuses.projectileSpeedMultiplier,
      life: 1.5,
      damage: 1 + this.progressionBonuses.projectileDamageBonus,
      cooldown: 0.3,
      radius: 4,
      color: "#60a5fa",
      glowColor: "rgba(147,197,253,0.5)",
      pierce: 0,
      isMagicBolt: false,
    };
  }
}
