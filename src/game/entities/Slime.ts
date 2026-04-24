/**
 * Slime - Bounces on platforms, damages on contact. Walker type.
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const MOVE_SPEED = 100;

export class Slime extends Enemy {
  private bounceTimer = 0;
  private bounceInterval = 1.5;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'slime', {
      width: 28, height: 24, health: 1, damage: 1, chunkId,
    });
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 600) this.vy = 600;

    const speed = MOVE_SPEED * this.speedMult;

    if (this.aiState === 'chase') {
      this.facingRight = playerX > this.x;
      this.vx = this.facingRight ? speed * 1.5 : -speed * 1.5;
    } else if (this.aiState === 'patrol') {
      this.vx = this.facingRight ? speed : -speed;
    } else {
      this.vx *= 0.9;
    }

    // Bounce when on ground
    if (this.onGround) {
      this.bounceTimer += dt;
      if (this.bounceTimer >= this.bounceInterval / this.speedMult) {
        this.vy = -300;
        this.bounceTimer = 0;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y;

    const squish = this.onGround ? 1 + Math.sin(this.animTimer * 7) * 0.1 : 0.85;
    const w = this.width * (2 - squish);
    const h = this.height * squish;
    const cx = sx + this.width / 2;
    const cy = sy + this.height - h * 0.1;

    ctx.save();
    const bodyGradient = ctx.createRadialGradient(cx - 4, cy - 8, 2, cx, cy, w * 0.7);
    bodyGradient.addColorStop(0, '#86efac');
    bodyGradient.addColorStop(1, '#16a34a');
    ctx.fillStyle = bodyGradient;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    // Slime sheen and eyes
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.ellipse(cx - w * 0.16, cy - h * 0.22, w * 0.14, h * 0.11, -0.2, 0, Math.PI * 2);
    ctx.fill();

    const eyeY = sy + 8;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(sx + 6, eyeY, 5, 4);
    ctx.fillRect(sx + 17, eyeY, 5, 4);
    ctx.fillStyle = '#052e16';
    ctx.fillRect(sx + 8, eyeY + 1, 2, 2);
    ctx.fillRect(sx + 19, eyeY + 1, 2, 2);

    ctx.strokeStyle = '#14532d';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(cx, sy + 16, 4, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
}
