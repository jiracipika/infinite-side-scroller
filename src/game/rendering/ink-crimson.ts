import type { CharacterArtPose } from './character-art';
import { inkPoseTerms, makeInkHelpers, type InkMaterials, type Point } from './ink-kit';

/**
 * The crimson court — Cherry's red-and-black gothic family (velvet, ember,
 * rosalia, marionette, dorian, onyx, mortimer, grimshaw). Same drawing-only
 * contract as ink-roster: filled bent limbs, broken contours, one accent
 * budget per character, every pose parameter must move the silhouette, and
 * the signature prop is drawn LAST sweeping through the melee arc like
 * Cherry's parasol.
 */

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number, pose: CharacterArtPose, mat: InkMaterials) => void;

/** Rotate (px,py) around (ox,oy) by ang radians. */
function rot(px: number, py: number, ox: number, oy: number, ang: number): Point {
  const dx = px - ox, dy = py - oy;
  const c = Math.cos(ang), s = Math.sin(ang);
  return [ox + dx * c - dy * s, oy + dx * s + dy * c];
}

/* ------------------------------------------------------------------ */
/* VELVET (22×33) — vampiric countess: high-collared cape, long black  */
/* hair, corseted skirt; a lace fan that snaps open through the swing. */
/* ------------------------------------------------------------------ */

export const drawInkVelvet: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 22;
  const sy = height / 33;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const pale = '#f3e3e6';
  const lace = '#e8d5dc';
  const fang = '#f4f2ed';

  // High bat-wing collar, above everything behind the head.
  poly(mat.deep, shift([[6.2 + lean, 6.5 + lift], [8.4, 0.8 + lift], [10.6, 5.2], [10.2, 8], [7, 8.6]]));
  poly(mat.deep, shift([[15.8 + lean, 6.5 + lift], [13.6, 0.8 + lift], [11.4, 5.2], [11.8, 8], [15, 8.6]]));

  // Cape drape behind the shoulders, streaming on dash.
  const capeReach = pose.dashing ? 9 : pose.airborne ? 5 : 1.5 + Math.abs(stride) * 1.2;
  poly(mat.deep, shift([
    [7.5 + lean, 8 + lift], [14.5 + lean, 8 + lift],
    [15 - capeReach * 0.4, 15 + stride * 0.3], [4.5 - capeReach, 19 + stride * 0.5],
    [7, 22], [12, 22.5], [14.5 - capeReach * 0.2, 16 + stride * 0.3],
  ]));

  // Long black hair: back lock streams with the run, front locks frame the face.
  const hairReach = pose.dashing ? 9 : pose.airborne ? 6 : 2 + Math.abs(stride) * 1.3;
  const hairWave = stride * 0.45;
  poly(mat.ink, shift([
    [7.5 + lean, 2.5 + lift], [14.5 + lean, 2.5 + lift], [16.5 + lean, 9 + lift],
    [8.5 - hairReach, 18 + hairWave], [6.2 - hairReach, 20.5 + hairWave], [8, 13 + lift], [6.5 + lean, 7 + lift],
  ]));

  // Legs: heeled boots under the skirt.
  const hip: Point = [11, 22];
  let rearKnee: Point = [8 - stride * 0.8, 26];
  let rearFoot: Point = [7 - stride * 1.4, 32 - Math.max(0, stride)];
  let frontKnee: Point = [14 + stride * 0.8, 26];
  let frontFoot: Point = [15 + stride * 1.4, 32 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [6, 24]; rearFoot = [2, 29]; frontKnee = [16, 23]; frontFoot = [14, 32]; }
  if (pose.dashing) { rearKnee = [4, 26]; rearFoot = [0, 30]; frontKnee = [15, 26]; frontFoot = [20, 31]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2.2, hip[1] - 1], [hip[0] + 2.2, hip[1]], [kx + 1.8, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.2, fy], [fx + 3.6, fy + 1], [fx - 0.6, fy + 1.4], [fx - 2, fy - 1.5], [kx - 1.8, ky + 2], [hip[0] - 3.2, hip[1] + 2]]);
    poly(mat.deep, [[hip[0] - 0.8, hip[1] + 1], [kx + 0.8, ky], [fx, fy - 2], [kx - 0.8, ky + 1]]);
    mark(rear ? mat.fold : lace, [[fx - 1.8, fy - 2.4], [fx + 3, fy - 2.4]], 0.5);
    mark(mat.ink, [[fx - 1.6, fy + 1], [fx - 2.6, fy + 1.4]], 0.6);
  };
  leg(rearKnee, rearFoot, true);
  leg(frontKnee, frontFoot, false);

  // Long skirt with a scalloped lace hem; flares in air.
  const sway = -stride * 0.5;
  const flare = pose.airborne ? 1.7 : 0;
  poly(mat.ink, shift([
    [5.5 - sway - flare, 21 + lift], [11, 22.4], [16.5 + sway + flare, 21 + lift],
    [16.8 + sway + flare, 26.8 + flare * 0.3], [11, 28.4], [5.2 - sway - flare, 26.8 + flare * 0.3],
  ]));
  mark(mat.fold, shift([[6.4 - sway - flare, 24.5], [11, 25.6], [15.6 + sway + flare, 24.5]]), 0.4);

  // Corseted bodice with lacing.
  poly(mat.accent, shift([[6.5 + lean, 14 + lift], [15.5 + lean, 14 + lift], [16, 20], [13.5, 21.8], [8.5, 21.8], [6, 20]]));
  mark(mat.ink, shift([[9.4, 16], [12.6, 19.4]], 0), 0.45);
  mark(mat.ink, shift([[12.6, 16], [9.4, 19.4]], 0), 0.45);
  mark(lace, shift([[7.2, 19.6], [14.8, 19.6]]), 0.4);

  // Arms in long gloves.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 22];
  let frontElbow: Point = [17 + stride * 0.6, 17];
  let frontHand: Point = [16 + stride, 21];
  if (pose.airborne) { rearElbow = [3, 15]; rearHand = [0, 13]; frontElbow = [19, 15]; frontHand = [18, 11]; }
  if (pose.dashing) { rearElbow = [1, 15]; rearHand = [-3, 14]; frontElbow = [13, 18]; frontHand = [9, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.4, hy - 1], [hx + 1.4, hy + 1.6],
      [hx - 1, hy + 1.9], [hx - 2.4, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(mat.deep, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? mat.fold : lace, [[ax + 0.8, ay], [ex + 1.6, ey], [hx + 0.8, hy]], 0.45);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Pale porcelain face with wine eyes, tiny fangs, widow's peak.
  poly(pale, shift([[7.9, 5], [14.1, 5], [14.8, 10.2], [11, 14.2], [7.2, 10.2]]));
  poly(mat.ink, shift([[10.2, 4.2], [11.8, 4.2], [11, 6.2]]));
  poly(mat.accent, shift([[8.7, 8.1], [10.2, 8.6], [8.9, 9.3]]));
  poly(mat.accent, shift([[13.3, 8.1], [11.8, 8.6], [13.1, 9.3]]));
  mark(mat.accent, shift([[10.2, 12], [11.8, 12]], 0), 0.4);
  mark(fang, shift([[10.4, 12.1], [10.4, 12.9]], 0), 0.55);
  mark(fang, shift([[11.6, 12.1], [11.6, 12.9]], 0), 0.55);
  // Front hair locks over the face edges.
  poly(mat.ink, shift([[6.1 + lean, 4.5 + lift], [8.8, 5.8], [8.2, 15.5], [6.5, 17], [5.5, 11]]));
  poly(mat.ink, shift([[15.9 + lean, 4.5 + lift], [13.2, 5.8], [13.8, 15.5], [15.5, 17], [16.5, 11]]));
  // Bat brooch at the throat.
  poly(mat.accent, shift([[10.6, 13.4], [9.7, 12.5], [10.5, 12.8], [10.6, 12.2], [11.4, 12.8], [12.3, 12.5], [11.4, 13.4]]));

  // Lace fan, drawn last: closed wedge at rest, snapping open through swing.
  frontElbow = [frontElbow[0] + (20 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (23 - frontHand[0]) * swing, frontHand[1] + (10 - frontHand[1]) * swing];
  arm([15 + lean, 15 + lift], frontElbow, frontHand, false);
  const hx = frontHand[0], hy = frontHand[1];
  const open = swing;
  const a0 = -0.75 + open * 0.3;
  const a1 = a0 + 0.3 + open * 1.5;
  const fanLen = 8.5;
  const tipA = [hx + Math.sin(a0) * fanLen, hy - Math.cos(a0) * fanLen] as Point;
  const tipB = [hx + Math.sin((a0 + a1) / 2) * fanLen, hy - Math.cos((a0 + a1) / 2) * fanLen] as Point;
  const tipC = [hx + Math.sin(a1) * fanLen, hy - Math.cos(a1) * fanLen] as Point;
  const tipD = [hx + Math.sin(a1 * 0.55 + a0 * 0.45) * fanLen, hy - Math.cos(a1 * 0.55 + a0 * 0.45) * fanLen] as Point;
  poly(lace, [[hx, hy], tipA, tipB, tipD, tipC]);
  mark(mat.accent, [[hx, hy], tipB], 0.4);
  mark(mat.accent, [[hx, hy], tipD], 0.4);
  mark(mat.ink, [tipA, tipB, tipD, tipC], 0.5);
};

/* ------------------------------------------------------------------ */
/* EMBER (22×32) — fire dancer: high ponytail, bare-midriff wrap,      */
/* twin flame fans that cross-sweep; sparks trail every dash.          */
/* ------------------------------------------------------------------ */

export const drawInkEmber: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 22;
  const sy = height / 32;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const flame = '#ff5a3c';
  const fire2 = '#ffb14a';
  const skin = '#f2c9a8';

  // Sash streaming behind the waist.
  const reach = pose.dashing ? 11 : pose.airborne ? 7 : 2.5 + Math.abs(stride) * 1.4;
  const wave = stride * 0.6;
  poly(mat.deep, shift([
    [9 + lean, 16.5 + lift], [13 + lean, 16.5 + lift],
    [7 - reach * 0.5, 18.5 + wave], [1.5 - reach, 21 + wave], [6.5, 21.5], [10.5, 19.5],
  ]));
  // Spark trail on dash.
  if (pose.dashing) {
    poly(fire2, shift([[1 - reach, 17.5], [2.2, 18.6], [1 - reach, 19.6], [-0.4, 18.6]]));
    poly(flame, shift([[4.5, 14.5], [5.6, 15.6], [4.5, 16.6], [3.4, 15.6]]));
  }

  // High ponytail sweeping up-back in deep ember red (reads on dark
  // backgrounds, unlike ink), flame seated at the tip.
  const tailReach = pose.dashing ? 6 : 1 + Math.abs(stride) * 0.9;
  poly(mat.deep, shift([
    [11.5 + lean, 3.5 + lift], [14 + lean, 0.8 + lift], [18 + lean - tailReach * 0.4, 1.6 + lift],
    [20.5 + lean - tailReach, 3.6 + stride * 0.4], [17, 6 + stride * 0.3], [13.5, 6.5 + lift], [11 + lean, 5.5 + lift],
  ]));
  mark(flame, shift([[13.5 + lean, 1.6 + lift], [18 + lean - tailReach * 0.5, 2 + stride * 0.3]], 0), 0.5);
  poly(fire2, shift([[17.7 + lean - tailReach, 2.2 + stride * 0.4], [19.6 + lean - tailReach, 3.2 + stride * 0.4], [17.9 + lean - tailReach, 4.5 + stride * 0.4], [16.4 + lean - tailReach, 3.2 + stride * 0.4]]));

  // Dancer legs with sandal straps.
  const hip: Point = [11, 19.5];
  let rearKnee: Point = [8 - stride * 0.8, 24];
  let rearFoot: Point = [7 - stride * 1.5, 31 - Math.max(0, stride)];
  let frontKnee: Point = [14 + stride * 0.8, 24];
  let frontFoot: Point = [15 + stride * 1.5, 31 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [5, 21]; rearFoot = [1, 26]; frontKnee = [17, 20]; frontFoot = [14, 31]; }
  if (pose.dashing) { rearKnee = [3, 24]; rearFoot = [-1, 28]; frontKnee = [15, 24]; frontFoot = [20, 30]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2, hip[1] - 1], [hip[0] + 2, hip[1]], [kx + 1.6, ky - 1], [fx + 1.4, fy - 2],
      [fx + 3, fy], [fx + 3.2, fy + 1], [fx - 1.2, fy + 1], [fx - 1.4, fy - 1.8], [kx - 1.6, ky + 2], [hip[0] - 2.8, hip[1] + 2]]);
    poly(skin, [[hip[0] - 0.8, hip[1] + 0.8], [kx + 0.8, ky], [fx, fy - 2], [kx - 0.8, ky + 1]]);
    mark(mat.ink, [[fx - 1.4, fy - 1.8], [fx + 2.8, fy - 1.8]], 0.55);
    mark(mat.ink, [[fx - 0.6, fy - 2], [fx + 1.6, fy + 0.6]], 0.4);
    mark(rear ? mat.fold : flame, [[kx - 0.6, ky + 1.4], [kx + 1.4, ky + 1.8]], 0.4);
  };
  leg(rearKnee, rearFoot, true);

  // Short asymmetric wrap skirt.
  const sway = -stride * 0.6;
  const flare = pose.airborne ? 1.5 : 0;
  poly(mat.deep, shift([
    [6 + lean, 16 + lift], [16 + lean, 16 + lift],
    [17.5 + sway + flare, 21.5 + flare * 0.4], [11, 22.6 + flare * 0.3], [4.8 - sway - flare, 20.6 + flare * 0.4],
  ]));
  mark(flame, shift([[6.4 - sway - flare, 19.8], [11, 21], [15.8 + sway + flare, 19.6]]), 0.45);

  // Bandeau + bare midriff.
  poly(mat.accent, shift([[7.5 + lean, 13 + lift], [14.5 + lean, 13 + lift], [14.5, 15.4], [7.5, 15.4]]));
  poly(skin, shift([[8, 15.4], [14, 15.4], [14.4, 17.2], [7.6, 17.2]]));
  mark(fire2, shift([[8.2, 16.3], [13.8, 16.3]]), 0.3);

  // Bare arms with wrist wraps.
  const rearShoulder: Point = [8 + lean, 14.5 + lift];
  let rearElbow: Point = [4 - stride, 17];
  let rearHand: Point = [4 - stride * 1.3, 21];
  let frontElbow: Point = [17 + stride * 0.6, 16];
  let frontHand: Point = [16 + stride, 20];
  if (pose.airborne) { rearElbow = [3, 14]; rearHand = [0, 12]; frontElbow = [19, 14]; frontHand = [18, 10]; }
  if (pose.dashing) { rearElbow = [1, 14]; rearHand = [-3, 13]; frontElbow = [13, 17]; frontHand = [9, 19]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.7, ay - 1], [ax + 1.7, ay], [ex + 1.7, ey - 1], [hx + 1.3, hy - 1], [hx + 1.3, hy + 1.5],
      [hx - 1, hy + 1.8], [hx - 2.3, hy], [ex - 1.7, ey + 1.5], [ax - 2.4, ay + 1.5]]);
    poly(skin, [[ax - 0.7, ay + 0.8], [ex + 0.7, ey], [hx, hy], [ex - 0.7, ey + 0.8]]);
    mark(rear ? mat.fold : flame, [[ax + 0.7, ay], [ex + 1.5, ey], [hx + 0.7, hy]], 0.4);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Face: fierce amber eyes, sharp grin.
  poly(skin, shift([[7.9, 5], [14.1, 5], [14.8, 10], [11, 13.8], [7.2, 10]]));
  poly(mat.accent, shift([[8.8, 7.8], [10.3, 8.3], [9, 9.1]]));
  poly(mat.accent, shift([[13.2, 7.8], [11.7, 8.3], [13, 9.1]]));
  mark(mat.ink, shift([[9.8, 11.4], [12.2, 11.2]], 0), 0.5);
  // Ponytail sweep over the forehead.
  mark(mat.ink, shift([[8.2, 4.6], [11, 3.6], [13.8, 4.4]], 0), 1);
  poly(mat.deep, shift([[6.3 + lean, 4.8 + lift], [8.4, 5.8], [8, 11], [6.8, 9.5]]));
  poly(mat.deep, shift([[15.7 + lean, 4.8 + lift], [13.6, 5.8], [14, 11], [15.2, 9.5]]));

  // Twin flame fans, drawn last — cross-sweep through the swing.
  rearElbow = [rearElbow[0] + (12 - rearElbow[0]) * swing, rearElbow[1] + (16 - rearElbow[1]) * swing];
  rearHand = [rearHand[0] + (14 - rearHand[0]) * swing, rearHand[1] + (15 - rearHand[1]) * swing];
  frontElbow = [frontElbow[0] + (19 - frontElbow[0]) * swing, frontElbow[1] + (13 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (19 - frontHand[0]) * swing, frontHand[1] + (12 - frontHand[1]) * swing];
  arm([14.5 + lean, 14.5 + lift], frontElbow, frontHand, false);
  arm([7.5 + lean, 14.5 + lift], rearElbow, rearHand, true);
  const fanBlade = (hand: Point, angle: number, scale: number) => {
    const [bx, by] = hand;
    const local: Point[] = [[0, 0], rot(-1.7, -5.4, 0, 0, angle), rot(-0.6, -8.6, 0, 0, angle), rot(0.7, -9.4, 0, 0, angle), rot(1.8, -5.6, 0, 0, angle)];
    poly(flame, local.map(([px, py]) => [bx + px * scale, by + py * scale] as Point));
    poly(fire2, [hand, ...local.slice(2, 4).map(([px, py]) => [bx + px * scale * 0.55, by + py * scale * 0.55] as Point)]);
    mark(mat.ink, [hand, [bx + local[3][0] * scale, by + local[3][1] * scale]], 0.4);
  };
  fanBlade(frontHand, swing * 1.25, 1.15);
  fanBlade(rearHand, -0.45 - swing * 0.9, 0.95);
  if (swing > 0.3) {
    mark(fire2, [[frontHand[0] + 2, frontHand[1] - 6], [frontHand[0] + 4.5 + swing * 2, frontHand[1] - 8]], 0.7);
  }
};

/* ------------------------------------------------------------------ */
/* ROSALIA (23×33) — rose princess: rose crown, wavy hair, bustle      */
/* skirt; a thorn whip that lashes forward through the swing.          */
/* ------------------------------------------------------------------ */

export const drawInkRosalia: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 23;
  const sy = height / 33;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const rose = '#e63950';
  const rose2 = '#ff7d92';
  const stem = '#4a7a4e';
  const pale = '#f3e3e6';

  // Bustle puff at the back — the princess silhouette.
  const bustleLift = pose.airborne ? -2 : 0;
  const bustleSway = -stride * 0.5;
  poly(mat.deep, shift([
    [8 + lean + bustleSway, 19.5 + lift], [12, 20.5 + lift],
    [4.5 - (pose.dashing ? 4 : 1) + bustleSway, 21 + lift + bustleLift],
    [3.5 - (pose.dashing ? 5 : 1.5) + bustleSway, 24 + lift + bustleLift],
    [7.5, 25],
  ]));

  // Long wavy hair behind, streaming on dash.
  const hairReach = pose.dashing ? 9 : pose.airborne ? 6 : 2 + Math.abs(stride) * 1.2;
  const hairWave = stride * 0.5;
  poly(mat.ink, shift([
    [7 + lean, 2 + lift], [16.5 + lean, 2 + lift], [18.5 + lean, 11 + lift],
    [9 - hairReach, 20 + hairWave], [6 - hairReach, 22.5 + hairWave],
    [7.5 - hairReach * 0.4, 17.5 + hairWave * 0.5], [10.5, 21.5], [8, 13 + lift], [6.5 + lean, 6.5 + lift],
  ]));

  // Legs + heeled boots under the skirt.
  const hip: Point = [11.5, 22];
  let rearKnee: Point = [8.5 - stride * 0.8, 26];
  let rearFoot: Point = [7.5 - stride * 1.4, 32 - Math.max(0, stride)];
  let frontKnee: Point = [14.5 + stride * 0.8, 26];
  let frontFoot: Point = [15.5 + stride * 1.4, 32 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [6, 24]; rearFoot = [2, 29]; frontKnee = [17, 23]; frontFoot = [15, 32]; }
  if (pose.dashing) { rearKnee = [4, 26]; rearFoot = [0, 30]; frontKnee = [16, 26]; frontFoot = [21, 31]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2.2, hip[1] - 1], [hip[0] + 2.2, hip[1]], [kx + 1.8, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.2, fy], [fx + 3.6, fy + 1], [fx - 0.6, fy + 1.4], [fx - 2, fy - 1.5], [kx - 1.8, ky + 2], [hip[0] - 3.2, hip[1] + 2]]);
    poly(mat.deep, [[hip[0] - 0.8, hip[1] + 1], [kx + 0.8, ky], [fx, fy - 2], [kx - 0.8, ky + 1]]);
    mark(rear ? mat.fold : pale, [[fx - 1.8, fy - 2.4], [fx + 3, fy - 2.4]], 0.5);
  };
  leg(rearKnee, rearFoot, true);

  // Layered skirt: deep under-layer, rose overskirt with scalloped hem.
  const sway = -stride * 0.55;
  const flare = pose.airborne ? 1.8 : 0;
  poly(mat.deep, shift([
    [5.5 - sway - flare, 21 + lift], [11.5, 22.2], [17.5 + sway + flare, 21 + lift],
    [17.8 + sway + flare, 26 + flare * 0.3], [11.5, 27.4], [5.2 - sway - flare, 26 + flare * 0.3],
  ]));
  poly(mat.accent, shift([
    [6.6 - sway - flare, 21 + lift], [11.5, 22], [16.4 + sway + flare, 21 + lift],
    [16.6 + sway + flare, 25 + flare * 0.3], [14.2, 26.1], [13, 24.8], [11.5, 26.2], [10, 24.8], [8.8, 26.1], [6.4 - sway - flare, 25 + flare * 0.3],
  ]));

  // Rose bodice.
  poly(mat.accent, shift([[7 + lean, 14 + lift], [16 + lean, 14 + lift], [16.5, 20], [14, 21.8], [9, 21.8], [6.5, 20]]));
  poly(rose2, shift([[8.2 + lean, 15 + lift], [14.8 + lean, 15 + lift], [14.8, 17], [8.2, 17]]));
  mark(stem, shift([[11.5, 15.4], [11.5, 17]], 0), 0.5);
  mark(mat.ink, shift([[8.6, 19.6], [14.4, 19.6]], 0), 0.4);

  // Gloved arms.
  const rearShoulder: Point = [8.5 + lean, 15 + lift];
  let rearElbow: Point = [4.5 - stride, 18];
  let rearHand: Point = [4.5 - stride * 1.3, 22];
  let frontElbow: Point = [17.5 + stride * 0.6, 17];
  let frontHand: Point = [16.5 + stride, 21];
  if (pose.airborne) { rearElbow = [3, 15]; rearHand = [0, 13]; frontElbow = [20, 15]; frontHand = [19, 11]; }
  if (pose.dashing) { rearElbow = [1, 15]; rearHand = [-3, 14]; frontElbow = [14, 18]; frontHand = [10, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.4, hy - 1], [hx + 1.4, hy + 1.6],
      [hx - 1, hy + 1.9], [hx - 2.4, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(mat.deep, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? mat.fold : rose2, [[ax + 0.8, ay], [ex + 1.6, ey], [hx + 0.8, hy]], 0.45);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Face + rose crown of three spirals.
  poly(pale, shift([[8.2, 5], [14.8, 5], [15.4, 10.4], [11.5, 14.2], [7.6, 10.4]]));
  poly(mat.accent, shift([[9.1, 8.2], [10.5, 8.7], [9.2, 9.4]]));
  poly(mat.accent, shift([[13.7, 8.2], [12.3, 8.7], [13.6, 9.4]]));
  mark(mat.ink, shift([[10.4, 12], [12.6, 12]], 0), 0.4);
  poly(mat.ink, shift([[7.4 + lean, 4.6 + lift], [16.6 + lean, 4.6 + lift], [15.5, 6.4], [8.5, 6.4]]));
  poly(mat.ink, shift([[7, lean + 5], [8.6, 6], [8.2, 14], [6.6, 13]]));
  poly(mat.ink, shift([[17, lean + 5], [15.4, 6], [15.8, 14], [17.4, 13]]));
  const roseAt = (x: number, y: number, r: number) => {
    mark(rose, [[x - r, y], [x - r * 0.3, y - r], [x + r * 0.8, y - r * 0.6], [x + r * 0.7, y + r * 0.5], [x - r * 0.5, y + r * 0.8], [x - r, y]], 0.6);
    poly(rose2, [[x - r * 0.25, y], [x + r * 0.3, y - r * 0.35], [x + r * 0.25, y + r * 0.3]]);
  };
  roseAt(16.2, 3.4, 1.5);
  roseAt(18.2, 4.8, 1.2);
  roseAt(16.8, 6.2, 1.1);

  // Thorn whip, drawn last: coiled at the hip at rest, lashes forward.
  frontElbow = [frontElbow[0] + (19 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (18 - frontHand[0]) * swing, frontHand[1] + (12 - frontHand[1]) * swing];
  arm([15.5 + lean, 15 + lift], frontElbow, frontHand, false);
  const whipTip: Point = [frontHand[0] + 3 + swing * 8, frontHand[1] - 4 - swing * 4];
  if (swing > 0.05) {
    mark(mat.deep, [frontHand, [frontHand[0] + (whipTip[0] - frontHand[0]) * 0.4, frontHand[1] + (whipTip[1] - frontHand[1]) * 0.4 + 1.5], whipTip], 0.8);
    mark(mat.deep, [frontHand, [frontHand[0] + (whipTip[0] - frontHand[0]) * 0.35, frontHand[1] + (whipTip[1] - frontHand[1]) * 0.35 - 1.2]], 0.45);
    poly(rose, [whipTip, [whipTip[0] - 1.6, whipTip[1] + 1.4], [whipTip[0] - 0.6, whipTip[1] + 2.2]]);
    mark(stem, [[frontHand[0] + (whipTip[0] - frontHand[0]) * 0.55, frontHand[1] + (whipTip[1] - frontHand[1]) * 0.55 - 1.6], [frontHand[0] + (whipTip[0] - frontHand[0]) * 0.55 + 0.8, frontHand[1] + (whipTip[1] - frontHand[1]) * 0.55 - 2.4]], 0.5);
  } else {
    mark(mat.deep, shift([[6.5, 22], [8.8, 21], [10, 22.6], [7.6, 23.6], [6.8, 22.6]], 0), 0.6);
    mark(mat.deep, shift([[7.2, 22.6], [9.4, 23.8], [8, 24.6]], 0), 0.5);
  }
};

/* ------------------------------------------------------------------ */
/* MARIONETTE (21×32) — ball-jointed doll: bob hair with a bow, heart  */
/* patch, striped stockings; ribbon streamers lash on the swing.       */
/* ------------------------------------------------------------------ */

export const drawInkMarionette: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 21;
  const sy = height / 32;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const ribbonC = '#ff3d6e';
  const joint = '#e8d5dc';
  const pale = '#f6e8ea';

  // Legs with striped stockings and round joints.
  const hip: Point = [10.5, 20];
  let rearKnee: Point = [7.5 - stride * 0.8, 24.5];
  let rearFoot: Point = [6.5 - stride * 1.4, 31 - Math.max(0, stride)];
  let frontKnee: Point = [13.5 + stride * 0.8, 24.5];
  let frontFoot: Point = [14.5 + stride * 1.4, 31 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [5, 22]; rearFoot = [1, 26]; frontKnee = [16, 21]; frontFoot = [13, 31]; }
  if (pose.dashing) { rearKnee = [3, 24.5]; rearFoot = [-1, 29]; frontKnee = [14, 24.5]; frontFoot = [19, 30]; }
  const leg = (knee: Point, foot: Point) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2, hip[1] - 1], [hip[0] + 2, hip[1]], [kx + 1.6, ky - 1], [fx + 1.4, fy - 2],
      [fx + 3, fy], [fx + 3.2, fy + 1], [fx - 1.2, fy + 1], [fx - 1.4, fy - 1.8], [kx - 1.6, ky + 2], [hip[0] - 2.8, hip[1] + 2]]);
    poly(pale, [[hip[0] - 0.7, hip[1] + 0.8], [kx + 0.7, ky], [fx, fy - 2], [kx - 0.7, ky + 1]]);
    mark(mat.ink, [[kx - 0.8, ky + 0.6], [kx + 1.2, ky + 0.2]], 0.4);
    mark(mat.ink, [[fx - 1, fy - 1.4], [fx + 1.8, fy - 1.8]], 0.4);
    mark(mat.ink, [[fx - 1.6, fy - 1.8], [fx + 2.6, fy - 1.8]], 0.5);
    poly(joint, [[kx - 1, ky + 0.9], [kx, ky - 0.1], [kx + 1.2, ky + 0.9], [kx, ky + 1.9]]);
  };
  leg(rearKnee, rearFoot);
  leg(frontKnee, frontFoot);

  // Pinafore dress with the stitched heart patch.
  const sway = -stride * 0.5;
  const flare = pose.airborne ? 1.6 : 0;
  poly(mat.deep, shift([
    [5.5 - sway - flare, 19 + lift], [10.5, 20.2], [15.5 + sway + flare, 19 + lift],
    [15.8 + sway + flare, 24.6 + flare * 0.3], [10.5, 26], [5.2 - sway - flare, 24.6 + flare * 0.3],
  ]));
  poly(mat.ink, shift([
    [4.8 - sway - flare, 20.5 + lift], [10.5, 21.8], [16.2 + sway + flare, 20.5 + lift],
    [16.5 + sway + flare, 26.2 + flare * 0.3], [10.5, 27.8], [4.5 - sway - flare, 26.2 + flare * 0.3],
  ]));
  mark(joint, shift([[5.6 - sway - flare, 25.6], [10.5, 26.8], [15.4 + sway + flare, 25.6]]), 0.4);

  // Torso under pinafore.
  poly(mat.ink, shift([[6.5 + lean, 14 + lift], [14.5 + lean, 14 + lift], [15, 20.4], [10.5, 21.6], [6, 20.4]]));
  poly(pale, shift([[7.5 + lean, 15 + lift], [13.5 + lean, 15 + lift], [13.8, 19.4], [7.2, 19.4]]));
  // Stitched heart.
  poly(ribbonC, shift([[9, 15.6], [9.9, 14.9], [10.5, 15.5], [11.1, 14.9], [12, 15.6], [10.5, 18.4]]));
  mark(mat.ink, shift([[9.2, 16.4], [11.8, 16.8]], 0), 0.35);
  mark(mat.ink, shift([[9.4, 17.3], [11.6, 17.6]], 0), 0.35);

  // Ball-jointed arms.
  const rearShoulder: Point = [7.5 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 21.5];
  let frontElbow: Point = [16 + stride * 0.6, 17];
  let frontHand: Point = [15 + stride, 20.5];
  if (pose.airborne) { rearElbow = [3, 14]; rearHand = [0, 12]; frontElbow = [18, 14]; frontHand = [17, 10]; }
  if (pose.dashing) { rearElbow = [1, 14]; rearHand = [-3, 13]; frontElbow = [12, 17]; frontHand = [8, 19]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] - 1.5 * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.6, ay - 1], [ax + 1.6, ay], [ex + 1.6, ey - 1], [hx + 1.3, hy - 1], [hx + 1.3, hy + 1.5],
      [hx - 1, hy + 1.8], [hx - 2.2, hy], [ex - 1.6, ey + 1.5], [ax - 2.3, ay + 1.5]]);
    poly(pale, [[ax - 0.7, ay + 0.8], [ex + 0.7, ey], [hx, hy], [ex - 0.7, ey + 0.8]]);
    mark(mat.ink, [[ax + 0.7, ay], [ex + 1.4, ey], [hx + 0.7, hy]], 0.4);
    poly(joint, [[ex - 1, ey + 0.9], [ex, ey - 0.1], [ex + 1.2, ey + 0.9], [ex, ey + 1.9]]);
    poly(joint, [[hx - 1.1, hy + 0.4], [hx, hy - 0.6], [hx + 1.3, hy + 0.4], [hx, hy + 1.4]]);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand);

  // Bob hair with bangs and a big ribbon.
  poly(pale, shift([[7.7, 5.4], [13.3, 5.4], [13.9, 10.4], [10.5, 13.4], [7.1, 10.4]]));
  // Big doll eyes with glints.
  poly(ribbonC, shift([[8.4, 7.6], [9.8, 7.1], [10.2, 8.5], [9.5, 9.7], [8.5, 9.2]]));
  poly(ribbonC, shift([[12.6, 7.6], [11.2, 7.1], [10.8, 8.5], [11.5, 9.7], [12.5, 9.2]]));
  poly(pale, shift([[9, 8], [9.5, 7.8], [9.6, 8.4], [9.1, 8.6]]));
  poly(pale, shift([[11.6, 8], [11.1, 7.8], [11, 8.4], [11.5, 8.6]]));
  mark(mat.ink, shift([[9.9, 11.6], [11.1, 11.6]], 0), 0.4);
  // Helmet bob with straight fringe.
  poly(mat.ink, shift([
    [6.2 + lean, 6 + lift], [5.8 + lean, 2.6 + lift], [10.5, 1.2 + lift], [15.2 + lean, 2.6 + lift],
    [14.8 + lean, 6 + lift], [14, 4], [12.6, 5], [11.4, 3.8], [10, 5], [8.4, 3.9], [7, 4.6],
  ]));
  poly(mat.ink, shift([[6 + lean, 6 + lift], [7.4, 6.4], [7, 12.5], [5.6, 11]]));
  poly(mat.ink, shift([[15 + lean, 6 + lift], [13.6, 6.4], [14, 12.5], [15.4, 11]]));
  // Ribbon bow, top-left.
  poly(ribbonC, shift([[6.4, 1.4], [8.6, 0.2], [8.8, 2.6]]));
  poly(ribbonC, shift([[6.4, 1.4], [4.4, 0.4], [4.6, 3]]));
  poly(ribbonC, shift([[6, 0.9], [6.9, 0.5], [7, 1.9], [6.1, 2.2]]));

  // Ribbon streamers, drawn last — lash forward through the swing.
  arm([13.5 + lean, 15 + lift], frontElbow, frontHand);
  const lash = (hand: Point, forward: number) => {
    const tip: Point = [hand[0] + 2 + forward * 8, hand[1] + 3.5 - forward * 10];
    const mid: Point = [hand[0] + (tip[0] - hand[0]) * 0.5 - (1 - forward) * 1.5 + Math.sin(stride * 2.2) * 1.2 * (1 - forward), hand[1] + (tip[1] - hand[1]) * 0.5 - 1];
    mark(ribbonC, [hand, mid, tip], 0.7);
    mark(ribbonC, [[hand[0], hand[1] + 0.8], [mid[0] - 0.6, mid[1] + 1.6], [tip[0] - 1, tip[1] + 1.4]], 0.35);
    poly(ribbonC, [tip, [tip[0] - 1.5, tip[1] + 1], [tip[0] - 0.4, tip[1] + 2], [tip[0] + 0.8, tip[1] + 0.9]]);
  };
  lash(rearHand, swing * 0.55);
  lash(frontHand, swing);
};

/* ------------------------------------------------------------------ */
/* DORIAN (24×34) — crimson duelist: plumed tricorn, long coattails,   */
/* cravat; a thin rapier that lunges through the swing.                */
/* ------------------------------------------------------------------ */

export const drawInkDorian: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 24;
  const sy = height / 34;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const steel = '#e6e8ef';
  const glovewhite = '#f4f2ed';
  const pale = '#f1d9c8';

  // Coattails behind, streaming on dash and air.
  const tailReach = pose.dashing ? 10 : pose.airborne ? 7 : 2 + Math.abs(stride) * 1.3;
  const tailWave = stride * 0.5;
  poly(mat.ink, shift([
    [13 + lean, 19 + lift], [17 + lean, 19 + lift],
    [13 - tailReach * 0.4, 24 + tailWave], [8 - tailReach, 28 + tailWave], [11, 28.5], [14.5, 24],
  ]));
  poly(mat.deep, shift([
    [14 + lean, 20 + lift], [16 + lean, 20 + lift],
    [12.5 - tailReach * 0.4, 24.5 + tailWave], [9.5 - tailReach * 0.8, 27.4 + tailWave],
  ]));

  // Legs: breeches + tall boots; the melee lunge stretches the stance.
  const hip: Point = [12, 21];
  let rearKnee: Point = [8 - stride * 0.8, 25.5];
  let rearFoot: Point = [7 - stride * 1.5, 33 - Math.max(0, stride)];
  let frontKnee: Point = [16 + stride * 0.8, 25.5];
  let frontFoot: Point = [17 + stride * 1.5, 33 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [5, 23]; rearFoot = [1, 28]; frontKnee = [18, 22]; frontFoot = [15, 33]; }
  if (pose.dashing) { rearKnee = [3, 25.5]; rearFoot = [-1, 30]; frontKnee = [17, 25.5]; frontFoot = [22, 32]; }
  rearFoot = [rearFoot[0] - swing * 3.5, rearFoot[1] + swing * 0.5];
  frontFoot = [frontFoot[0] + swing * 2.5, frontFoot[1] - swing * 0.8];
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2.4, hip[1] - 1], [hip[0] + 2.4, hip[1]], [kx + 2, ky - 1], [fx + 1.6, fy - 3],
      [fx + 3.4, fy], [fx + 3.8, fy + 1], [fx - 1, fy + 1.2], [fx - 1.8, fy - 2.6], [kx - 2, ky + 2], [hip[0] - 3.4, hip[1] + 2]]);
    poly(mat.deep, [[hip[0] - 0.9, hip[1] + 1], [kx + 0.9, ky], [fx, fy - 2.5], [kx - 0.9, ky + 1]]);
    mark(rear ? mat.fold : glovewhite, [[fx - 1.4, fy - 3.4], [fx + 3, fy - 3.4]], 0.5);
  };
  leg(rearKnee, rearFoot, true);

  // Long coat body with crimson lapels.
  poly(mat.ink, shift([[5.5 + lean, 14 + lift], [18.5 + lean, 14 + lift], [19.5, 22], [16, 23.5], [8, 23.5], [4.5, 22]]));
  poly(mat.deep, shift([[7.5 + lean, 15 + lift], [16.5 + lean, 15 + lift], [17, 21], [7, 21]]));
  mark(mat.accent, shift([[10, 15.5], [9, 21.5]], 0), 0.7);
  mark(mat.accent, shift([[14, 15.5], [15, 21.5]], 0), 0.7);
  mark(mat.accent, shift([[7, 17.5], [7, 21]], 0), 0.5);

  // Arms: pale gloves, crimson cuffs.
  const rearShoulder: Point = [8.5 + lean, 15 + lift];
  let rearElbow: Point = [4.5 - stride, 18];
  let rearHand: Point = [4.5 - stride * 1.3, 22];
  let frontElbow: Point = [18 + stride * 0.6, 17];
  let frontHand: Point = [17 + stride, 21];
  if (pose.airborne) { rearElbow = [3, 15]; rearHand = [0, 13]; frontElbow = [20, 15]; frontHand = [19, 11]; }
  if (pose.dashing) { rearElbow = [1, 15]; rearHand = [-3, 14]; frontElbow = [14, 18]; frontHand = [10, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.9, ay - 1], [ax + 1.9, ay], [ex + 1.9, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.7],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.9, ey + 1.6], [ax - 2.6, ay + 1.6]]);
    poly(mat.deep, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(mat.accent, [[ex - 1.4, ey + 1.2], [ex + 1.6, ey + 0.4]], 0.6);
    poly(glovewhite, [[hx - 1, hy - 0.4], [hx + 1.4, hy - 0.6], [hx + 1.4, hy + 1.4], [hx - 1, hy + 1.6]]);
    mark(rear ? mat.fold : glovewhite, [[ax + 0.8, ay], [ex + 1.6, ey], [hx + 0.8, hy]], 0.4);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Pale face under the tricorn, sharp crimson eyes.
  poly(pale, shift([[8.4, 6], [15.6, 6], [16.2, 11.2], [12, 15], [7.8, 11.2]]));
  poly(mat.accent, shift([[9.4, 8.8], [11, 9.3], [9.6, 10.1]]));
  poly(mat.accent, shift([[14.4, 8.8], [12.8, 9.3], [14.2, 10.1]]));
  mark(mat.ink, shift([[10.6, 13], [13.6, 12.8]], 0), 0.4);
  // Tricorn: wide swept brim with upturned edges, crown, crimson plume.
  const brimSway = -stride * 0.3 - (pose.dashing ? 1.5 : 0);
  const plumeReach = pose.dashing ? 5 : pose.airborne ? 3 : 1 + Math.abs(stride) * 0.8;
  const plumeWave = stride * 0.4;
  poly(mat.ink, shift([
    [4.5 + lean + brimSway, 6.2 + lift], [8, 3.4 + lift], [16, 3.4 + lift], [19.5 + lean - brimSway, 6.2 + lift],
    [16.5 + lean - brimSway, 7.4], [12, 6.2], [7.5 + lean + brimSway, 7.4],
  ]));
  // Slim plume sweeping back from the crown, drawn under it.
  poly(mat.accent, shift([
    [10.5 + lean, 1.6 + lift], [9 + lean, 0.4 + lift], [6 - plumeReach * 0.6, 1.4 + plumeWave],
    [7.5 - plumeReach * 0.6, 3 + plumeWave], [10, 3.4 + lift],
  ]));
  mark(mat.deep, shift([[9.5 + lean, 1.2 + lift], [7 - plumeReach * 0.6, 2 + plumeWave]], 0), 0.3);
  poly(mat.ink, shift([[8 + lean, 3.8 + lift], [16 + lean, 3.8 + lift], [15, 1.6 + lift], [9, 1.6 + lift]]));
  mark(mat.accent, shift([[8.8 + lean, 1.9 + lift], [15.2 + lean, 1.9 + lift]], 0), 0.5);
  // Cravat.
  poly(glovewhite, shift([[10.6, 14.6], [13.4, 14.6], [12.8, 17.4], [11.2, 17.4]]));

  // Rapier, drawn last: swept hilt + thin blade; the lunge extends it.
  frontElbow = [frontElbow[0] + (20 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (20 - frontHand[0]) * swing, frontHand[1] + (13 - frontHand[1]) * swing];
  arm([16.5 + lean, 15 + lift], frontElbow, frontHand, false);
  const hx = frontHand[0], hy = frontHand[1];
  let tip: Point = [hx + 7, hy - 6.5];
  if (pose.airborne) tip = [hx + 7.5, hy - 8];
  if (pose.dashing) tip = [hx - 4, hy - 2];
  tip = [tip[0] + swing * 3.5, tip[1] + swing * 0.5];
  // Swept guard: two curved strokes looping ahead of the hand.
  mark(steel, [[hx - 1.5, hy + 1], [hx + 1, hy + 2.6], [hx + 3, hy + 0.5], [hx + 2, hy - 1.8], [hx - 0.2, hy - 2.2]], 0.55);
  mark(mat.ink, [[hx - 2.4, hy + 2.2], [hx - 1, hy + 3.2]], 0.9);
  mark(mat.ink, [[hx - 2.2, hy + 0.5], [hx - 1, hy + 2.4], [hx - 2.6, hy + 2.8]], 0.7);
  // Blade: bright core with an ink edge so it reads on light ground too.
  mark(mat.ink, [[hx + 1, hy - 1], [(hx + tip[0]) / 2, (hy + tip[1]) / 2], tip], 0.62);
  mark(steel, [[hx + 0.7, hy - 1.4], [(hx + tip[0]) / 2 - 0.2, (hy + tip[1]) / 2 - 0.4], [tip[0] - 0.3, tip[1] - 0.4]], 0.34);
};

/* ------------------------------------------------------------------ */
/* ONYX (26×35) — oni brawler: masked tusks, wild hair, waist wrap;    */
/* an iron kanabo that smashes overhead through the swing.             */
/* ------------------------------------------------------------------ */

export const drawInkOnyx: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 26;
  const sy = height / 35;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const blood = '#ff2e2e';
  const tusk = '#f4f2ed';
  const iron = '#5a5f6e';
  const skin = '#eda190';

  // Wild hair spikes, raking back harder on dash.
  const rake = pose.dashing ? 3.5 : stride * 0.6;
  const spikes: Array<[number, number, number, number]> = [
    [7 + lean, 5 + lift, 1.5 - rake, 0.5 + lift],
    [9 + lean, 3.4 + lift, 5.5 - rake, -0.5 + lift],
    [13 + lean, 2.2 + lift, 12 - rake * 0.8, -1 + lift],
    [17 + lean, 3.4 + lift, 20.5 - rake * 0.5, -0.4 + lift],
    [19.5 + lean, 5 + lift, 23 - rake * 0.3, 1 + lift],
  ];
  for (const [bx2, by2, tx, ty] of spikes) {
    poly(mat.ink, shift([[bx2 - 1.6, by2 + 1.6], [tx, ty], [bx2 + 1.6, by2 + 1.2], [bx2, by2 + 2.4]]));
  }

  // Legs: bare shins with ankle wraps, big feet.
  const hip: Point = [13, 22];
  let rearKnee: Point = [9 - stride * 0.8, 27];
  let rearFoot: Point = [8 - stride * 1.5, 34 - Math.max(0, stride)];
  let frontKnee: Point = [17 + stride * 0.8, 27];
  let frontFoot: Point = [18 + stride * 1.5, 34 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [5, 25]; rearFoot = [1, 30]; frontKnee = [20, 24]; frontFoot = [16, 34]; }
  if (pose.dashing) { rearKnee = [3, 27]; rearFoot = [-1, 31]; frontKnee = [18, 27]; frontFoot = [23, 33]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 3, hip[1] - 1], [hip[0] + 3, hip[1]], [kx + 2.4, ky - 1], [fx + 1.8, fy - 2],
      [fx + 4.2, fy], [fx + 4.6, fy + 1], [fx - 1.4, fy + 1.2], [fx - 2.2, fy - 1.8], [kx - 2.4, ky + 2], [hip[0] - 4, hip[1] + 2]]);
    poly(skin, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
    mark(mat.ink, [[fx - 1.6, fy - 2.4], [fx + 3.6, fy - 2.4]], 0.7);
    mark(mat.ink, [[fx - 0.6, fy - 2.6], [fx + 2.6, fy + 0.4]], 0.4);
    mark(rear ? mat.fold : skin, [[kx - 1, ky + 1.4], [kx + 2, ky + 1.8]], 0.4);
  };
  leg(rearKnee, rearFoot, true);

  // Broad torso + waist wrap.
  poly(mat.ink, shift([[5 + lean, 14 + lift], [21 + lean, 14 + lift], [22, 22.5], [18, 24.5], [8, 24.5], [4, 22.5]]));
  poly(skin, shift([[7 + lean, 15 + lift], [19 + lean, 15 + lift], [19.5, 19.5], [6.5, 19.5]]));
  poly(mat.deep, shift([[6 + lean, 19 + lift], [20 + lean, 19 + lift], [20.5, 24], [13, 25.4], [5.5, 24]]));
  mark(mat.ink, shift([[6.4, 21.5], [19.6, 21.5]]), 0.5);
  mark(mat.ink, shift([[7, 23], [19, 23.4]]), 0.5);

  // Thick arms.
  const rearShoulder: Point = [8.5 + lean, 15.5 + lift];
  let rearElbow: Point = [3.5 - stride, 19.5];
  let rearHand: Point = [3.5 - stride * 1.3, 23.5];
  let frontElbow: Point = [19 + stride * 0.6, 18.5];
  let frontHand: Point = [18 + stride, 22.5];
  if (pose.airborne) { rearElbow = [2, 16]; rearHand = [-1, 14]; frontElbow = [21, 16]; frontHand = [20, 12]; }
  if (pose.dashing) { rearElbow = [0, 16]; rearHand = [-4, 15]; frontElbow = [15, 19]; frontHand = [11, 21]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 2.4, ay - 1.2], [ax + 2.4, ay], [ex + 2.4, ey - 1], [hx + 2, hy - 1], [hx + 2, hy + 2.2],
      [hx - 1, hy + 2.5], [hx - 3.2, hy], [ex - 2.4, ey + 2], [ax - 3.2, ay + 2]]);
    poly(skin, [[ax - 1, ay + 1], [ex + 1, ey], [hx, hy], [ex - 1, ey + 1]]);
    mark(rear ? mat.fold : blood, [[ax + 1, ay], [ex + 1.8, ey], [hx + 1, hy]], 0.5);
    return [hx, hy] as Point;
  };

  // Face: fierce eyes under a heavy brow, red half-mask with tusks.
  poly(skin, shift([[8.4, 5.5], [17.6, 5.5], [18.4, 11], [13, 15], [7.6, 11]]));
  mark(mat.ink, shift([[9, 6.8], [12.2, 7.6]], 0), 1.1);
  mark(mat.ink, shift([[17, 6.8], [13.8, 7.6]], 0), 1.1);
  poly(tusk, shift([[10, 8.4], [11.6, 8.9], [10.4, 9.7]]));
  poly(tusk, shift([[16, 8.4], [14.4, 8.9], [15.6, 9.7]]));
  poly(mat.accent, shift([[8, 10.5], [18, 10.5], [17.4, 14.2], [13, 15.6], [8.6, 13.8]]));
  poly(tusk, shift([[9.8, 12.6], [10.9, 13], [10.1, 14.4]]));
  poly(tusk, shift([[16.2, 12.6], [15.1, 13], [15.9, 14.4]]));
  mark(mat.ink, shift([[11.5, 15.4], [14.5, 15.4]], 0), 0.5);

  // Kanabo, drawn last: a low forward clothesline sweep through the swing —
  // an overhead arc would drag the shaft across his face. The club hangs
  // from the front grip (angle a: 0 = straight down, + = toward the front).
  frontElbow = [frontElbow[0] + (17.5 - frontElbow[0]) * swing, frontElbow[1] + (16.5 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (16 - frontHand[0]) * swing, frontHand[1] + (17 - frontHand[1]) * swing];
  arm([17.5 + lean, 15.5 + lift], frontElbow, frontHand, false);
  const grip = frontHand;
  let a = 0.12;
  if (pose.airborne) a = 0.5;
  if (pose.dashing) a = -0.55;
  a += swing * 1.25;
  const clubLen = 14;
  const shaft = (f: number): Point => [grip[0] + clubLen * f * Math.sin(a), grip[1] + clubLen * f * Math.cos(a)];
  const clubTip = shaft(1);
  const sideOff = rot(3.3, 0, 0, 0, a);
  const clubSide: Point = [clubTip[0] + sideOff[0] * 0.35, clubTip[1] + sideOff[1] * 0.35];
  const clubSide2: Point = [clubTip[0] - sideOff[0] * 0.35, clubTip[1] - sideOff[1] * 0.35];
  poly(iron, [shaft(0.28), [shaft(0.28)[0] - sideOff[0] * 0.5, shaft(0.28)[1] - sideOff[1] * 0.5], clubSide2, clubTip, clubSide, [shaft(0.28)[0] + sideOff[0] * 0.5, shaft(0.28)[1] + sideOff[1] * 0.5]]);
  // Tapered butt end behind the grip hand.
  poly(mat.ink, [[grip[0] - 1.4, grip[1] + 0.6], [grip[0] + 1.2, grip[1] + 0.4], shaft(0.34), shaft(0.22)]);
  for (const f of [0.5, 0.72, 0.94]) {
    const spikeBase = shaft(f);
    const spikeOut: Point = [spikeBase[0] + sideOff[0] * (0.32 + f * 0.35), spikeBase[1] + sideOff[1] * (0.32 + f * 0.35)];
    poly(tusk, [spikeBase, spikeOut, [spikeBase[0] + sideOff[0] * 0.22, spikeBase[1] + sideOff[1] * 0.22]]);
  }
  mark(mat.ink, [shaft(0.3), clubTip], 0.5);
  // Rear hand joins the grip only through the swing (relaxed at rest).
  const rearGrip = shaft(0.42);
  rearElbow = [rearElbow[0] + (grip[0] - 4.5 - rearElbow[0]) * swing, rearElbow[1] + (grip[1] + 2 - rearElbow[1]) * swing];
  rearHand = [rearHand[0] + (rearGrip[0] - rearHand[0]) * swing, rearHand[1] + (rearGrip[1] - rearHand[1]) * swing];
  arm([8.5 + lean, 15.5 + lift], rearElbow, rearHand, true);
};

/* ------------------------------------------------------------------ */
/* MORTIMER (23×34) — demon butler: tailcoat, monocle, watch chain;    */
/* a three-flame candelabra that sweeps forward on the swing.          */
/* ------------------------------------------------------------------ */

export const drawInkMortimer: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 23;
  const sy = height / 34;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const flameC = '#ff6b4a';
  const flameCore = '#ffd7a0';
  const glovewhite = '#f4f2ed';
  const pale = '#f1d9c8';

  // Tailcoat tails with crimson lining, streaming back.
  const tailReach = pose.dashing ? 9 : pose.airborne ? 6 : 2 + Math.abs(stride) * 1.2;
  const tailWave = stride * 0.45;
  poly(mat.ink, shift([
    [14 + lean, 19 + lift], [17.5 + lean, 19 + lift],
    [14 - tailReach * 0.4, 24 + tailWave], [10 - tailReach, 28.5 + tailWave], [13, 29], [15.5, 24],
  ]));
  poly(mat.accent, shift([[15 + lean, 20 + lift], [16.4 + lean, 20 + lift], [13 - tailReach * 0.4, 24.6 + tailWave], [11.6 - tailReach * 0.7, 27.6 + tailWave]]));

  // Legs: slim trousers, polished shoes.
  const hip: Point = [11.5, 22];
  let rearKnee: Point = [8.5 - stride * 0.8, 26];
  let rearFoot: Point = [7.5 - stride * 1.4, 33 - Math.max(0, stride)];
  let frontKnee: Point = [14.5 + stride * 0.8, 26];
  let frontFoot: Point = [15.5 + stride * 1.4, 33 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [6, 24]; rearFoot = [2, 29]; frontKnee = [17, 23]; frontFoot = [15, 33]; }
  if (pose.dashing) { rearKnee = [4, 26]; rearFoot = [0, 30]; frontKnee = [16, 26]; frontFoot = [21, 32]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2.2, hip[1] - 1], [hip[0] + 2.2, hip[1]], [kx + 1.8, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.2, fy], [fx + 3.6, fy + 1], [fx - 0.8, fy + 1.3], [fx - 2, fy - 1.5], [kx - 1.8, ky + 2], [hip[0] - 3.2, hip[1] + 2]]);
    mark(rear ? mat.fold : glovewhite, [[fx - 1.6, fy - 1.8], [fx + 3.2, fy - 1.8]], 0.4);
  };
  leg(rearKnee, rearFoot, true);

  // Tailcoat body, deep vest, pale buttons, watch chain.
  poly(mat.ink, shift([[6 + lean, 14 + lift], [17 + lean, 14 + lift], [18, 22.5], [14.5, 24], [8.5, 24], [5, 22.5]]));
  poly(mat.deep, shift([[8 + lean, 15 + lift], [15 + lean, 15 + lift], [15.4, 21.5], [7.6, 21.5]]));
  mark(mat.accent, shift([[9.6, 15.5], [8.6, 22]], 0), 0.55);
  mark(mat.accent, shift([[13.4, 15.5], [14.4, 22]], 0), 0.55);
  poly(glovewhite, shift([[11.3, 16.4], [11.9, 16.4], [11.9, 17], [11.3, 17]]));
  poly(glovewhite, shift([[11.3, 18.2], [11.9, 18.2], [11.9, 18.8], [11.3, 18.8]]));
  poly(glovewhite, shift([[11.3, 20], [11.9, 20], [11.9, 20.6], [11.3, 20.6]]));
  mark(glovewhite, shift([[8.6 + lean, 15.6 + lift], [11.5, 19], [14.4, 20.8]], 0), 0.35);

  // Arms with white gloves.
  const rearShoulder: Point = [8.5 + lean, 15 + lift];
  let rearElbow: Point = [4.5 - stride, 18];
  let rearHand: Point = [4.5 - stride * 1.3, 22];
  let frontElbow: Point = [17.5 + stride * 0.6, 17];
  let frontHand: Point = [16.5 + stride, 21];
  if (pose.airborne) { rearElbow = [3, 15]; rearHand = [0, 13]; frontElbow = [20, 15]; frontHand = [19, 11]; }
  if (pose.dashing) { rearElbow = [1, 15]; rearHand = [-3, 14]; frontElbow = [13, 18]; frontHand = [9, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.9, ay - 1], [ax + 1.9, ay], [ex + 1.9, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.7],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.9, ey + 1.6], [ax - 2.6, ay + 1.6]]);
    poly(mat.ink, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    poly(glovewhite, [[hx - 1, hy - 0.4], [hx + 1.4, hy - 0.6], [hx + 1.4, hy + 1.4], [hx - 1, hy + 1.6]]);
    mark(rear ? mat.fold : glovewhite, [[ax + 0.8, ay], [ex + 1.6, ey], [hx + 0.8, hy]], 0.4);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Face: parted pale hair, monocle + chain, knowing smirk.
  poly(pale, shift([[7.9, 6], [15.1, 6], [15.7, 11.2], [11.5, 15], [7.3, 11.2]]));
  poly(mat.ink, shift([[6.9 + lean, 6.2 + lift], [16.1 + lean, 6.2 + lift], [15, 4.2], [8, 4.2]]));
  mark(mat.ink, shift([[12.6, 4.6], [12.4, 6.2]], 0), 0.5);
  mark(mat.ink, shift([[8, 6.4], [8.4, 11.4]], 0), 0.9);
  mark(mat.ink, shift([[15.6, 6.6], [15.2, 11.4]], 0), 0.9);
  poly(mat.ink, shift([[9.3, 8.8], [10.7, 9.2], [9.5, 9.9]]));
  poly(mat.ink, shift([[14.2, 8.8], [12.8, 9.2], [14, 9.9]]));
  mark(mat.ink, shift([[10.9, 12.9], [13.3, 12.7]], 0), 0.5);
  // Monocle over the leading eye + a short chain stub to the collar.
  mark(glovewhite, shift([[13.2, 8.2], [14.6, 8.6], [14.2, 10], [12.9, 9.6], [13.2, 8.2]], 0), 0.4);
  mark(glovewhite, shift([[14.3, 10.3], [13.9, 11.4]], 0), 0.3);

  // Candelabra, drawn last: three candles, flames grow through the swing.
  frontElbow = [frontElbow[0] + (19 - frontElbow[0]) * swing, frontElbow[1] + (13 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (18 - frontHand[0]) * swing, frontHand[1] + (12 - frontHand[1]) * swing];
  arm([15.5 + lean, 15 + lift], frontElbow, frontHand, false);
  const hx = frontHand[0], hy = frontHand[1];
  const grow = 1 + swing * 0.9;
  const top: Point = [hx + 1.5, hy - 8];
  const leftArm: Point = [hx - 2.6, hy - 6];
  const rightArm: Point = [hx + 5.6, hy - 6];
  mark(mat.ink, [[hx, hy + 1], top], 0.9);
  mark(mat.ink, [top, leftArm], 0.7);
  mark(mat.ink, [top, rightArm], 0.7);
  const candle = (baseX: number, baseY: number, h: number) => {
    poly(glovewhite, [[baseX - 0.9, baseY], [baseX + 0.9, baseY], [baseX + 0.9, baseY - h], [baseX - 0.9, baseY - h]]);
    const fy = baseY - h - 1.2 * grow;
    poly(flameC, [[baseX, fy - 2.2 * grow], [baseX + 0.9, fy - 0.8], [baseX, fy + 0.6], [baseX - 0.9, fy - 0.8]]);
    poly(flameCore, [[baseX, fy - 1.2 * grow], [baseX + 0.45, fy - 0.6], [baseX, fy + 0.2], [baseX - 0.45, fy - 0.6]]);
  };
  candle(leftArm[0], leftArm[1] + 0.4, 2.2 * grow);
  candle(top[0], top[1] + 0.4, 3 * grow);
  candle(rightArm[0], rightArm[1] + 0.4, 2.2 * grow);
  // Drip pan under the grip hand.
  poly(mat.ink, [[hx - 2.2, hy + 1], [hx + 2.2, hy + 1], [hx + 2.6, hy + 2.2], [hx - 2.6, hy + 2.2]]);
};

/* ------------------------------------------------------------------ */
/* GRIMSHAW (25×34) — blood-moon reaper: pointed hood, void face,      */
/* tattered cloak; a crescent scythe sweeping the full arc.            */
/* ------------------------------------------------------------------ */

export const drawInkGrimshaw: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 25;
  const sy = height / 34;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const blood = '#dc2626';
  const bone = '#d8d2c4';
  const emberEye = '#ff4d4d';

  // Thin legs + boots peek under the hem.
  const hip: Point = [12.5, 24];
  let rearKnee: Point = [9.5 - stride * 0.8, 28];
  let rearFoot: Point = [8.5 - stride * 1.4, 33.5 - Math.max(0, stride)];
  let frontKnee: Point = [15.5 + stride * 0.8, 28];
  let frontFoot: Point = [16.5 + stride * 1.4, 33.5 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [7, 26]; rearFoot = [3, 30.5]; frontKnee = [18, 25]; frontFoot = [16, 33.5]; }
  if (pose.dashing) { rearKnee = [5, 28]; rearFoot = [1, 32]; frontKnee = [17, 28]; frontFoot = [22, 33]; }
  const leg = (knee: Point, foot: Point) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 1.6, hip[1] - 1], [hip[0] + 1.6, hip[1]], [kx + 1.4, ky - 1], [fx + 1.2, fy - 2],
      [fx + 3, fy], [fx + 3.2, fy + 1], [fx - 1.2, fy + 1], [fx - 1.6, fy - 1.8], [kx - 1.4, ky + 2], [hip[0] - 2.4, hip[1] + 2]]);
  };
  leg(rearKnee, rearFoot);
  leg(frontKnee, frontFoot);

  // Tattered cloak: zigzag hem, tatters sway and stream.
  const hemReach = pose.dashing ? 7 : pose.airborne ? 3 : Math.abs(stride) * 1.1;
  const hemLift = pose.airborne ? -2 : 0;
  const h1 = stride * 0.4, h2 = -stride * 0.4;
  poly(mat.ink, shift([
    [5.5 + lean, 15 + lift], [19.5 + lean, 15 + lift], [21, 22],
    [19 - hemReach * 0.3, 28 + h1 + hemLift], [17.5 - hemReach * 0.5, 31.5 + h2 + hemLift],
    [15.5 - hemReach * 0.3, 28.5 + h1 + hemLift], [13.5 - hemReach * 0.5, 32 + h2 + hemLift],
    [11.5 - hemReach * 0.3, 28.5 + h1 + hemLift], [9.5 - hemReach * 0.5, 31.5 + h2 + hemLift],
    [7.5 - hemReach * 0.3, 28 + h1 + hemLift], [5 - hemReach * 0.5, 29.5 + h2 + hemLift],
    [4, 22],
  ]));
  mark(mat.deep, shift([[6 + lean, 17 + lift], [12.5, 18.5], [19 + lean, 17 + lift]]), 0.4);
  // Blood clasp at the collar.
  poly(blood, shift([[11.6, 15.4], [12.5, 14.6], [13.4, 15.4], [12.5, 16.4]]));
  mark(blood, shift([[12.5, 16.4], [12.5, 19]], 0), 0.35);

  // Hood: tall point bending back, deep-blood rim so it reads on dark
  // ground; void face with two ember eyes.
  const tipSway = -stride * 0.6 - (pose.dashing ? 3.5 : 0);
  poly(mat.deep, shift([
    [6 + lean, 13 + lift], [5 + lean, 6 + lift], [9.5 + lean + tipSway * 0.4, -1.5 + lift],
    [13 + lean + tipSway, 0.5 + lift], [16 + lean, 4.5 + lift], [19 + lean, 9 + lift],
    [18 + lean, 14.5 + lift], [12.5, 17], [7, 16],
  ]));
  poly(mat.ink, shift([[8, 8], [17, 8], [17.4, 13.4], [12.5, 15.6], [7.8, 13]]));
  poly(emberEye, shift([[9.7, 9.8], [11.7, 9.3], [11.2, 11.4], [9.6, 11.2]]));
  poly(emberEye, shift([[15.3, 9.8], [13.3, 9.3], [13.8, 11.4], [15.4, 11.2]]));
  if (pose.dashing) {
    mark(emberEye, [[8.4, 10.4], [5.5, 10.9]], 0.6);
    mark(emberEye, shift([[16.4, 10.4], [19 + lean, 10.9]], 0), 0.6);
  }

  // Rear arm steady on the haft; front arm grips below.
  const rearShoulder: Point = [9 + lean, 16 + lift];
  let rearElbow: Point = [5 - stride, 19.5];
  let rearHand: Point = [5 - stride * 1.3, 23];
  let frontElbow: Point = [18 + stride * 0.6, 18.5];
  let frontHand: Point = [17 + stride, 22];
  if (pose.airborne) { rearElbow = [4, 16]; rearHand = [1, 14]; frontElbow = [20, 16]; frontHand = [19, 12]; }
  if (pose.dashing) { rearElbow = [2, 16]; rearHand = [-2, 15]; frontElbow = [14, 19]; frontHand = [10, 21]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.4, hy - 1], [hx + 1.4, hy + 1.7],
      [hx - 1, hy + 2], [hx - 2.4, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(mat.deep, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? mat.fold : bone, [[ax + 0.8, ay], [ex + 1.6, ey], [hx + 0.8, hy]], 0.4);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Scythe, drawn last: the crescent sweeps the full arc on the swing.
  rearElbow = [rearElbow[0] + (11 - rearElbow[0]) * swing, rearElbow[1] + (17 - rearElbow[1]) * swing];
  rearHand = [rearHand[0] + (12 - rearHand[0]) * swing, rearHand[1] + (16 - rearHand[1]) * swing];
  frontElbow = [frontElbow[0] + (19 - frontElbow[0]) * swing, frontElbow[1] + (15 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (18 - frontHand[0]) * swing, frontHand[1] + (14 - frontHand[1]) * swing];
  arm([16 + lean, 16 + lift], frontElbow, frontHand, false);
  arm([9 + lean, 16 + lift], rearElbow, rearHand, true);
  const gripLow = rearHand;
  let tip: Point = [gripLow[0] + 11, gripLow[1] - 21];
  if (pose.airborne) tip = [gripLow[0] + 12, gripLow[1] - 22];
  if (pose.dashing) tip = [gripLow[0] - 3, gripLow[1] - 14];
  tip = [tip[0] + swing * 4, tip[1] + swing * 7];
  mark(mat.ink, [gripLow, [(gripLow[0] + tip[0]) / 2, (gripLow[1] + tip[1]) / 2], tip], 0.95);
  mark(mat.deep, [[gripLow[0] + 0.6, gripLow[1] - 0.2], [(gripLow[0] + tip[0]) / 2 + 0.6, (gripLow[1] + tip[1]) / 2 - 0.5], [tip[0] - 0.5, tip[1] + 1]], 0.4);
  // Crescent blade riding the tip, built from haft vectors so it always
  // extends forward-down away from the reaper instead of draping over him.
  const hdx = tip[0] - gripLow[0], hdy = tip[1] - gripLow[1];
  const hlen = Math.hypot(hdx, hdy) || 1;
  const dir: Point = [hdx / hlen, hdy / hlen];
  let perp: Point = [-dir[1], dir[0]];
  if (perp[0] < 0) perp = [-perp[0], -perp[1]];
  const along = (f: number, d: number): Point => [tip[0] + perp[0] * f + dir[0] * d, tip[1] + perp[1] * f + dir[1] * d];
  const b0 = tip;
  const b1 = along(3.2, 1.6);
  const b2 = along(6.6, 2.2);
  const b3 = along(7, -0.6);
  const b4 = along(5.4, -2.2);
  const b5 = along(2, -2);
  poly(bone, [b0, b1, b2, b3, b4, b5]);
  poly(blood, [along(1.2, 0.9), along(4.2, 1.6), along(5, -0.4), along(2.4, -1.2)]);
  mark(mat.ink, [b0, b1, b2], 0.4);
};
