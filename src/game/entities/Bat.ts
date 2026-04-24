/**
 * Bat - Flies in sine wave, follows player if close
 */
import { Enemy } from './Enemy';

const FLY_SPEED = 120;
const CHASE_SPEED = 200;

export class Bat extends Enemy {
  private flyTimer = 0;
  private amplitude = 40;
  private frequency = 3;
  private chasing = false;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'bat', {
      width: 28, height: 20, health: 1, damage: 1, chunkId,
    });
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;

    const dx = playerX - this.x;
    const dy = playerY - this.y;
    this.updateAI(dt, playerX, playerY);

    if (this.aiState === 'chase' || this.aiState === 'attack') {
      this.chasing = true;
      const speed = CHASE_SPEED * this.speedMult;
      const angle = Math.atan2(dy, dx);
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
    } else {
      this.chasing = false;
      this.flyTimer += dt;
      const speed = FLY_SPEED * this.speedMult;
      this.vx = this.facingRight ? speed : -speed;
      this.vy = Math.cos(this.flyTimer * this.frequency) * this.amplitude;
    }

    this.facingRight = this.vx > 0;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;

    const wingFlap = Math.sin(this.animTimer * 18) * 9;
    const bodyX = sx + this.width / 2;
    const bodyY = sy + this.height / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.18)';
    ctx.beginPath();
    ctx.ellipse(bodyX, sy + this.height + 4, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings read first so the small face stays crisp.
    ctx.fillStyle = this.chasing ? '#7c3aed' : '#6d28d9';
    ctx.beginPath();
    ctx.moveTo(bodyX - 5, bodyY - 1);
    ctx.quadraticCurveTo(sx - 8, sy + 1 + wingFlap, sx + 4, sy + 17);
    ctx.lineTo(bodyX - 1, bodyY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(bodyX + 5, bodyY - 1);
    ctx.quadraticCurveTo(sx + this.width + 8, sy + 1 - wingFlap, sx + this.width - 4, sy + 17);
    ctx.lineTo(bodyX + 1, bodyY + 5);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#5b21b6';
    ctx.beginPath();
    ctx.ellipse(bodyX, bodyY, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2e1065';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(sx + 9, sy + 7, 3, 3);
    ctx.fillRect(sx + 16, sy + 7, 3, 3);
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(sx + 10, sy + 8, 1, 1);
    ctx.fillRect(sx + 17, sy + 8, 1, 1);

    // Tiny fangs
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(bodyX - 2, sy + 13, 1.5, 2);
    ctx.fillRect(bodyX + 0.5, sy + 13, 1.5, 2);

    ctx.restore();
  }
}
