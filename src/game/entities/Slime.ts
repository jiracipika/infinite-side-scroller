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

    // Squish animation
    const squish = this.onGround ? 1 + Math.sin(this.animTimer * 3) * 0.1 : 0.85;
    const w = this.width * (2 - squish);
    const h = this.height * squish;

    ctx.save();
    ctx.fillStyle = '#44BB44';
    ctx.beginPath();
    ctx.ellipse(sx + this.width / 2, sy + this.height, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 6, sy + 6, 5, 5);
    ctx.fillRect(sx + 17, sy + 6, 5, 5);
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 8, sy + 8, 2, 2);
    ctx.fillRect(sx + 19, sy + 8, 2, 2);

    ctx.restore();
  }
}
