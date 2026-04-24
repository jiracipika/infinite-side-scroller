/**
 * Mite - later small crawler that darts in short bursts.
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const WALK_SPEED = 95;
const DASH_SPEED = 250;

export class Mite extends Enemy {
  private dashTimer = 0;
  private restTimer = 0.6;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'mite', {
      width: 20, height: 18, health: 1, damage: 1, chunkId,
    });
    this.detectRange = 235;
    this.attackRange = 50;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += GRAVITY * dt;
    if (this.vy > 650) this.vy = 650;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.vx = (this.facingRight ? DASH_SPEED : -DASH_SPEED) * this.speedMult;
    } else {
      this.restTimer -= dt;
      if (this.aiState === 'chase' || this.aiState === 'attack') {
        this.facingRight = playerX > this.x;
      }
      const speed = WALK_SPEED * this.speedMult;
      this.vx = this.facingRight ? speed : -speed;
      if (this.restTimer <= 0 && this.onGround) {
        this.dashTimer = 0.22;
        this.restTimer = 0.9;
        this.vy = -120;
      }
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    const cx = sx + this.width / 2;
    const stretched = this.dashTimer > 0;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height + 3, this.width * 0.45, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const body = ctx.createLinearGradient(0, sy, 0, sy + this.height);
    body.addColorStop(0, '#fb7185');
    body.addColorStop(1, '#7f1d1d');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 10, stretched ? 12 : 9, stretched ? 5 : 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#450a0a';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.moveTo(this.facingRight ? sx + 18 : sx + 2, sy + 8);
    ctx.lineTo(this.facingRight ? sx + 23 : sx - 3, sy + 5);
    ctx.lineTo(this.facingRight ? sx + 20 : sx, sy + 12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#fef2f2';
    const eyeX = this.facingRight ? sx + 12 : sx + 5;
    ctx.fillRect(eyeX, sy + 7, 3, 3);
    ctx.fillStyle = '#7f1d1d';
    ctx.fillRect(eyeX + 1, sy + 8, 1, 1);
    ctx.restore();
  }
}
