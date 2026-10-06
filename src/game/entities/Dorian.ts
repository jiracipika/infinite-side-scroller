/**
 * Dorian (baddie) — the duelist: stalks at a walk, telegraphs, then
 * commits to a fast rapier lunge with a long recovery. High threat,
 * readable window.
 */
import { Enemy } from './Enemy';
import { courtPose, renderCourtBaddie } from './court';

const COURT_GRAVITY = 1800;
const STALK = 148;
const TELL_TIME = 0.32;
const LUNGE_TIME = 0.26;
const LUNGE_SPEED = 430;
const RECOVER = 1.4;

type Phase = 'stalk' | 'tell' | 'lunge';

export class Dorian extends Enemy {
  private phase: Phase = 'stalk';
  private phaseTimer = 0;
  private lungeDir = 1;

  constructor(x: number, y: number, chunkId: number) {
    super(x, y, 'dorian', { width: 24, height: 34, health: 2, damage: 1, chunkId });
    this.detectRange = 300;
    this.attackRange = 130;
  }

  update(dt: number, playerX: number, playerY: number) {
    if (!this.alive) return;
    this.animTimer += dt;
    this.updateAI(dt, playerX, playerY);

    this.vy += COURT_GRAVITY * dt;
    if (this.vy > 620) this.vy = 620;
    this.phaseTimer += dt;

    if (this.phase === 'tell') {
      this.vx = 0;
      if (this.phaseTimer >= TELL_TIME) {
        this.phase = 'lunge';
        this.phaseTimer = 0;
        this.vx = this.lungeDir * LUNGE_SPEED * this.speedMult;
      }
    } else if (this.phase === 'lunge') {
      if (this.phaseTimer >= LUNGE_TIME) {
        this.phase = 'stalk';
        this.phaseTimer = -RECOVER; // recovery folded into the timer debt
      }
    } else {
      this.facingRight = playerX >= this.x;
      const engaged = this.aiState === 'chase' || this.aiState === 'attack';
      if (engaged && this.phaseTimer >= 0 && this.aiState === 'attack') {
        // Begin the duel: plant, telegraph, commit.
        this.phase = 'tell';
        this.phaseTimer = 0;
        this.lungeDir = this.facingRight ? 1 : -1;
        this.vx = 0;
      } else {
        const speed = (engaged ? STALK : 62) * this.speedMult;
        this.vx = this.facingRight ? speed : -speed;
      }
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, cameraY: number = 0) {
    renderCourtBaddie(ctx, this, cameraX, cameraY, courtPose(this, {
      moving: this.phase === 'stalk' && Math.abs(this.vx) > 5,
      lunge: this.phase === 'lunge',
      swing: this.phase === 'lunge' ? Math.min(1, this.phaseTimer / LUNGE_TIME) : this.phase === 'tell' ? 0.2 : 0,
    }), '#d62839', true);
  }
}
