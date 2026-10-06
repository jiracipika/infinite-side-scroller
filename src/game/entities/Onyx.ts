/**
 * Onyx (baddie) — the oni wall: slow, very tanky, hits hard, swings his
 * kanabo in a steady rhythm once you are close.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 1800;
const WALK = 45;
const CHASE = 85;
const SWING_CYCLE = 1.2;

export class Onyx extends Enemy {
  private cycle = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'onyx', { width: 26, height: 35, health: 6, damage: 2, chunkId });
    this.detectRange = 240;
    this.attackRange = 58;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += COURT_GRAVITY * dt;
    if (this.vy > 620) this.vy = 620;
    this.facingRight = playerX >= this.x;

    if (this.aiState === 'attack') {
      this.cycle += dt;
      this.vx = 0;
    } else {
      this.cycle = 0;
      const speed = (this.aiState === 'chase' ? CHASE : WALK) * this.speedMult;
      this.vx = this.facingRight ? speed : -speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    const phase = this.aiState === 'attack' ? (this.cycle % SWING_CYCLE) / SWING_CYCLE : 0;
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: Math.abs(this.vx) > 5,
      swing: Math.sin(phase * Math.PI),
    }), '#ff2e2e', true);
  }
}
