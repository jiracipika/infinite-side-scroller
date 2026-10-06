/**
 * Rosalia (baddie) — the rose princess plants herself and whips: a slow
 * patient walk, then a lash with a quick forward snap-step at the start of
 * every swing.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 1800;
const WALK = 55;
const CHASE = 96;
const WHIP_CYCLE = 1.1;
const SNAP_TIME = 0.18;
const SNAP_SPEED = 250;

export class Rosalia extends Enemy {
  private cycle = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'rosalia', { width: 23, height: 33, health: 2, damage: 1, chunkId });
    this.detectRange = 250;
    this.attackRange = 95;
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
      const phase = this.cycle % WHIP_CYCLE;
      if (phase < SNAP_TIME) {
        this.vx = this.facingRight ? SNAP_SPEED * this.speedMult : -SNAP_SPEED * this.speedMult;
      } else {
        this.vx = 0;
      }
    } else {
      this.cycle = 0;
      const speed = (this.aiState === 'chase' ? CHASE : WALK) * this.speedMult;
      this.vx = this.facingRight ? speed : -speed;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    const phase = this.aiState === 'attack' ? (this.cycle % WHIP_CYCLE) / WHIP_CYCLE : 0;
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: Math.abs(this.vx) > 5,
      lunge: phase > 0 && phase < SNAP_TIME / WHIP_CYCLE,
      swing: Math.sin(phase * Math.PI),
    }), '#e63950', true);
  }
}
