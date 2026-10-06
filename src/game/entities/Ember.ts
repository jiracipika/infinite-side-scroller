/**
 * Ember (baddie) — fire dancer sprinter: fast on the ground, fragile, and
 * always sprinting straight at you once she sees you.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 1800;
const WALK = 112;
const SPRINT = 218;

export class Ember extends Enemy {
  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'ember', { width: 22, height: 32, health: 1, damage: 1, chunkId });
    this.detectRange = 280;
    this.attackRange = 44;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += COURT_GRAVITY * dt;
    if (this.vy > 620) this.vy = 620;
    this.facingRight = playerX >= this.x;
    const speed = (this.aiState === 'chase' || this.aiState === 'attack' ? SPRINT : WALK) * this.speedMult;
    this.vx = this.facingRight ? speed : -speed;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    const sprinting = this.aiState === 'chase' || this.aiState === 'attack';
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: true,
      lunge: sprinting,
    }), '#ff5a3c', true);
  }
}
