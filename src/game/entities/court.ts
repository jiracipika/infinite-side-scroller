/**
 * The crimson court as BADDIES — shared plumbing for the eight gothic
 * enemies (velvet, ember, rosalia, marionette, dorian, onyx, mortimer,
 * grimshaw). Each baddie reuses its playable character's bespoke ink art
 * through drawCharacterArt, wrapped in a crimson menace aura. Physics stays
 * engine-owned: classes integrate velocity, the engine resolves ground.
 */
import { Enemy } from './Enemy';
import { drawCharacterArt, type CharacterArtPose } from '../rendering/character-art';
import { getCharacterById } from '../data/characters';
import { advanceCharacterMotion, createCharacterMotion, type CharacterMotionState } from '../rendering/character-motion';

const courtMotion = new WeakMap<Enemy, CharacterMotionState>();

export const COURT_GRAVITY = 1800;

interface CourtPoseOpts {
  moving: boolean;
  /** True while lunging/dashing — the art leans into a sprint. */
  lunge?: boolean;
  /** Melee swing progress 0..1 across the current attack cycle. */
  swing?: number;
  /** Mid-air tumble flourish (marionette's hop). */
  tumble?: boolean;
}

/** Map enemy locomotion state onto the character-art pose vocabulary. */
export function courtPose(e: Enemy, opts: CourtPoseOpts): CharacterArtPose {
  const previous = courtMotion.get(e) ?? createCharacterMotion(e.x, e.animTimer);
  const motion = advanceCharacterMotion(previous, {
    characterId: e.type, x: e.x, width: e.width, onGround: e.onGround,
    dashing: Boolean(opts.lunge), vy: e.vy, melee: opts.swing ?? 0, ranged: 0,
    tumble: opts.tumble && !e.onGround ? .5 : 0,
  }, e.animTimer);
  courtMotion.set(e, motion.state);
  return { ...motion.pose, moving: opts.moving && motion.pose.moving };
}

/**
 * Shared baddie render: ink shadow, pulsing crimson aura in the character's
 * special color, player-facing flip, then the real character art.
 */
export function renderCourtBaddie(
  ctx: CanvasRenderingContext2D,
  e: Enemy,
  cameraX: number,
  cameraY: number,
  pose: CharacterArtPose,
  accent: string,
  grounded: boolean,
): void {
  if (!e.alive) return;
  const sx = e.x - cameraX;
  const sy = e.y - cameraY;
  const pulse = 0.5 + Math.sin(e.animTimer * 6) * 0.5;

  ctx.save();
  if (grounded) {
    ctx.globalAlpha = 0.3 + pulse * 0.08;
    ctx.fillStyle = '#09080f';
    ctx.beginPath();
    ctx.ellipse(sx + e.width / 2, sy + e.height + 3, e.width * 0.42, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Menace aura: the court announces itself.
  ctx.strokeStyle = accent;
  ctx.globalAlpha = 0.22 + pulse * 0.18;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sx + e.width / 2, sy + e.height / 2, Math.max(e.width, e.height) * 0.72 + pulse * 3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // The character art draws facing right; baddies face the player.
  ctx.translate(sx + e.width / 2, sy);
  ctx.scale(e.facingRight ? 1 : -1, 1);
  ctx.translate(-e.width / 2, 0);
  drawCharacterArt(ctx, getCharacterById(e.type), e.width, e.height, pose);
  ctx.restore();
}
