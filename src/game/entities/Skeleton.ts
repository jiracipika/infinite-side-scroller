/**
 * Skeleton - Walks on platforms and throws projectiles at the player
 */
import { Enemy } from './Enemy';

const GRAVITY = 1800;
const WALK_SPEED = 80;
const THROW_RANGE = 300;
const THROW_COOLDOWN = 2.0;

export class Skeleton extends Enemy {
  throwTimer = 0;
  public projectiles: Projectile[] = [];

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'skeleton', {
      width: 28, height: 44, health: 2, damage: 1, chunkId,
    });
  }

  update(dt: number, playerX: number, _playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, _playerY);

    // Gravity
    this.vy += GRAVITY * dt;
    if (this.vy > 600) this.vy = 600;

    // Face player
    this.facingRight = playerX > this.x;

    const speed = WALK_SPEED * this.speedMult;
    const cooldown = THROW_COOLDOWN * Math.max(0.35, (1 / this.speedMult) * this.shootCooldownMult);

    if (this.aiState === 'attack') {
      this.vx = 0;
      this.throwTimer += dt;
      if (this.throwTimer >= cooldown) {
        this.throwProjectile(playerX);
        this.throwTimer = 0;
      }
    } else if (this.aiState === 'chase') {
      this.vx = this.facingRight ? speed * 1.5 : -speed * 1.5;
      this.throwTimer += dt;
      if (this.throwTimer >= cooldown * 1.5) {
        this.throwProjectile(playerX);
        this.throwTimer = 0;
      }
    } else {
      this.vx = this.facingRight ? speed * 0.5 : -speed * 0.5;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Update projectiles
    this.projectiles = this.projectiles.filter(p => {
      p.x += p.vx * dt;
      p.life -= dt;
      return p.life > 0;
    });
  }

  private throwProjectile(targetX: number) {
    const dir = targetX > this.x ? 1 : -1;
    this.projectiles.push({
      x: this.x + this.width / 2 + dir * 10,
      y: this.y + 10,
      vx: dir * 250,
      width: 8,
      height: 8,
      life: 3,
      damage: 1,
    });
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y;

    ctx.save();

    // Torso and ribcage
    ctx.fillStyle = '#e7e5e4';
    ctx.fillRect(sx + 5, sy + 12, 18, 24);
    ctx.strokeStyle = '#78716c';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 5, sy + 12, 18, 24);
    ctx.fillStyle = '#a8a29e';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(sx + 7, sy + 16 + i * 5, 14, 1.5);
    }

    // Skull
    ctx.fillStyle = '#f5f5f4';
    ctx.fillRect(sx + 4, sy, 20, 16);
    ctx.strokeStyle = '#78716c';
    ctx.strokeRect(sx + 4, sy, 20, 16);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(sx + 8, sy + 4, 5, 5);
    ctx.fillRect(sx + 16, sy + 4, 5, 5);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(sx + 9, sy + 5, 2, 2);
    ctx.fillRect(sx + 17, sy + 5, 2, 2);

    // Jaw
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(sx + 8, sy + 12, 12, 3);

    // Legs
    const legAnim = Math.sin(this.animTimer * 8) * 3;
    ctx.fillStyle = '#d6d3d1';
    ctx.fillRect(sx + 6, sy + 36, 5, 8 + legAnim);
    ctx.fillRect(sx + 17, sy + 36, 5, 8 - legAnim);
    ctx.fillStyle = '#57534e';
    ctx.fillRect(sx + 5, sy + 43 + legAnim, 7, 2);
    ctx.fillRect(sx + 16, sy + 43 - legAnim, 7, 2);

    // Render projectiles
    ctx.fillStyle = '#f97316';
    for (const p of this.projectiles) {
      const px = p.x - cameraX;
      ctx.beginPath();
      ctx.arc(px, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(254,215,170,0.35)';
      ctx.beginPath();
      ctx.arc(px, p.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f97316';
    }

    ctx.restore();
  }
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy?: number;
  width: number;
  height: number;
  life: number;
  damage: number;
}
