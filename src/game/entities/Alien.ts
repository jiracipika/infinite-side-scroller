/**
 * Alien - mid-game ground enemy with a quick zig-zag chase.
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const WALK_SPEED = 92;
const CHASE_SPEED = 155;

export class Alien extends Enemy {
  private wobbleTimer = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'alien', {
      width: 26, height: 34, health: 2, damage: 1, chunkId,
    });
    this.detectRange = 260;
    this.attackRange = 58;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.wobbleTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += GRAVITY * dt;
    if (this.vy > 620) this.vy = 620;

    const chasing = this.aiState === 'chase' || this.aiState === 'attack';
    if (chasing) {
      this.facingRight = playerX > this.x;
      const wobble = Math.sin(this.wobbleTimer * 7) * 28;
      this.vx = (this.facingRight ? CHASE_SPEED : -CHASE_SPEED) * this.speedMult + wobble;
    } else if (this.aiState === 'patrol') {
      this.vx = (this.facingRight ? WALK_SPEED : -WALK_SPEED) * this.speedMult;
    } else {
      this.vx *= 0.86;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    const cx = sx + this.width / 2;
    const bob = Math.sin(this.animTimer * 8) * 1.5;

    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,0.22)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height + 4, this.width * 0.42, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Antennae
    ctx.strokeStyle = '#166534';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 5, sy + 8 + bob);
    ctx.quadraticCurveTo(cx - 10, sy - 2 + bob, cx - 13, sy - 6 + bob);
    ctx.moveTo(cx + 5, sy + 8 + bob);
    ctx.quadraticCurveTo(cx + 10, sy - 2 + bob, cx + 13, sy - 6 + bob);
    ctx.stroke();
    ctx.fillStyle = '#a3e635';
    ctx.beginPath(); ctx.arc(cx - 13, sy - 6 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 13, sy - 6 + bob, 2.5, 0, Math.PI * 2); ctx.fill();

    const body = ctx.createLinearGradient(0, sy, 0, sy + this.height);
    body.addColorStop(0, '#bef264');
    body.addColorStop(0.55, '#65a30d');
    body.addColorStop(1, '#365314');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 19 + bob, 12, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1f3b0d';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Oversized glassy eyes
    ctx.fillStyle = '#ecfeff';
    ctx.beginPath(); ctx.ellipse(cx - 5, sy + 14 + bob, 4, 5, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 5, sy + 14 + bob, 4, 5, 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.ellipse(cx - 4, sy + 15 + bob, 1.8, 2.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 4, sy + 15 + bob, 1.8, 2.8, 0, 0, Math.PI * 2); ctx.fill();

    // Little boots sell the stomp target.
    const foot = Math.sin(this.animTimer * 10) * 2;
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(sx + 4, sy + this.height - 2 + foot, 8, 3);
    ctx.fillRect(sx + this.width - 12, sy + this.height - 2 - foot, 8, 3);

    ctx.restore();
  }
}
