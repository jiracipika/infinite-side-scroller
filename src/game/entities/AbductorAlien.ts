/**
 * AbductorAlien - late-game sky enemy that dives from above and tries to abduct the player.
 * Spawns high in the sky, dives toward the player, hovers above them, then activates a
 * green tractor beam to pull the player upward.
 */
import { Enemy } from './Enemy';

const DIVE_SPEED = 280;
const HOVER_SPEED = 100;

export class AbductorAlien extends Enemy {
  beamActive = false;
  disruptTimer = 0;
  private phase: 'diving' | 'hovering' | 'beaming' = 'diving';
  private phaseTimer = 0;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'abductor', {
      width: 32, height: 44, health: 3, damage: 1, chunkId,
    });
    this.stompable = true;
    this.detectRange = 320;
    this.attackRange = 140;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.phaseTimer += dt;
    if (this.disruptTimer > 0) this.disruptTimer = Math.max(0, this.disruptTimer - dt);

    const dx = playerX - (this.x + this.width / 2);
    const dist = Math.hypot(dx, playerY - this.y);

    if (dist > this.detectRange || this.disruptTimer > 0) {
      // Float gently out of range or while disrupted
      this.vx += (Math.sin(this.animTimer * 0.6) * 25 - this.vx) * 2 * dt;
      this.vy += (Math.sin(this.animTimer * 0.4) * 18 - this.vy) * 2 * dt;
      this.beamActive = false;
      this.phase = 'diving';
      this.phaseTimer = 0;
    } else {
      const targetHoverY = playerY - 140;

      if (this.phase === 'diving') {
        const dyToTarget = targetHoverY - this.y;
        this.vx += (dx * 1.2 - this.vx) * 3.5 * dt;
        this.vy += (dyToTarget * 2.2 - this.vy) * 2.8 * dt;
        this.vx = Math.max(-DIVE_SPEED, Math.min(DIVE_SPEED, this.vx));
        this.vy = Math.max(-DIVE_SPEED, Math.min(DIVE_SPEED, this.vy));

        if (Math.abs(dyToTarget) < 35 && Math.abs(dx) < 200) {
          this.phase = 'hovering';
          this.phaseTimer = 0;
        }
      } else {
        const dyToTarget = targetHoverY - this.y;
        this.vx += (dx * 0.5 - this.vx) * 2.5 * dt;
        this.vx = Math.max(-HOVER_SPEED * this.speedMult, Math.min(HOVER_SPEED * this.speedMult, this.vx));
        this.vy = dyToTarget * 2.5 + Math.sin(this.animTimer * 3.2) * 22;

        this.beamActive = this.disruptTimer <= 0
          && this.phaseTimer > 0.7
          && Math.abs(dx) < 75
          && playerY > this.y;

        if (this.phaseTimer > 4.5 && !this.beamActive) {
          // Re-dive to reposition
          this.phase = 'diving';
          this.phaseTimer = 0;
        }
      }

      this.facingRight = dx > 0;
    }

    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  getBeamBounds() {
    return {
      x: this.x + this.width / 2 - 26,
      y: this.y + this.height,
      width: 52,
      height: 190,
    };
  }

  disrupt(): void {
    this.beamActive = false;
    this.disruptTimer = 1.6;
    this.phase = 'diving';
    this.phaseTimer = 0;
    this.vy = -120;
    this.takeDamage(1);
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    if (!this.alive) return;
    const sx = this.x - cameraX;
    const sy = this.y - cameraY;
    const cx = sx + this.width / 2;
    const bob = Math.sin(this.animTimer * 3.8) * 2.5;
    const pulse = 0.5 + Math.sin(this.animTimer * 9) * 0.5;

    ctx.save();

    // Tractor beam (drawn behind enemy)
    if (this.beamActive) {
      const beam = this.getBeamBounds();
      const bx = beam.x - cameraX;
      const by = beam.y - cameraY;
      const bGrad = ctx.createLinearGradient(cx, by, cx, by + beam.height);
      bGrad.addColorStop(0, `rgba(120, 255, 80, ${0.40 + pulse * 0.14})`);
      bGrad.addColorStop(0.55, `rgba(100, 220, 60, ${0.18 + pulse * 0.06})`);
      bGrad.addColorStop(1, 'rgba(80, 180, 40, 0.01)');
      ctx.fillStyle = bGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 14, sy + this.height + bob);
      ctx.lineTo(cx + 14, sy + this.height + bob);
      ctx.lineTo(bx + beam.width, by + beam.height);
      ctx.lineTo(bx, by + beam.height);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = `rgba(140, 255, 90, ${0.28 + pulse * 0.18})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 14, sy + this.height + bob);
      ctx.lineTo(bx, by + beam.height);
      ctx.moveTo(cx + 14, sy + this.height + bob);
      ctx.lineTo(bx + beam.width, by + beam.height);
      ctx.stroke();
    }

    // Ground shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + this.height + 5 + bob, this.width * 0.4, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Small torso
    const bodyGrad = ctx.createLinearGradient(cx - 9, sy + 26 + bob, cx + 9, sy + this.height + bob);
    bodyGrad.addColorStop(0, '#34d399');
    bodyGrad.addColorStop(1, '#065f46');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 34 + bob, 9, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tentacle arms
    const armSway = Math.sin(this.animTimer * 5) * 9;
    ctx.strokeStyle = '#34d399';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - 8, sy + 28 + bob);
    ctx.quadraticCurveTo(cx - 22, sy + 36 + bob + armSway, cx - 20, sy + 47 + bob + armSway * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 8, sy + 28 + bob);
    ctx.quadraticCurveTo(cx + 22, sy + 36 + bob - armSway, cx + 20, sy + 47 + bob - armSway * 0.5);
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 6, sy + 32 + bob);
    ctx.quadraticCurveTo(cx - 28, sy + 38 + bob - armSway * 0.7, cx - 25, sy + 50 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, sy + 32 + bob);
    ctx.quadraticCurveTo(cx + 28, sy + 38 + bob + armSway * 0.7, cx + 25, sy + 50 + bob);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // Big alien head
    const headGrad = ctx.createRadialGradient(cx - 5, sy + 9 + bob, 2, cx, sy + 14 + bob, 18);
    headGrad.addColorStop(0, '#a7f3d0');
    headGrad.addColorStop(0.5, '#10b981');
    headGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = headGrad;
    ctx.beginPath();
    ctx.ellipse(cx, sy + 14 + bob, 16, 19, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#064e3b';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Cranial detail
    ctx.strokeStyle = 'rgba(4,120,87,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cx - 8, sy + 5 + bob);
    ctx.quadraticCurveTo(cx - 4, sy + 1 + bob, cx, sy + 3 + bob);
    ctx.moveTo(cx + 6, sy + 4 + bob);
    ctx.quadraticCurveTo(cx + 10, sy + 1 + bob, cx + 12, sy + 6 + bob);
    ctx.stroke();

    // Large almond eyes
    ctx.fillStyle = '#020617';
    ctx.beginPath();
    ctx.ellipse(cx - 6, sy + 13 + bob, 5.5, 7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 6, sy + 13 + bob, 5.5, 7, 0.3, 0, Math.PI * 2);
    ctx.fill();

    const eyeGlow = this.beamActive ? '#7fff00' : '#bbf7d0';
    ctx.fillStyle = eyeGlow;
    ctx.globalAlpha = this.beamActive ? 0.9 + pulse * 0.1 : 0.55 + pulse * 0.2;
    ctx.beginPath();
    ctx.ellipse(cx - 7, sy + 11 + bob, 2.2, 3.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 5, sy + 11 + bob, 2.2, 3.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Antennae
    ctx.strokeStyle = '#6ee7b7';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - 6, sy - 4 + bob);
    ctx.lineTo(cx - 11, sy - 16 + bob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 6, sy - 4 + bob);
    ctx.lineTo(cx + 11, sy - 16 + bob);
    ctx.stroke();

    const orb = this.beamActive ? '#7fff00' : '#a3e635';
    ctx.fillStyle = orb;
    ctx.globalAlpha = this.beamActive ? 0.9 + pulse * 0.1 : 0.75;
    ctx.beginPath();
    ctx.arc(cx - 11, sy - 16 + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 11, sy - 16 + bob, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Disruption sparks
    if (this.disruptTimer > 0) {
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy + 2 + bob);
      ctx.lineTo(sx + 8, sy - 7 + bob);
      ctx.lineTo(sx + 14, sy + 2 + bob);
      ctx.moveTo(sx + 18, sy + 1 + bob);
      ctx.lineTo(sx + 25, sy - 9 + bob);
      ctx.lineTo(sx + 30, sy + 1 + bob);
      ctx.stroke();
    }

    ctx.restore();
  }
}
