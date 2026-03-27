/**
 * Base enemy class with AI behavior.
 * All enemies extend this.
 */

export type EnemyType = 'slime' | 'bat' | 'skeleton' | 'boss';

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
  chunkId: number; // which chunk spawned this
  animTimer = 0;

  // Stomp interaction
  stompable = true;

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

  abstract update(dt: number, playerX: number, playerY: number): void;

  abstract render(ctx: CanvasRenderingContext2D, cameraX: number): void;

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
}

interface EnemyConfig {
  width: number;
  height: number;
  health: number;
  damage: number;
  chunkId: number;
}
