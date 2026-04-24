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
    const cooldown = Math.max(0.16, (SHOOT_COOLDOWN / this.speedMult) * this.shootCooldownMult);
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
    const pulse = 0.9 + Math.sin(this.animTimer * 4) * 0.1;

    ctx.save();

    const shell = ctx.createLinearGradient(sx, sy, sx, sy + this.height);
    shell.addColorStop(0, '#7f1d1d');
    shell.addColorStop(1, '#3f0b0b');
    ctx.fillStyle = shell;
    ctx.fillRect(sx, sy, this.width, this.height);

    // Armor plates
    ctx.fillStyle = '#450a0a';
    ctx.fillRect(sx + 6, sy + 8, this.width - 12, 10);
    ctx.fillRect(sx + 6, sy + 24, this.width - 12, 8);

    ctx.strokeStyle = '#2f0909';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx, sy, this.width, this.height);

    // Horns
    ctx.fillStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(sx + 8, sy + 3);
    ctx.lineTo(sx + 2, sy - 10);
    ctx.lineTo(sx + 12, sy + 1);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx + this.width - 8, sy + 3);
    ctx.lineTo(sx + this.width - 2, sy - 10);
    ctx.lineTo(sx + this.width - 12, sy + 1);
    ctx.closePath();
    ctx.fill();

    // Core eye
    const eyeX = sx + this.width / 2;
    const eyeY = sy + 19;
    ctx.fillStyle = '#fef08a';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b91c1c';
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 3 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Jaw
    ctx.fillStyle = '#111827';
    ctx.fillRect(sx + 14, sy + 38, 28, 8);
    ctx.fillStyle = '#fca5a5';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(sx + 16 + i * 5, sy + 37, 2, 3);
    }

    // Health bar
    const barW = this.width;
    const barH = 4;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx, sy - 10, barW, barH);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(sx, sy - 10, barW * (this.health / this.maxHealth), barH);

    // Render projectiles
    ctx.fillStyle = '#fb7185';
    for (const p of this.projectiles) {
      const px = p.x - cameraX;
      ctx.beginPath();
      ctx.arc(px, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(251,113,133,0.35)';
      ctx.beginPath();
      ctx.arc(px, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb7185';
    }

    ctx.restore();
  }
}
