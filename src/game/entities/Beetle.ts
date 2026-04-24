/**
 * Beetle - small early-game crawler with a low, readable stomp target.
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const CRAWL_SPEED = 72;

export class Beetle extends Enemy {
  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'beetle', {
      width: 22, height: 16, health: 1, damage: 1, chunkId,
    });
    this.detectRange = 155;
    this.attackRange = 34;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += GRAVITY * dt;
    if (this.vy > 620) this.vy = 620;

    const speed = CRAWL_SPEED * this.speedMult;
    if (this.aiState === 'chase' || this.aiState === 'attack') {
      this.facingRight = playerX > this.x;
      this.vx = this.facingRight ? speed * 1.45 : -speed * 1.45;
    } else if (this.aiState === 'patrol') {
      this.vx = this.facingRight ? speed : -speed;
    } else {
      this.vx *= 0.82;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    const cx = sx + this.width / 2;
    const legOffset = Math.sin(this.animTimer * 14) * 1.4;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height + 3, this.width * 0.42, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const x = sx + 5 + i * 6;
      ctx.beginPath();
      ctx.moveTo(x, sy + 11);
      ctx.lineTo(x - 3, sy + 15 + (i % 2 === 0 ? legOffset : -legOffset));
      ctx.moveTo(x + 2, sy + 11);
      ctx.lineTo(x + 5, sy + 15 + (i % 2 === 0 ? -legOffset : legOffset));
      ctx.stroke();
    }

    const shell = ctx.createLinearGradient(0, sy, 0, sy + this.height);
    shell.addColorStop(0, '#facc15');
    shell.addColorStop(0.5, '#a16207');
    shell.addColorStop(1, '#422006');
    ctx.fillStyle = shell;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 9, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#422006';
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.24)';
    ctx.beginPath();
    ctx.moveTo(cx, sy + 3);
    ctx.lineTo(cx, sy + 15);
    ctx.stroke();

    ctx.fillStyle = '#fefce8';
    const eyeX = this.facingRight ? sx + 16 : sx + 4;
    ctx.fillRect(eyeX, sy + 6, 3, 3);
    ctx.fillStyle = '#111827';
    ctx.fillRect(eyeX + 1, sy + 7, 1, 1);
    ctx.restore();
  }
}
