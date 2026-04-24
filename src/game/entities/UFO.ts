/**
 * UFO - late-game flying enemy that tries to abduct the player.
 */
import { Enemy } from './Enemy';

const PATROL_SPEED = 90;
const CHASE_SPEED = 145;

export class UFO extends Enemy {
  beamActive = false;
  disruptTimer = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'ufo', {
      width: 58, height: 28, health: 3, damage: 1, chunkId,
    });
    this.stompable = false;
    this.detectRange = 360;
    this.attackRange = 190;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    if (this.disruptTimer > 0) this.disruptTimer = Math.max(0, this.disruptTimer - dt);
    this.updateAI(dt, playerX, playerY);

    const dx = playerX - (this.x + this.width / 2);
    const targetY = Math.min(playerY - 150, this.y + 60);
    const dy = targetY - this.y;
    const speed = (this.aiState === 'chase' || this.aiState === 'attack' ? CHASE_SPEED : PATROL_SPEED) * this.speedMult;

    this.facingRight = dx > 0;
    if (this.aiState === 'chase' || this.aiState === 'attack') {
      this.vx = Math.max(-speed, Math.min(speed, dx * 1.4));
      this.vy = Math.max(-90, Math.min(90, dy * 1.6));
    } else {
      this.vx = (this.facingRight ? PATROL_SPEED : -PATROL_SPEED) * this.speedMult;
      this.vy = Math.sin(this.animTimer * 2.4) * 24;
    }

    this.beamActive = this.disruptTimer <= 0 && this.aiState === 'attack' && Math.abs(dx) < 80 && playerY > this.y;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  getBeamBounds() {
    return {
      x: this.x + this.width / 2 - 36,
      y: this.y + this.height - 2,
      width: 72,
      height: 210,
    };
  }

  disrupt(): void {
    this.beamActive = false;
    this.disruptTimer = 1.4;
    this.takeDamage(1);
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    const cx = sx + this.width / 2;
    const cy = sy + this.height / 2;
    const pulse = 0.5 + Math.sin(this.animTimer * 8) * 0.5;

    ctx.save();

    if (this.beamActive) {
      const beam = this.getBeamBounds();
      const bx = beam.x - cameraX;
      const by = beam.y - cameraY;
      const grad = ctx.createLinearGradient(bx, by, bx, by + beam.height);
      grad.addColorStop(0, `rgba(125, 249, 255, ${0.32 + pulse * 0.12})`);
      grad.addColorStop(1, 'rgba(125, 249, 255, 0.02)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(cx - 18, sy + this.height - 2);
      ctx.lineTo(bx + beam.width, by + beam.height);
      ctx.lineTo(bx, by + beam.height);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = 'rgba(15,23,42,0.16)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height + 8, this.width * 0.35, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const saucer = ctx.createLinearGradient(0, sy, 0, sy + this.height);
    saucer.addColorStop(0, '#cbd5e1');
    saucer.addColorStop(0.5, '#64748b');
    saucer.addColorStop(1, '#334155');
    ctx.fillStyle = saucer;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 5, 28, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const dome = ctx.createRadialGradient(cx - 6, sy + 5, 2, cx, sy + 10, 18);
    dome.addColorStop(0, '#e0f2fe');
    dome.addColorStop(1, '#38bdf8');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 10, 16, 10, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = '#0369a1';
    ctx.stroke();

    const lights = ['#fef08a', '#a7f3d0', '#f0abfc'];
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = lights[i];
      ctx.globalAlpha = i === Math.floor(this.animTimer * 8) % 3 ? 1 : 0.45;
      ctx.beginPath();
      ctx.arc(cx - 16 + i * 16, cy + 9, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.disruptTimer > 0) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx + 10, sy - 2);
      ctx.lineTo(sx + 16, sy - 8);
      ctx.lineTo(sx + 21, sy - 2);
      ctx.moveTo(sx + 38, sy - 3);
      ctx.lineTo(sx + 44, sy - 10);
      ctx.lineTo(sx + 49, sy - 3);
      ctx.stroke();
    }

    ctx.restore();
  }
}
