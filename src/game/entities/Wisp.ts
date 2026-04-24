/**
 * Wisp - tiny floating enemy that drifts near coin paths.
 */
import { Enemy } from './Enemy';

const DRIFT_SPEED = 58;
const CHASE_SPEED = 118;

export class Wisp extends Enemy {
  private originY: number;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'wisp', {
      width: 18, height: 18, health: 1, damage: 1, chunkId,
    });
    this.originY = y;
    this.detectRange = 210;
    this.attackRange = 46;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    if (this.aiState === 'chase' || this.aiState === 'attack') {
      const angle = Math.atan2(dy, dx);
      const speed = CHASE_SPEED * this.speedMult;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    } else {
      const speed = DRIFT_SPEED * this.speedMult;
      this.vx = this.facingRight ? speed : -speed;
      this.vy = Math.sin(this.animTimer * 2.2) * 38 + (this.originY - this.y) * 0.6;
      if (this.animTimer > 2.2) {
        this.animTimer = 0;
        this.facingRight = !this.facingRight;
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
    const cy = sy + this.height / 2;
    const pulse = 0.65 + Math.sin(this.animTimer * 10) * 0.18;

    ctx.save();
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 15);
    glow.addColorStop(0, 'rgba(255,255,255,0.9)');
    glow.addColorStop(0.45, 'rgba(125,211,252,0.75)');
    glow.addColorStop(1, 'rgba(14,165,233,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 15 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 6, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(cx - 3, cy - 1, 2, 2);
    ctx.fillRect(cx + 2, cy - 1, 2, 2);
    ctx.restore();
  }
}
