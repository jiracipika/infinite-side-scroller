/**
 * Boss - Tough enemy spawned every ~50 chunks
 * Large, multi-hit, shoots projectiles in patterns
 */
import { Enemy } from './Enemy';
import { Projectile } from './Skeleton';

const GRAVITY = 1800;
const BOSS_SPEED = 60;
const SHOOT_COOLDOWN = 0.5;

export class Boss extends Enemy {
  public projectiles: Projectile[] = [];
  private shootTimer = 0;
  private phaseTimer = 0;
  private phase = 0; // alternates attack patterns

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'boss', {
      width: 56, height: 64, health: 15, damage: 2, chunkId,
    });
    this.stompable = false; // can't stomp bosses
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);
    this.phaseTimer += dt;
    this.shootTimer += dt;

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 600) this.vy = 600;

    // Move toward player
    this.facingRight = playerX > this.x;
    const speed = BOSS_SPEED * this.speedMult;
    this.vx = this.facingRight ? speed : -speed;

    // Phase switch every 5 seconds
    if (this.phaseTimer > 5) {
      this.phase = (this.phase + 1) % 2;
      this.phaseTimer = 0;
    }

    // Shoot projectiles
    const cooldown = SHOOT_COOLDOWN / this.speedMult;
    if (this.shootTimer >= cooldown) {
      this.shootTimer = 0;
      this.shoot(playerX, playerY);
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Update projectiles
    this.projectiles = this.projectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += (p.vy ?? 0) * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  private shoot(targetX: number, targetY: number) {
    const dir = targetX > this.x ? 1 : -1;
    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    if (this.phase === 0) {
      // Straight shots
      this.projectiles.push({
        x: cx + dir * 20, y: cy, vx: dir * 200, vy: 0,
        width: 10, height: 10, life: 3, damage: 1,
      });
    } else {
      // Spread shot (3 projectiles)
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(targetY - cy, targetX - cx) + i * 0.3;
        this.projectiles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * 200,
          vy: Math.sin(angle) * 200,
          width: 10, height: 10, life: 3, damage: 1,
        });
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y;

    ctx.save();

    // Body
    ctx.fillStyle = '#8B0000';
    ctx.fillRect(sx, sy, this.width, this.height);

    // Darker outline
    ctx.strokeStyle = '#4A0000';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, this.width, this.height);

    // Face
    ctx.fillStyle = '#FFD700';
    const eyeX = this.facingRight ? sx + 30 : sx + 10;
    ctx.fillRect(eyeX, sy + 12, 8, 8);
    ctx.fillRect(eyeX + 14, sy + 12, 8, 8);

    // Angry eyebrows
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(eyeX - 2, sy + 8, 12, 3);
    ctx.fillRect(eyeX + 12, sy + 8, 12, 3);

    // Mouth
    ctx.fillStyle = '#000';
    ctx.fillRect(sx + 16, sy + 32, 24, 6);

    // Health bar
    const barW = this.width;
    const barH = 4;
    ctx.fillStyle = '#333';
    ctx.fillRect(sx, sy - 10, barW, barH);
    ctx.fillStyle = '#FF0000';
    ctx.fillRect(sx, sy - 10, barW * (this.health / this.maxHealth), barH);

    // Render projectiles
    ctx.fillStyle = '#FF6600';
    for (const p of this.projectiles) {
      const px = p.x - cameraX;
      ctx.beginPath();
      ctx.arc(px, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}
