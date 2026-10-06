/**
 * Mortimer (baddie) — the butler serves: a stately advance and a punctual
 * candelabra swipe at close quarters.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 1800;
const WALK = 62;
const CHASE = 108;
const SWING_CYCLE = 1.0;

export class Mortimer extends Enemy {
  private cycle = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'mortimer', { width: 23, height: 34, health: 4, damage: 1, chunkId });
    this.detectRange = 260;
    this.attackRange = 56;
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
    }), '#ff6b4a', true);
  }
}
