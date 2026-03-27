/**
 * Bat - Flies in sine wave, follows player if close
 */
import { Enemy } from './Enemy';

const FLY_SPEED = 120;
const CHASE_SPEED = 200;
const DETECT_RANGE = 250;

export class Bat extends Enemy {
  private baseY: number;
  private flyTimer = 0;
  private amplitude = 40;
  private frequency = 3;
  private chasing = false;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'bat', {
      width: 28, height: 20, health: 1, damage: 1, chunkId,
    });
    this.baseY = y;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;

    // Check if player is close
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
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

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y;

    const wingFlap = Math.sin(this.animTimer * 15) * 8;

    ctx.save();
    ctx.fillStyle = '#8844AA';

    // Body
    ctx.beginPath();
    ctx.ellipse(sx + this.width / 2, sy + this.height / 2, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.beginPath();
    ctx.moveTo(sx + 6, sy + 8);
    ctx.lineTo(sx - 6, sy + 2 + wingFlap);
    ctx.lineTo(sx + 4, sy + 14);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(sx + 22, sy + 8);
    ctx.lineTo(sx + 34, sy + 2 - wingFlap);
    ctx.lineTo(sx + 24, sy + 14);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#FF4444';
    ctx.fillRect(sx + 9, sy + 6, 3, 3);
    ctx.fillRect(sx + 16, sy + 6, 3, 3);

    ctx.restore();
  }
}
