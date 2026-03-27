/**
 * Jumper - Hops toward the player, aggressive at close range
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const HOP_SPEED = 120;
const AGGRESSIVE_SPEED = 200;
const DETECT_RANGE = 300;
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

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y;

    // Squash/stretch based on vertical velocity
    const stretch = this.onGround ? 1.0 : (this.vy < 0 ? 0.8 : 1.15);
    const w = this.width * (2 - stretch);
    const h = this.height * stretch;

    ctx.save();

    // Body
    ctx.fillStyle = this.chasing ? '#CC4444' : '#CC8844';
    ctx.beginPath();
    ctx.ellipse(sx + this.width / 2, sy + this.height, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Legs (visible when hopping)
    if (!this.onGround) {
      ctx.fillStyle = '#AA6633';
      ctx.fillRect(sx + 3, sy + this.height - 2, 5, 8);
      ctx.fillRect(sx + this.width - 8, sy + this.height - 2, 5, 8);
    }

    // Eyes
    ctx.fillStyle = '#fff';
    ctx.fillRect(sx + 5, sy + 5, 5, 6);
    ctx.fillRect(sx + 14, sy + 5, 5, 6);
    ctx.fillStyle = this.chasing ? '#FF0000' : '#000';
    ctx.fillRect(sx + 7, sy + 8, 2, 3);
    ctx.fillRect(sx + 16, sy + 8, 2, 3);

    // Angry eyebrows when chasing
    if (this.chasing) {
      ctx.strokeStyle = '#000';
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

    ctx.restore();
  }
}
