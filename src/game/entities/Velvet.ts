/**
 * Velvet (baddie) — the countess hunts: floaty glide, then a sudden fan
 * lunge. No gravity; hovers with a sine bob like the wisp but faster.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const GLIDE_SPEED = 128;
const LUNGE_SPEED = 330;
const LUNGE_TIME = 0.34;
const LUNGE_COOLDOWN = 1.5;

export class Velvet extends Enemy {
  private lungeTimer = 0;
  private cooldown = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'velvet', { width: 22, height: 33, health: 2, damage: 1, chunkId });
    this.detectRange = 260;
    this.attackRange = 60;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.facingRight = playerX >= this.x;
    this.cooldown -= dt;
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.hypot(dx, dy);

    if (this.lungeTimer > 0) {
      // Committed lunge: keep the locked direction.
      this.lungeTimer -= dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      return;
    }

    if ((this.aiState === 'chase' || this.aiState === 'attack') && dist < 150 && this.cooldown <= 0) {
      // Fan lunge: burst toward the player's current position.
      const angle = Math.atan2(dy, dx);
      const speed = LUNGE_SPEED * this.speedMult;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.lungeTimer = LUNGE_TIME;
      this.cooldown = LUNGE_COOLDOWN;
      return;
    }

    if (this.aiState === 'chase' || this.aiState === 'attack') {
      const speed = GLIDE_SPEED * this.speedMult;
      this.vx = Math.cos(Math.atan2(dy, dx)) * speed;
      this.vy = Math.sin(Math.atan2(dy, dx)) * speed + Math.sin(this.animTimer * 2.4) * 26;
    } else {
      const speed = 52 * this.speedMult;
      this.vx = this.facingRight ? speed : -speed;
      this.vy = Math.sin(this.animTimer * 2) * 30;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    const lunging = this.lungeTimer > 0;
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: !lunging && Math.hypot(this.vx, this.vy) > 20,
      lunge: lunging,
    }), '#d81e4f', false);
  }
}
