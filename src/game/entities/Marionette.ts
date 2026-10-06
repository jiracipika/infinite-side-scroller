/**
 * Marionette (baddie) — the doll hops on strings: floaty low-gravity jumps
 * toward the player with a tumble flourish mid-air.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 900;
const HOP = 430;
const HOP_INTERVAL = 0.95;

export class Marionette extends Enemy {
  private hopTimer = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'marionette', { width: 21, height: 32, health: 1, damage: 1, chunkId });
    this.detectRange = 260;
    this.attackRange = 40;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += COURT_GRAVITY * dt;
    if (this.vy > 620) this.vy = 620;
    this.facingRight = playerX >= this.x;

    this.hopTimer += dt;
    if (this.onGround && this.hopTimer >= HOP_INTERVAL / Math.max(0.6, this.speedMult)) {
      this.hopTimer = 0;
      this.vy = -HOP;
      const drift = (this.aiState === 'chase' || this.aiState === 'attack') ? 128 : 46;
      this.vx = this.facingRight ? drift * this.speedMult : -drift * this.speedMult;
    }
    // Air control eases toward the player so hops read intentional.
    if (!this.onGround && (this.aiState === 'chase' || this.aiState === 'attack')) {
      this.vx += ((this.facingRight ? 1 : -1) * 150 * this.speedMult - this.vx) * dt * 2.4;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: Math.abs(this.vx) > 12,
      tumble: !this.onGround,
    }), '#ff3d6e', true);
  }
}
