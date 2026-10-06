import type { CharacterArtPose } from './character-art';
import { inkPoseTerms, makeInkHelpers, type InkMaterials, type Point } from './ink-kit';

/**
 * Bespoke ink anatomy for the six roster characters that outgrew the shared
 * rect body (tank, mage, ranger, cyborg, spirit, healer). Same drawing-only
 * contract as ink-ninja/ink-cherry: filled bent limbs, broken contours, one
 * accent budget per character, every pose parameter (stride / airborne /
 * dashing / melee / tumble) must move the silhouette. Authored at each
 * character's real collision box.
 */

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number, pose: CharacterArtPose, mat: InkMaterials) => void;

/* ------------------------------------------------------------------ */
/* TANK (28×36) — walking bulwark: pauldrons, visored helm, tower      */
/* shield strapped to the front arm; melee is a shield bash.           */
/* ------------------------------------------------------------------ */

export const drawInkTank: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 28;
  const sy = height / 36;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const steel = '#3a4152';
  const plate = '#525d73';
  const rivet = '#9aa7bd';
  const ember = '#f97316';

  // Heavy greaves: thick bent limbs, wide stance.
  const hip: Point = [14, 24];
  let rearKnee: Point = [8 - stride * 0.8, 29];
  let rearFoot: Point = [6 - stride * 1.4, 35 - Math.max(0, stride)];
  let frontKnee: Point = [20 + stride * 0.8, 29];
  let frontFoot: Point = [22 + stride * 1.4, 35 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [4, 26]; rearFoot = [-1, 31]; frontKnee = [24, 25]; frontFoot = [20, 35]; }
  if (pose.dashing) { rearKnee = [2, 29]; rearFoot = [-3, 33]; frontKnee = [20, 29]; frontFoot = [27, 34]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 4.5, hip[1] - 1], [hip[0] + 4.5, hip[1]], [kx + 3.5, ky - 1], [fx + 2.5, fy - 2],
      [fx + 5.5, fy], [fx + 5, fy + 1], [fx - 2, fy + 1], [fx - 2.5, fy - 2], [kx - 3.5, ky + 2], [hip[0] - 5.5, hip[1] + 2]]);
    poly(steel, [[hip[0] - 1.5, hip[1] + 1], [kx + 1.5, ky], [fx, fy - 2], [kx - 1.5, ky + 1]]);
    mark(rear ? steel : plate, [[hip[0] + 2, hip[1] + 1], [kx + 2.5, ky], [fx + 1.5, fy - 2]]);
    // Boot cuff plate.
    mark(rivet, [[fx - 2.5, fy - 2], [fx + 5, fy - 2]], 0.6);
  };
  leg(rearKnee, rearFoot, true);

  // Rear arm behind the cuirass; tucks on tumble.
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 2.5, ay - 1.5], [ax + 2.5, ay], [ex + 2.5, ey - 1], [hx + 2, hy - 1], [hx + 2, hy + 2],
      [hx - 1, hy + 2.5], [hx - 3, hy], [ex - 2.5, ey + 2], [ax - 3, ay + 2]]);
    poly(steel, [[ax - 1, ay + 1], [ex + 1, ey], [hx, hy], [ex - 1, ey + 1]]);
    mark(rear ? steel : rivet, [[ax + 1, ay], [ex + 2, ey], [hx + 1, hy]]);
  };
  arm([9 + lean, 15 + lift], [4 - stride, 20], [4 - stride * 1.3, 24], true);

  // Barrel cuirass with plastron plate and rivet lines.
  poly(mat.ink, shift([[6 + lean, 14 + lift], [22 + lean, 14 + lift], [23, 22], [21, 26], [7, 26], [5, 22]]));
  poly(steel, shift([[8 + lean, 15.5 + lift], [20 + lean, 15.5 + lift], [20.5, 21], [7.5, 21]]));
  mark(plate, shift([[9, 17], [19, 17]]), 0.5);
  mark(plate, shift([[9, 19], [19, 19]]), 0.5);
  mark(rivet, shift([[8, 16], [8, 20]], 0), 0.5);
  mark(rivet, shift([[20, 16], [20, 20]], 0), 0.5);

  // Massive overhanging pauldrons — the silhouette that says "tank".
  poly(mat.ink, shift([[2 + lean, 12 + lift], [11 + lean, 10 + lift], [12 + lean, 15 + lift], [10, 17], [3, 16]]));
  poly(plate, shift([[3.5 + lean, 13 + lift], [10 + lean, 11.5 + lift], [10.5 + lean, 14 + lift], [4.5, 15]]));
  poly(mat.ink, shift([[17 + lean, 10 + lift], [26 + lean, 12 + lift], [25, 16], [18, 15], [16.5 + lean, 12 + lift]]));
  poly(plate, shift([[18.5 + lean, 11.5 + lift], [24.5 + lean, 13 + lift], [23.5, 15], [19, 14]]));
  mark(rivet, shift([[4 + lean, 12.5 + lift], [10 + lean, 11 + lift]], 0), 0.6);
  mark(rivet, shift([[18 + lean, 11 + lift], [25 + lean, 12.5 + lift]], 0), 0.6);

  // Visored helm: T-slit burning ember, tiny chin guard.
  poly(mat.ink, shift([[9 + lean, 4 + lift], [19 + lean, 4 + lift], [20 + lean, 9 + lift], [17, 13], [11, 13], [8 + lean, 9 + lift]]));
  poly(steel, shift([[10.5 + lean, 5.5 + lift], [17.5 + lean, 5.5 + lift], [18 + lean, 8.5 + lift], [10 + lean, 8.5 + lift]]));
  poly(ember, shift([[11.5, 6.5], [16.5, 6.5], [16.5, 7.8], [14.6, 7.8], [14.4, 9.2], [13.6, 9.2], [13.4, 7.8], [11.5, 7.8]]));
  mark(mat.ink, shift([[12.5, 10.5], [15.5, 10.5]]), 0.6);
  // Helm crest ridge.
  mark(rivet, shift([[14 + lean, 2.5 + lift], [14 + lean, 4 + lift]], 0), 0.8);

  // Tower shield on the front arm: bash thrusts it forward through the swing.
  let shieldElbow: Point = [22 + stride * 0.6, 18];
  let shieldHand: Point = [23 + stride, 22];
  if (pose.airborne) { shieldElbow = [24, 16]; shieldHand = [22, 12]; }
  if (pose.dashing) { shieldElbow = [16, 20]; shieldHand = [11, 22]; }
  shieldElbow = [shieldElbow[0] + (26 - shieldElbow[0]) * swing, shieldElbow[1] + (13 - shieldElbow[1]) * swing];
  shieldHand = [shieldHand[0] + (29 - shieldHand[0]) * swing, shieldHand[1] + (15 - shieldHand[1]) * swing];
  arm([19 + lean, 15 + lift], shieldElbow, shieldHand, false);
  const shieldTop = shieldHand[1] - 9;
  poly(mat.ink, [
    [shieldHand[0] - 4.5, shieldTop + 2], [shieldHand[0] + 4.5, shieldTop],
    [shieldHand[0] + 5.5, shieldHand[1] - 2], [shieldHand[0] + 3, shieldHand[1] + 5],
    [shieldHand[0] - 3, shieldHand[1] + 5], [shieldHand[0] - 5.5, shieldHand[1] - 2],
  ]);
  poly(plate, [
    [shieldHand[0] - 2.8, shieldTop + 3], [shieldHand[0] + 2.8, shieldTop + 2],
    [shieldHand[0] + 3.6, shieldHand[1] - 2], [shieldHand[0] - 3.4, shieldHand[1] - 2],
  ]);
  mark(ember, [[shieldHand[0] - 3, shieldHand[1] + 1.5], [shieldHand[0] + 3, shieldHand[1] + 1.5]], 0.8);
  mark(rivet, [[shieldHand[0] - 3, shieldHand[1] - 3.5], [shieldHand[0] + 3, shieldHand[1] - 3.5]], 0.5);
  leg(frontKnee, frontFoot, false);
};

/* ------------------------------------------------------------------ */
/* MAGE (22×34) — star sage: bent star-tipped hat, robe skirt, orb     */
/* staff; melee thrusts the orb forward in a flash.                    */
/* ------------------------------------------------------------------ */

export const drawInkMage: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 22;
  const sy = height / 34;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const glow = '#c084fc';
  const rune = '#fde68a';

  // Small feet peek from under the robe hem.
  let rearFoot: Point = [8 - stride * 1.2, 33 - Math.max(0, stride)];
  let frontFoot: Point = [14 + stride * 1.2, 33 - Math.max(0, -stride)];
  if (pose.airborne) { rearFoot = [5, 30]; frontFoot = [14, 33]; }
  if (pose.dashing) { rearFoot = [3, 31]; frontFoot = [19, 32]; }
  const foot = (f: Point) => {
    poly(mat.ink, [[f[0] - 2.5, f[1] - 2], [f[0] + 2.5, f[1] - 2], [f[0] + 3, f[1]], [f[0] + 2, f[1] + 1], [f[0] - 2.5, f[1] + 1]]);
  };

  // Robe: A-line from the chest, hem sways against the run and flares in air.
  const sway = -stride * 0.8;
  const flare = pose.airborne ? 2.2 : 0;
  poly(mat.deep, shift([
    [4 - sway - flare, 30 + flare * 0.4], [11, 31.6 + flare * 0.3], [18 + sway + flare, 30 + flare * 0.4],
    [18 + sway + flare, 27], [4 - sway - flare, 27],
  ]));
  poly(mat.ink, shift([
    [7, 19], [15, 19], [18.5 + sway + flare, 28.5 + flare * 0.4],
    [11, 30.2 + flare * 0.3], [3.5 - sway - flare, 28.5 + flare * 0.4],
  ]));
  mark(mat.edge, shift([[3.5 - sway - flare, 28.5 + flare * 0.4], [11, 30], [18.5 + sway + flare, 28.5 + flare * 0.4]]), 0.45);
  // Rune band at the hem.
  mark(glow, shift([[6 - sway - flare, 27.5], [16 + sway + flare, 27.5]]), 0.5);

  // Torso + belt.
  poly(mat.ink, shift([[6.5 + lean, 14 + lift], [15.5 + lean, 14 + lift], [16, 20], [11, 21.5], [6, 20]]));
  poly(mat.fold, shift([[7.5 + lean, 15 + lift], [14.5 + lean, 15 + lift], [14.5, 18.5], [7.5, 18.5]]));
  mark(glow, shift([[7.5, 19], [14.5, 19]]), 0.6);
  mark(rune, shift([[11, 16], [11, 18.5]], 0), 0.5);

  // Rear arm holds the staff low; front arm guides it — melee thrusts the orb.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 22];
  let frontElbow: Point = [17 + stride * 0.6, 17];
  let frontHand: Point = [16 + stride, 22];
  if (pose.airborne) { rearElbow = [3, 15]; rearHand = [0, 13]; frontElbow = [19, 15]; frontHand = [18, 11]; }
  if (pose.dashing) { rearElbow = [1, 15]; rearHand = [-3, 14]; frontElbow = [12, 18]; frontHand = [8, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(mat.fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? mat.fold : mat.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Star-tipped hat: a WIDE brim with a fat solid cone bending back; the
  // star rides AT the cone tip so it never reads as a detached diamond.
  const tipSway = -stride * 0.9 - (pose.dashing ? 3 : 0);
  const tipX = 10.5 + lean + tipSway;
  poly(mat.ink, shift([
    [4 + lean, 7.5 + lift], [18 + lean, 7.5 + lift], [16.5 + lean, 5.2 + lift], [7.5 + lean, 5.2 + lift],
  ]));
  poly(mat.deep, shift([
    [7 + lean, 5.8 + lift], [15 + lean, 5.8 + lift],
    [13.5 + lean + tipSway * 0.45, 2.2 + lift], [tipX + 1.2, 0.2 + lift],
    [tipX - 0.8, 1.6 + lift], [8.8 + lean, 4.4 + lift],
  ]));
  mark(glow, shift([[4 + lean, 7.1 + lift], [18 + lean, 7.1 + lift]]), 0.6);
  // Star at the very tip, overlapping the cone so it is clearly attached.
  const sx4 = tipX + 0.2;
  const sy4 = 0.6 + lift;
  mark(rune, [
    [sx4 - 1.6, sy4 + 0.6], [sx4, sy4 - 1.4], [sx4 + 1.6, sy4 + 0.6],
    [sx4, sy4 - 0.2], [sx4 - 1.6, sy4 + 0.6],
  ], 0.9);

  // Face under the brim, calm downcast eyes.
  poly(mat.skin, shift([[8, 8.5], [14.5, 8.5], [15, 13], [11.5, 15.5], [8.5, 13]]));
  mark(mat.ink, shift([[9.5, 11.5], [11, 11.9]], 0), 0.5);
  mark(mat.ink, shift([[12.5, 11.9], [14, 11.5]], 0), 0.5);
  // Grey beard strokes.
  mark(mat.edge, shift([[9.5, 15], [10, 17.5]], 0), 0.5);
  mark(mat.edge, shift([[13, 15], [12.6, 17.5]], 0), 0.5);

  foot(rearFoot);
  foot(frontFoot);

  // Staff, drawn last: shaft hand-to-orb; melee sweeps the orb ahead.
  let staffHand: Point = [16 + stride * 0.6 + lean, 21 + lift];
  let orb: Point = [18.5, 3.5 + lift * 0.5];
  if (pose.dashing) { orb = [8, 6]; staffHand = [9 + lean, 20]; }
  if (pose.airborne) orb = [18, 2.5 + lift];
  staffHand = [staffHand[0] + (19 - staffHand[0]) * swing, staffHand[1] + (13 - staffHand[1]) * swing];
  orb = [orb[0] + (24 - orb[0]) * swing, orb[1] + (8 - orb[1]) * swing];
  frontElbow = [frontElbow[0] + (18 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
  const frontHandPt = arm([15 + lean, 15 + lift], frontElbow, frontHand, false);
  mark(mat.ink, [staffHand, [(staffHand[0] + orb[0]) / 2, (staffHand[1] + orb[1]) / 2], orb], 0.8);
  poly(glow, [[orb[0] - 2.2, orb[1]], [orb[0], orb[1] - 2.2], [orb[0] + 2.2, orb[1]], [orb[0], orb[1] + 2.2]]);
  poly(rune, [[orb[0] - 0.9, orb[1]], [orb[0], orb[1] - 0.9], [orb[0] + 0.9, orb[1]], [orb[0], orb[1] + 0.9]]);
  mark(glow, [[orb[0] - 3.4, orb[1]], [orb[0] + 3.4, orb[1]]], 0.4);
  void frontHandPt;
};

/* ------------------------------------------------------------------ */
/* RANGER (22×32) — pathfind scout: hooded silhouette, short cape,     */
/* quiver fletchings on the back, bow raised through the melee arc.    */
/* ------------------------------------------------------------------ */

export const drawInkRanger: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 22;
  const sy = height / 32;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const leaf = '#4ade80';
  const hide = '#8a6a45';

  // Cape: short, choppy hem, streams back smaller than the ninja's scarf.
  const reach = pose.dashing ? 14 : pose.airborne ? 10 : 7 + Math.abs(stride) * 1.6;
  const wave = stride * 0.5;
  poly(mat.ink, shift([[14, 12], [8, 9], [1 - reach, 8 + wave], [-2 - reach, 12 + wave], [1, 16], [7, 18], [13, 17]]));
  poly(mat.deep, shift([[13.5, 11.5], [8.5, 9.5], [2 - reach, 9 + wave], [-1 - reach, 11.5 + wave], [2, 14.5], [8, 15.5]]));

  // Legs: field pants + boots.
  const hip: Point = [11, 20];
  let rearKnee: Point = [7 - stride * 0.8, 24];
  let rearFoot: Point = [6 - stride * 1.5, 31 - Math.max(0, stride)];
  let frontKnee: Point = [15 + stride * 0.8, 24];
  let frontFoot: Point = [16 + stride * 1.5, 31 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [4, 22]; rearFoot = [0, 27]; frontKnee = [17, 21]; frontFoot = [14, 31]; }
  if (pose.dashing) { rearKnee = [2, 24]; rearFoot = [-2, 29]; frontKnee = [15, 24]; frontFoot = [21, 30]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2.5, hip[1] - 1], [hip[0] + 2.5, hip[1]], [kx + 2, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.5, fy], [fx + 3, fy + 1], [fx - 2, fy + 1], [fx - 2, fy - 2], [kx - 2, ky + 2], [hip[0] - 3.5, hip[1] + 2]]);
    poly(hide, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
    mark(rear ? mat.fold : mat.edge, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
    mark(mat.ink, [[fx - 2, fy - 1.5], [fx + 3, fy - 1.5]], 0.6);
  };
  leg(rearKnee, rearFoot, true);

  // Quiver behind the rear shoulder with three fletchings.
  poly(mat.fold, shift([[5 + lean, 11 + lift], [9 + lean, 10 + lift], [7.5, 19], [3.5, 18]]));
  mark(hide, shift([[4 + lean, 12 + lift], [7 + lean, 11.2 + lift]], 0), 0.6);
  mark(leaf, shift([[3.5, 10.5], [4.5, 8.5], [5.5, 10]], 0), 0.6);
  mark(leaf, shift([[5.5, 10], [6.5, 8], [7.5, 9.6]], 0), 0.6);
  mark(leaf, shift([[7.5, 9.8], [8.5, 7.8], [9.2, 9.4]], 0), 0.6);

  // Tunic + belt.
  poly(mat.ink, shift([[6.5 + lean, 13 + lift], [15.5 + lean, 13 + lift], [16, 20], [13, 21.5], [9, 21.5], [6, 20]]));
  poly(mat.deep, shift([[7.5 + lean, 14 + lift], [14.5 + lean, 14 + lift], [14.5, 18.5], [7.5, 18.5]]));
  mark(hide, shift([[6.8, 19], [15.2, 19]]), 0.7);

  // Arms: rear steadies the quiver, front holds the bow.
  const rearShoulder: Point = [8 + lean, 14 + lift];
  let rearElbow: Point = [4 - stride, 17];
  let rearHand: Point = [4 - stride * 1.3, 21];
  let frontElbow: Point = [17 + stride * 0.6, 17];
  let frontHand: Point = [16 + stride, 21];
  if (pose.airborne) { rearElbow = [3, 13]; rearHand = [0, 11]; frontElbow = [19, 13]; frontHand = [18, 9]; }
  if (pose.dashing) { rearElbow = [1, 13]; rearHand = [-3, 12]; frontElbow = [12, 17]; frontHand = [8, 19]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(hide, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? mat.fold : mat.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Hood: pointed, tipped back; shadowed face with two leaf eyes.
  poly(mat.deep, shift([[4, 12], [3, 6], [9, 1.5], [14.5, 1.5], [17.5, 5], [17, 11], [12, 14], [7, 14]]));
  poly(mat.ink, shift([[6.8, 6.5], [11.5, 4.8], [15.6, 6.5], [15.6, 11.5], [11, 13], [7, 11]]));
  poly(mat.ink, shift([[17, 4.5], [19.5, 6], [18.6, 11], [16.6, 9.5]]));
  // Hood tip folds back with the wind.
  mark(mat.ink, shift([[14.5 + lean, 1.5 + lift], [17 + lean + (pose.dashing ? 2 : 0), 0.5 + lift]], 0), 0.8);
  poly(leaf, shift([[8.6, 8.2], [11.2, 9.2], [10.8, 10.4], [9, 9.8]]));
  poly(leaf, shift([[12.6, 9.2], [15.2, 8.2], [14.6, 10.2], [13, 10.2]]));

  // Bow, drawn last: arc through the melee swing like Cherry's parasol.
  let bowHand: Point = [16 + stride * 0.6 + lean, 20 + lift];
  let bowTip: Point = [19.5, 26];
  if (pose.dashing) { bowHand = [8 + lean, 19]; bowTip = [2, 24]; }
  if (pose.airborne) bowTip = [20, 24];
  bowHand = [bowHand[0] + (20 - bowHand[0]) * swing, bowHand[1] + (14 - bowHand[1]) * swing];
  bowTip = [bowTip[0] + (25 - bowTip[0]) * swing, bowTip[1] + (5 - bowTip[1]) * swing];
  frontElbow = [frontElbow[0] + (19 - frontElbow[0]) * swing, frontElbow[1] + (13 - frontElbow[1]) * swing];
  // The front hand tracks the grip as the bow swings up — the raised-arm
  // FILL must move too, not just the bow strokes.
  frontHand = [frontHand[0] + (bowHand[0] - frontHand[0]) * swing, frontHand[1] + (bowHand[1] - frontHand[1]) * swing];
  arm([15 + lean, 14 + lift], frontElbow, frontHand, false);
  // Bow limbs curve from the grip toward the tip; string runs straight.
  mark(hide, [bowHand, [(bowHand[0] + bowTip[0]) / 2 + 2.5, (bowHand[1] + bowTip[1]) / 2], bowTip], 0.9);
  mark(mat.ink, [bowHand, bowTip], 0.35);
  mark(leaf, [[bowTip[0] - 1, bowTip[1] - 1], [bowTip[0] + 1, bowTip[1]]], 0.5);
  leg(frontKnee, frontFoot, false);
};

/* ------------------------------------------------------------------ */
/* CYBORG (24×33) — chrome vanguard: visor band with cyan slit, plated  */
/* front arm, ankle jets that ignite on dash and airborne.              */
/* ------------------------------------------------------------------ */

export const drawInkCyborg: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 24;
  const sy = height / 33;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const cyan = '#22d3ee';
  const chrome = '#64748b';
  const panel = '#94a3b8';

  // Legs: one human, one plated; jets at both ankles.
  const hip: Point = [12, 21];
  let rearKnee: Point = [8 - stride * 0.8, 25];
  let rearFoot: Point = [7 - stride * 1.5, 32 - Math.max(0, stride)];
  let frontKnee: Point = [16 + stride * 0.8, 25];
  let frontFoot: Point = [17 + stride * 1.5, 32 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [5, 23]; rearFoot = [1, 28]; frontKnee = [18, 22]; frontFoot = [15, 32]; }
  if (pose.dashing) { rearKnee = [3, 25]; rearFoot = [-1, 30]; frontKnee = [16, 25]; frontFoot = [22, 31]; }
  const jet = (foot: Point, lit: boolean) => {
    poly(mat.ink, [[foot[0] - 1, foot[1] - 4], [foot[0] + 3, foot[1] - 4], [foot[0] + 2, foot[1] - 2.5], [foot[0], foot[1] - 2.5]]);
    if (lit) {
      poly(cyan, [[foot[0] + 0.2, foot[1] - 2.5], [foot[0] + 1.8, foot[1] - 2.5], [foot[0] + 1, foot[1] + 1.5]]);
    }
  };
  const lit = Boolean(pose.dashing || pose.airborne);
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(mat.ink, [[hip[0] - 2.8, hip[1] - 1], [hip[0] + 2.8, hip[1]], [kx + 2.2, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.5, fy], [fx + 3, fy + 1], [fx - 2, fy + 1], [fx - 2, fy - 2], [kx - 2.2, ky + 2], [hip[0] - 3.8, hip[1] + 2]]);
    poly(chrome, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
    mark(rear ? mat.fold : panel, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
    mark(cyan, [[kx - 1.5, ky + 0.5], [kx + 1.5, ky + 1.2]], 0.5);
    jet(foot, lit && !rear);
  };
  leg(rearKnee, rearFoot, true);

  // Rear arm keeps a human silhouette; hand tucks on tumble.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 22];
  let frontElbow: Point = [18 + stride * 0.6, 18];
  let frontHand: Point = [17 + stride, 22];
  if (pose.airborne) { rearElbow = [3, 16]; rearHand = [0, 14]; frontElbow = [20, 16]; frontHand = [19, 12]; }
  if (pose.dashing) { rearElbow = [1, 16]; rearHand = [-3, 15]; frontElbow = [13, 19]; frontHand = [9, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    if (rear) {
      poly(mat.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
        [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
      poly(mat.fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
      mark(mat.fold, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
    } else {
      // Mechanical arm: angular plated segments + glowing elbow joint.
      poly(mat.ink, [[ax - 2.2, ay - 1.5], [ax + 2.2, ay], [ex + 2.2, ey - 1.5], [hx + 2, hy - 1], [hx + 2, hy + 2],
        [hx - 1, hy + 2.5], [hx - 3, hy], [ex - 2.2, ey + 2], [ax - 3, ay + 2]]);
      poly(chrome, [[ax - 0.8, ay + 0.5], [ax + 1.2, ay + 0.5], [ex + 1, ey], [ex - 1.4, ey + 1]]);
      poly(panel, [[ex - 1, ey + 0.6], [ex + 1.4, ey - 0.2], [hx, hy], [ex - 2, ey + 1.6]]);
      poly(cyan, [[ex - 1.2, ey - 0.4], [ex + 0.8, ey - 0.8], [ex + 0.8, ey + 0.8], [ex - 1.2, ey + 0.8]]);
      mark(mat.ink, [[hx - 1, hy - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1], [hx - 1, hy + 1]], 0.5);
    }
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Plated torso with chest core.
  poly(mat.ink, shift([[5.5 + lean, 14 + lift], [18.5 + lean, 14 + lift], [19, 22], [16, 24], [8, 24], [5, 22]]));
  poly(chrome, shift([[7 + lean, 15 + lift], [17 + lean, 15 + lift], [17.5, 20.5], [6.5, 20.5]]));
  mark(mat.ink, shift([[7, 18], [17, 18]]), 0.6);
  mark(mat.ink, shift([[7, 20], [17, 20]]), 0.6);
  poly(cyan, shift([[10.4, 16], [13.6, 16], [13.6, 17.4], [10.4, 17.4]]));
  mark(cyan, shift([[12, 17.4], [12, 19.6]], 0), 0.7);
  // Shoulder plate over the mechanical arm.
  poly(mat.ink, shift([[15.5 + lean, 12.5 + lift], [21.5 + lean, 14 + lift], [20.5, 17], [15.5, 16]]));
  poly(panel, shift([[16.5 + lean, 13.5 + lift], [20 + lean, 14.5 + lift], [19.2, 15.8], [16.5, 15]]));

  // Flat-top head with a full visor band and one burning cyan slit.
  poly(mat.ink, shift([[7 + lean, 4 + lift], [17 + lean, 4 + lift], [18 + lean, 10 + lift], [16, 14], [8, 14], [6 + lean, 10 + lift]]));
  poly(chrome, shift([[8 + lean, 5 + lift], [16 + lean, 5 + lift], [16.8, 9 + lift], [7.2, 9 + lift]]));
  poly(mat.ink, shift([[7.5 + lean, 6.5 + lift], [16.5 + lean, 6.5 + lift], [16.5 + lean, 8.8 + lift], [7.5 + lean, 8.8 + lift]]));
  poly(cyan, shift([[12.4, 7.1], [15.6, 7.1], [15.6, 8.2], [12.4, 8.2]]));
  mark(mat.ink, shift([[14 + lean, 1.8 + lift], [14 + lean, 4 + lift]], 0), 0.8);
  // Jaw plate.
  poly(mat.fold, shift([[9.5, 12], [14.5, 12], [14, 14], [10, 14]]));

  // Plasma punch: the mechanical fist launches forward with a cyan burst.
  frontElbow = [frontElbow[0] + (22 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (27 - frontHand[0]) * swing, frontHand[1] + (12 - frontHand[1]) * swing];
  arm([16 + lean, 15 + lift], frontElbow, frontHand, false);
  if (swing > 0.3) {
    const hx = frontHand[0] - tuck * 1.5 + 2, hy = frontHand[1] - tuck * 2.5;
    poly(cyan, [[hx + 0.5, hy - 2.2], [hx + 2.6 + swing * 2, hy], [hx + 0.5, hy + 2.2]]);
  }
  leg(frontKnee, frontFoot, false);
};

/* ------------------------------------------------------------------ */
/* SPIRIT (21×33) — veiled wisp: floats on a spectral tail, detached    */
/* sleeves, two orbiting wisps; melee is a two-palm push.               */
/* ------------------------------------------------------------------ */

export const drawInkSpirit: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, lean, lift } = inkPoseTerms(pose);
  const sx = width / 21;
  const sy = height / 33;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const veil = '#ede9fe';
  const glow = '#a78bfa';
  // Spirits never quite touch the ground.
  const float = lift - 1.5;

  // Spectral tail instead of legs: sways against the run, streams on dash,
  // frays at the tip.
  const tailSway = -stride * 1.6;
  const tailReach = pose.dashing ? 9 : pose.airborne ? 5 : 2 + Math.abs(stride) * 0.8;
  ctx.globalAlpha = 0.62;
  poly(glow, shift([
    [6.5, 21 + float], [14.5, 21 + float],
    [13.5 + tailSway, 26 + float], [16 + tailSway + tailReach, 29.5 + float],
    [11 + tailSway * 0.6, 28 + float], [10.5, 32.5 + float],
    [7.5, 28.5 + float], [3 - tailReach, 30 + float], [7.5, 25 + float],
  ]));
  ctx.globalAlpha = 0.85;
  poly(veil, shift([
    [8, 21 + float], [13, 21 + float],
    [12.2 + tailSway * 0.7, 25.5 + float], [14 + tailSway * 0.8 + tailReach * 0.6, 28.5 + float],
    [10.5, 27.5 + float], [10, 31 + float], [8, 27.5 + float],
    [5.5 - tailReach * 0.6, 28.5 + float], [7.8, 24 + float],
  ]));
  ctx.globalAlpha = 1;

  // Robe body, hood-down collar.
  poly(mat.ink, shift([[6 + lean, 13 + float], [15 + lean, 13 + float], [15.8, 20], [11, 21.8], [6.2, 20]]));
  poly('#ddd6fe', shift([[7.5 + lean, 14 + float], [13.5 + lean, 14 + float], [14, 18.5], [7, 18.5]]));
  mark(glow, shift([[7.2, 18.8], [13.8, 18.8]]), 0.5);

  // Detached sleeves: a gap between shoulder and cuff, drifted by stride.
  const sleeve = (shoulder: Point, cuff: Point) => {
    poly(mat.ink, [[shoulder[0] - 1.8, shoulder[1] - 1], [shoulder[0] + 1.8, shoulder[1]],
      [cuff[0] + 1.6, cuff[1] - 1.5], [cuff[0] + 1.6, cuff[1] + 2], [cuff[0] - 2, cuff[1] + 2.2], [cuff[0] - 2.2, cuff[1] - 0.8]]);
    poly(veil, [[shoulder[0] - 0.8, shoulder[1]], [shoulder[0] + 1, shoulder[1] + 0.4], [cuff[0], cuff[1] + 0.8], [cuff[0] - 1.4, cuff[1]]]);
    mark(glow, [[cuff[0] - 1.8, cuff[1] + 2], [cuff[0] + 1.4, cuff[1] + 2]], 0.5);
  };
  const rearCuff: [number, number] = [3.5 - stride + lean, 18 + float];
  let frontCuff: [number, number] = [17.5 + stride * 0.6 + lean, 18 + float];
  if (pose.airborne) { rearCuff[1] -= 3; frontCuff[0] += 1.5; frontCuff[1] -= 4; }
  if (pose.dashing) { rearCuff[0] -= 3; frontCuff[0] -= 6; frontCuff[1] += 1; }
  // Melee: both sleeves push forward, palms out.
  const pushX = swing * 5;
  frontCuff = [frontCuff[0] + pushX, frontCuff[1] - swing * 2.5];
  sleeve([7.5 + lean, 15 + float], rearCuff);
  sleeve([13.5 + lean, 15 + float], frontCuff);
  if (swing > 0.25) {
    ctx.globalAlpha = 0.5 + swing * 0.4;
    poly(glow, [[frontCuff[0] + 2.5, frontCuff[1] - 1], [frontCuff[0] + 6 + swing * 3, frontCuff[1] - 2.5],
      [frontCuff[0] + 6 + swing * 3, frontCuff[1] + 1.5], [frontCuff[0] + 2.5, frontCuff[1] + 1.5]]);
    ctx.globalAlpha = 1;
  }

  // Hood/veil over the head; no face — one soft eye-glow under the cowl.
  poly(veil, shift([[5.5, 11], [5, 5], [10.5, 1.5], [16, 5], [15.5, 11], [10.5, 14]]));
  poly(mat.ink, shift([[7.2, 6.5], [10.5, 4.8], [13.8, 6.5], [13.8, 11], [10.5, 12.6]]));
  poly(glow, shift([[9.6, 8.2], [11.8, 7.6], [12.6, 8.6], [11.2, 9.4]]));
  mark(veil, shift([[5.5, 10.8], [10.5, 13.8], [15.5, 10.8]], 0), 0.6);

  // Two orbiting wisps, phased by the stride — tiny diamonds, not points.
  const orbit = stride * 1.2 + (pose.dashing ? 2.5 : 0);
  const wisp = (x: number, y: number, color: string, r: number) => {
    poly(color, [[x - r, y], [x, y - r], [x + r, y], [x, y + r]]);
  };
  ctx.globalAlpha = 0.85;
  wisp(10.5 + Math.cos(orbit) * 12, 14 + Math.sin(orbit) * 5, glow, 1.4);
  wisp(10.5 + Math.cos(orbit + Math.PI) * 13, 18 + Math.sin(orbit + Math.PI) * 6, veil, 1.1);
  ctx.globalAlpha = 1;
};

/* ------------------------------------------------------------------ */
/* HEALER (23×33) — field acolyte: soft hair bun, calm face, emblem     */
/* robe, satchel strap, lantern staff; melee swings the lantern arc.    */
/* ------------------------------------------------------------------ */

export const drawInkHealer: Draw = (ctx, width, height, pose, mat) => {
  const { stride, swing, tuck, lean, lift } = inkPoseTerms(pose);
  const sx = width / 23;
  const sy = height / 33;
  const { poly, mark, shift } = makeInkHelpers(ctx, sx, sy, lean, lift);
  const mint = '#5eead4';
  const cloth = '#f1f5f9';
  const hide = '#8a6a45';

  // Legs: ankle boots under a mid-calf robe.
  let rearFoot: Point = [8.5 - stride * 1.3, 32 - Math.max(0, stride)];
  let frontFoot: Point = [14.5 + stride * 1.3, 32 - Math.max(0, -stride)];
  if (pose.airborne) { rearFoot = [5, 29]; frontFoot = [15, 32]; }
  if (pose.dashing) { rearFoot = [3, 30]; frontFoot = [20, 31]; }
  const foot = (f: Point) => {
    poly(mat.ink, [[f[0] - 2.5, f[1] - 2], [f[0] + 2.5, f[1] - 2], [f[0] + 3, f[1]], [f[0] + 2, f[1] + 1], [f[0] - 2.5, f[1] + 1]]);
  };

  // Robe skirt, gentler sway than the mage's.
  const sway = -stride * 0.6;
  const flare = pose.airborne ? 1.8 : 0;
  poly(mat.ink, shift([
    [5 - sway - flare, 29 + flare * 0.4], [11.5, 30.6 + flare * 0.3], [18 + sway + flare, 29 + flare * 0.4],
    [18 + sway + flare, 26], [5 - sway - flare, 26],
  ]));
  poly(cloth, shift([
    [6, 20], [17, 20], [17.8 + sway + flare, 27.8 + flare * 0.4],
    [11.5, 29.4 + flare * 0.3], [5.2 - sway - flare, 27.8 + flare * 0.4],
  ]));
  mark(mint, shift([[5.4 - sway - flare, 27.2], [17.6 + sway + flare, 27.2]]), 0.5);

  // Bodice + sash + chest emblem.
  poly(mat.ink, shift([[6.5 + lean, 14 + lift], [16.5 + lean, 14 + lift], [17, 21], [11.5, 22.5], [6, 21]]));
  poly(cloth, shift([[7.5 + lean, 15 + lift], [15.5 + lean, 15 + lift], [15.5, 19.5], [7.5, 19.5]]));
  mark(mint, shift([[7, 19.8], [16, 19.8]]), 0.7);
  // Satchel strap diagonal + pouch at the hip.
  mark(hide, shift([[8 + lean, 15 + lift], [15, 21]], 0), 0.9);
  poly(hide, shift([[13.6, 20.6], [16.2, 20.6], [16, 23], [13.8, 23]]));
  // Soft chest emblem: a mint cross.
  poly(mint, shift([[11, 15.6], [12.2, 15.6], [12.2, 16.6], [13.2, 16.6], [13.2, 17.8], [12.2, 17.8], [12.2, 18.8], [11, 18.8], [11, 17.8], [10, 17.8], [10, 16.6], [11, 16.6]]));

  // Arms with wide healer sleeves.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 21];
  let frontElbow: Point = [18 + stride * 0.6, 18];
  let frontHand: Point = [17 + stride, 22];
  if (pose.airborne) { rearElbow = [3, 15]; rearHand = [0, 13]; frontElbow = [20, 15]; frontHand = [19, 11]; }
  if (pose.dashing) { rearElbow = [1, 15]; rearHand = [-3, 14]; frontElbow = [13, 19]; frontHand = [9, 21]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(mat.ink, [[ax - 2.2, ay - 1], [ax + 2.2, ay], [ex + 2.2, ey - 1], [hx + 1.8, hy - 1], [hx + 1.8, hy + 2],
      [hx - 1, hy + 2.2], [hx - 3, hy], [ex - 2.2, ey + 1.8], [ax - 2.8, ay + 1.8]]);
    poly(cloth, [[ax - 1, ay + 0.8], [ex + 1, ey], [hx, hy], [ex - 1, ey + 1]]);
    mark(rear ? mat.fold : mint, [[ax + 1, ay], [ex + 2, ey], [hx + 1, hy]], 0.5);
    return [hx, hy] as Point;
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Head: warm face, calm closed eyes, hair bun with a mint pin.
  poly(mat.skin, shift([[7.5, 6.5], [12, 4.8], [16, 6.5], [16.2, 11], [13.5, 14], [9.5, 14], [7.2, 11]]));
  poly(mat.ink, shift([[6.8, 5.5], [12, 3.2], [16.8, 5.5], [17.2, 8], [15.4, 6.8], [12, 5.6], [8.6, 6.8], [6.6, 8]]));
  poly(mat.deep, shift([[16.2, 4.5], [18.2, 5], [18, 8], [16.4, 7.4]]));
  // Bun.
  poly(mat.deep, shift([[8.6, 2.6], [11, 1.4], [13, 2.4], [12, 4], [9.4, 4]]));
  mark(mint, shift([[10.2, 1.8], [12.2, 2.8]], 0), 0.5);
  mark(mat.ink, shift([[9.2, 9.8], [10.8, 10.2]], 0), 0.5);
  mark(mat.ink, shift([[13, 10.2], [14.6, 9.8]], 0), 0.5);
  mark(mat.deep, shift([[10.8, 12.2], [13, 12.2]], 0), 0.5);

  foot(rearFoot);
  foot(frontFoot);

  // Lantern staff, drawn last; the shaft rides clear of the face at x≥20.
  let staffHand: Point = [18 + stride * 0.6 + lean, 21 + lift];
  let lantern: Point = [20.5, 5.5 + lift * 0.5];
  if (pose.dashing) { lantern = [9, 8]; staffHand = [10 + lean, 20]; }
  if (pose.airborne) lantern = [20, 4.5 + lift];
  staffHand = [staffHand[0] + (21 - staffHand[0]) * swing, staffHand[1] + (14 - staffHand[1]) * swing];
  lantern = [lantern[0] + (26 - lantern[0]) * swing, lantern[1] + (10 - lantern[1]) * swing];
  frontElbow = [frontElbow[0] + (20 - frontElbow[0]) * swing, frontElbow[1] + (15 - frontElbow[1]) * swing];
  arm([16 + lean, 15 + lift], frontElbow, frontHand, false);
  // Shaft: dark core with a light edge highlight so it reads at 1×.
  mark(mat.ink, [staffHand, [(staffHand[0] + lantern[0]) / 2, (staffHand[1] + lantern[1]) / 2], lantern], 0.9);
  mark(mint, [[staffHand[0] + 0.4, staffHand[1] - 0.4], [(staffHand[0] + lantern[0]) / 2 + 0.5, (staffHand[1] + lantern[1]) / 2 - 0.5]], 0.3);
  // Lantern: dark frame with a bright mint core and a top ring.
  poly(mat.ink, [
    [lantern[0] - 2.4, lantern[1] - 2], [lantern[0] + 2.4, lantern[1] - 2],
    [lantern[0] + 3, lantern[1] + 3.4], [lantern[0] - 3, lantern[1] + 3.4],
  ]);
  poly(mint, [
    [lantern[0] - 1.5, lantern[1] - 1], [lantern[0] + 1.5, lantern[1] - 1],
    [lantern[0] + 2.1, lantern[1] + 2.8], [lantern[0] - 2.1, lantern[1] + 2.8],
  ]);
  mark(mat.ink, [[lantern[0] - 1.2, lantern[1] - 2], [lantern[0] + 1.2, lantern[1] - 2]], 0.8);
  mark(mat.ink, [[lantern[0], lantern[1] - 2], [lantern[0], lantern[1] - 3]], 0.6);
  foot(rearFoot);
  foot(frontFoot);
};
