/**
 * Grimshaw (baddie) — the blood-moon reaper: an elite, slow and relentless,
 * sweeping the huge scythe on a heavy rhythm. Rare, and hits like a boss.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 1800;
const WALK = 40;
const CHASE = 95;
const SWEEP_CYCLE = 1.6;

export class Grimshaw extends Enemy {
  private cycle = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'grimshaw', { width: 25, height: 34, health: 6, damage: 2, chunkId });
    this.detectRange = 290;
    this.attackRange = 66;
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
    const phase = this.aiState === 'attack' ? (this.cycle % SWEEP_CYCLE) / SWEEP_CYCLE : 0;
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: Math.abs(this.vx) > 5,
      swing: Math.sin(phase * Math.PI),
    }), '#dc2626', true);
  }
}
