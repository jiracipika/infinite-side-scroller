/**
 * Jumper - Hops toward the player, aggressive at close range
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const HOP_SPEED = 120;
const AGGRESSIVE_SPEED = 200;
const HOP_INTERVAL = 1.0;

export class Jumper extends Enemy {
  private hopTimer = 0;
  private hopInterval = HOP_INTERVAL;
  private chasing = false;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'jumper', {
      width: 24, height: 28, health: 2, damage: 1, chunkId,
    });
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);
    this.chasing = this.aiState === 'chase' || this.aiState === 'attack';

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 600) this.vy = 600;

    // Hop toward player when on ground
    if (this.onGround) {
      this.hopTimer += dt;
      if (this.hopTimer >= this.hopInterval) {
        const speed = (this.aiState === 'chase' ? AGGRESSIVE_SPEED : HOP_SPEED) * this.speedMult;
        if (this.aiState === 'chase') this.facingRight = playerX > this.x;
        this.vx = this.facingRight ? speed : -speed;
        this.vy = -400 - (this.aiState === 'chase' ? 100 : 0);
        this.hopTimer = 0;
      } else {
        this.vx *= 0.9;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    const stretch = this.onGround ? 1.0 : (this.vy < 0 ? 0.8 : 1.15);
    const w = this.width * (2 - stretch);
    const h = this.height * stretch;
    const cx = sx + this.width / 2;
    const cy = sy + this.height - 2;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height + 4, this.width * 0.44, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(0, sy, 0, sy + this.height);
    body.addColorStop(0, this.chasing ? '#f97316' : '#f59e0b');
    body.addColorStop(1, this.chasing ? '#b91c1c' : '#9a3412');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Legs (visible when hopping)
    if (!this.onGround) {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(sx + 3, sy + this.height - 2, 5, 8);
      ctx.fillRect(sx + this.width - 8, sy + this.height - 2, 5, 8);
    }

    // Eyes
    ctx.fillStyle = '#fff7ed';
    ctx.fillRect(sx + 5, sy + 5, 5, 6);
    ctx.fillRect(sx + 14, sy + 5, 5, 6);
    ctx.fillStyle = this.chasing ? '#7f1d1d' : '#111827';
    ctx.fillRect(sx + 7, sy + 8, 2, 3);
    ctx.fillRect(sx + 16, sy + 8, 2, 3);

    // Brows and jaw
    if (this.chasing) {
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(sx + 5, sy + 4);
      ctx.lineTo(sx + 10, sy + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx + 19, sy + 4);
      ctx.lineTo(sx + 14, sy + 6);
      ctx.stroke();
    }
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, sy + 16, 4, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    ctx.restore();
  }
}
