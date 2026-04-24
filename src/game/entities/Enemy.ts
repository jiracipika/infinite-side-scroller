/**
 * Base enemy class with AI state machine.
 * All enemies extend this.
 */

export type EnemyType = 'slime' | 'bat' | 'skeleton' | 'jumper' | 'boss';

export type AIState = 'idle' | 'patrol' | 'chase' | 'attack';

export abstract class Enemy {
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  damage: number;
  type: EnemyType;
  alive = true;
  facingRight = true;
  onGround = false;
  chunkId: number;
  animTimer = 0;
  stompable = true;

  // AI state machine
  aiState: AIState = 'idle';
  aiStateTimer = 0;
  detectRange = 200;
  attackRange = 150;
  patrolSpeed = 60;

  // Difficulty multipliers
  speedMult = 1;
  damageMult = 1;
  healthMult = 1;
  shootCooldownMult = 1;

  constructor(x: number, y: number, type: EnemyType, config?: Partial<EnemyConfig>) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = config?.width ?? 32;
    this.height = config?.height ?? 32;
    this.health = config?.health ?? 1;
    this.maxHealth = this.health;
    this.damage = config?.damage ?? 1;
    this.chunkId = config?.chunkId ?? 0;
  }

  /** Apply difficulty multipliers */
  applyDifficulty(
    speedMult: number,
    damageMult: number,
    healthMult: number,
    detectMult: number,
    shootCooldownMult: number = 1
  ): void {
    this.speedMult = speedMult;
    this.damageMult = damageMult;
    this.healthMult = healthMult;
    this.shootCooldownMult = shootCooldownMult;
    this.detectRange *= detectMult;
    // Scale health on spawn
    if (this.health === this.maxHealth) {
      this.health = Math.ceil(this.health * healthMult);
      this.maxHealth = this.health;
    }
  }

  /** Update AI state based on player proximity */
  protected updateAI(dt: number, playerX: number, playerY: number): void {
    this.aiStateTimer += dt;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const prev = this.aiState;

    if (dist < this.attackRange) {
      this.aiState = 'attack';
    } else if (dist < this.detectRange) {
      this.aiState = 'chase';
    } else {
      // Idle -> patrol cycle
      if (this.aiState === 'idle' && this.aiStateTimer > 1.5 + Math.random()) {
        this.aiState = 'patrol';
        this.aiStateTimer = 0;
        this.facingRight = Math.random() > 0.5;
      } else if (this.aiState === 'patrol' && this.aiStateTimer > 2 + Math.random() * 2) {
        this.aiState = 'idle';
        this.aiStateTimer = 0;
      }
    }

    // On state change, reset timer
    if (prev !== this.aiState) {
      this.aiStateTimer = 0;
    }
  }

  abstract update(dt: number, playerX: number, playerY: number): void;
  abstract render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY?: number): void;

  getBounds() {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  takeDamage(amount = 1) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  get effectiveDamage(): number {
    return Math.ceil(this.damage * this.damageMult);
  }
}

interface EnemyConfig {
  width: number;
  height: number;
  health: number;
  damage: number;
  chunkId: number;
}
