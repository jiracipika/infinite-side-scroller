import type { CharacterArtPose } from '../../src/game/rendering/character-art';

/**
 * Cherry — concept iterations (v2) for the red-haired, cherry-themed gothic
 * character. All three concepts share the cherry-goth DNA (deep cherry-red
 * hair, near-black gothic silhouette, pale skin, cherry-red accent budget,
 * one leaf-green stem micro-accent) but differ at the SILHOUETTE level:
 *
 *   A. Midnight Lolita — twin-tails, scalloped bell skirt, parasol melee.
 *   B. Cherry Reaper   — hooded cape, shadowed face, cherry-stem whip.
 *   C. Cherry Punk     — bob with streaks, cropped jacket, knuckle punch.
 *
 * v2 changes from the first contact sheet: hair reads as locks (not a
 * banner), the parasol canopy is cherry-red and chunky, the reaper cape
 * stays behind the torso, hair reach is bounded.
 *
 * Authored at her planned collision size (22×32) in the same ink idiom as
 * ink-ninja.ts: filled bent limbs, broken contours, one disciplined accent.
 */

type Point = readonly [number, number];

interface InkPalette {
  ink: string;    // dominant near-black (dress, limbs, contours)
  fold: string;   // mid shade (boots, inner panels)
  edge: string;   // light contour marks
  accent: string; // cherry red — hair + eyes + charm budget
  deep: string;   // darker cherry red for hair fold shading
  stem: string;   // leaf green micro-accent
  skin: string;   // pale gothic skin
}

const CHERRY_PALETTE: InkPalette = {
  ink: '#141019',
  fold: '#3a2c42',
  edge: '#a78bb0',
  accent: '#e5304a',
  deep: '#8e1226',
  stem: '#5a8f5a',
  skin: '#f2e2da',
};

function helpersFor(ctx: CanvasRenderingContext2D, sx: number, sy: number, lean: number, lift: number) {
  const poly = (color: string, points: readonly Point[]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
    ctx.closePath();
    ctx.fill();
  };
  const mark = (color: string, points: readonly Point[], weight = 0.55) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = weight * Math.min(sx, sy);
    ctx.beginPath();
    points.forEach(([x, y], i) => (i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy)));
    ctx.stroke();
  };
  const shift = (points: readonly Point[], x = lean, y = lift): Point[] =>
    points.map(([px, py]) => [px + x, py + y] as Point);
  return { poly, mark, shift };
}

function poseTerms(pose: CharacterArtPose) {
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
  const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
  const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * 0.35;
  const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * 0.2;
  return { stride, swing, tuck, lean, lift };
}

/* ------------------------------------------------------------------ */
/* A. Midnight Lolita — twin-tails, scalloped skirt, parasol           */
/* ------------------------------------------------------------------ */

export function drawCherryLolita(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: CharacterArtPose,
): void {
  const P = CHERRY_PALETTE;
  const { stride, swing, tuck, lean, lift } = poseTerms(pose);
  const sx = width / 22;
  const sy = height / 32;
  const { poly, mark, shift } = helpersFor(ctx, sx, sy, lean, lift);

  // Twin-tails: two distinct ribbon locks streaming back and DROOPING with
  // the wind, each tapering to a point. Reach bounded; roots sit at the head
  // sides under stem bows.
  const reach = pose.dashing ? 17 : pose.airborne ? 12 : 8 + Math.abs(stride) * 1.6;
  const wave = stride * 0.5;
  // Upper lock.
  poly(P.accent, shift([[14.5, 4.5], [10, 3.5], [5, 4.5 + wave], [-0.5 - reach, 6 + wave], [3, 6.8], [9, 6.2], [14, 5.6]]));
  poly(P.deep, shift([[14, 4.9], [9, 4], [4.5, 4.9 + wave], [0, 6 + wave], [3.5, 6.3], [9, 5.7]]));
  // Lower lock, phase-shifted.
  poly(P.accent, shift([[14, 7.5], [9, 6.8], [4, 8 - wave], [-1 - reach, 10.5 - wave], [2.5, 11.2], [8.5, 9.6], [13.6, 8.8]]));
  poly(P.deep, shift([[13.6, 7.8], [8.5, 7.2], [4, 8.4 - wave], [-0.5 - reach, 10.3 - wave], [3, 10.4], [8.5, 9.2]]));
  // Stem bows tying the locks.
  mark(P.stem, shift([[14.2, 3.9], [15.4, 2.6], [16.2, 1.4]], 0), 0.5);
  mark(P.stem, shift([[13.6, 7.1], [14.8, 5.9], [15.8, 4.9]], 0), 0.5);

  // Bent-limb legs in dark stockings; Mary-Jane boots with a strap mark.
  const hip: Point = [11, 20];
  let rearKnee: Point = [7 - stride * 0.8, 24];
  let rearFoot: Point = [6 - stride * 1.5, 31 - Math.max(0, stride)];
  let frontKnee: Point = [15 + stride * 0.8, 24];
  let frontFoot: Point = [16 + stride * 1.5, 31 - Math.max(0, -stride)];
  if (pose.airborne) {
    rearKnee = [4, 22]; rearFoot = [0, 27];
    frontKnee = [17, 21]; frontFoot = [14, 31];
  }
  if (pose.dashing) {
    rearKnee = [2, 24]; rearFoot = [-2, 29];
    frontKnee = [15, 24]; frontFoot = [21, 30];
  }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(P.ink, [[hip[0] - 2.5, hip[1] - 1], [hip[0] + 2.5, hip[1]], [kx + 2, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.5, fy], [fx + 3, fy + 1], [fx - 2, fy + 1], [fx - 2, fy - 2], [kx - 2, ky + 2], [hip[0] - 3.5, hip[1] + 2]]);
    poly(P.fold, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
    mark(rear ? P.fold : P.edge, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
    mark(P.edge, [[fx - 2, fy - 1.5], [fx + 3, fy - 1.5]], 0.5);
  };
  leg(rearKnee, rearFoot, true);

  // Rear arm stays behind the bodice; hands tuck on tumble.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 21];
  let frontElbow: Point = [17 + stride * 0.6, 18];
  let frontHand: Point = [16 + stride, 22];
  if (pose.airborne) { rearElbow = [3, 16]; rearHand = [0, 14]; frontElbow = [19, 16]; frontHand = [18, 12]; }
  if (pose.dashing) { rearElbow = [1, 16]; rearHand = [-3, 15]; frontElbow = [12, 19]; frontHand = [8, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(P.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(P.fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? P.fold : P.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Scalloped bell skirt: hem sways against the run, flares on air, and a
  // cherry-red underskirt sliver peeks between the hem scallops.
  const sway = -stride * 0.8;
  const flare = pose.airborne ? 2 : 0;
  poly(P.accent, shift([
    [3 - sway - flare, 26 + flare * 0.5], [7, 28.2 + flare * 0.4], [11, 26.6 + flare * 0.5],
    [15, 28.2 + flare * 0.4], [19 + sway + flare, 26 + flare * 0.5],
    [19 + sway + flare, 24.5], [3 - sway - flare, 24.5],
  ]));
  poly(P.ink, shift([
    [7, 19], [15, 19], [18.5 + sway + flare, 25 + flare * 0.5],
    [15, 26.8 + flare * 0.4], [11, 25.2 + flare * 0.5], [7, 26.8 + flare * 0.4],
    [3.5 - sway - flare, 25 + flare * 0.5],
  ]));
  mark(P.edge, shift([[3.5 - sway - flare, 25], [7, 26.6], [11, 25], [15, 26.6], [18.5 + sway + flare, 25]]), 0.45);

  // Fitted bodice with corset lacing.
  poly(P.ink, shift([[6.5 + lean, 15 + lift], [15.5 + lean, 15 + lift], [16, 20], [13, 21.5], [9, 21.5], [6, 20]]));
  poly(P.fold, shift([[7.5 + lean, 16 + lift], [14.5 + lean, 16 + lift], [14.5, 19.5], [7.5, 19.5]]));
  mark(P.edge, shift([[9, 16.5], [9, 19.5]], 0.4));
  mark(P.edge, shift([[13, 16.5], [13, 19.5]], 0.4));
  mark(P.edge, shift([[9, 17], [13, 18.5]], 0.35));
  mark(P.edge, shift([[9, 18.5], [13, 17]], 0.35));

  // Cherry charm at the collar: two dots + a green stem.
  poly(P.accent, shift([[10.2, 21.5], [11.2, 21.5], [11.2, 22.5], [10.2, 22.5]]));
  poly(P.accent, shift([[11.8, 22], [12.8, 22], [12.8, 23], [11.8, 23]]));
  mark(P.stem, shift([[10.7, 21.3], [12.3, 21.8]], 0.45));

  leg(frontKnee, frontFoot, false);
  arm([15 + lean, 16 + lift], frontElbow, frontHand, false);

  // Head: pale gothic face under blunt bangs with a zigzag hem (broken
  // contour), side locks framing the cheeks.
  poly(P.skin, shift([[7, 6], [11, 4.2], [15, 6], [15.4, 11], [13, 13.8], [9, 13.8], [6.6, 11]]));
  poly(P.accent, shift([[5.8, 4.5], [11, 2.2], [16.2, 4.5], [16.2, 7], [14.6, 5.4], [12.6, 7], [10.6, 5.4], [8.6, 7], [6.6, 5.4], [5.8, 7]]));
  poly(P.deep, shift([[5, 5], [6.6, 6], [6.2, 13], [4.6, 11.5]]));
  poly(P.accent, shift([[16.2, 5], [17.6, 6], [17.9, 12], [16.3, 12.6]]));
  // Cherry-red angular eyes.
  poly('#ff5d73', shift([[8.4, 8.4], [11.2, 9.6], [10.8, 10.8], [9.2, 10.2]]));
  poly('#ff5d73', shift([[13, 9.4], [16.2, 8.2], [15.6, 10.6], [13.4, 10.6]]));
  mark(P.ink, shift([[9, 12.2], [11.5, 12.7], [13.5, 12.2]]), 0.5);

  // Parasol, drawn LAST so nothing occludes it: closed cherry-red canopy
  // carried up-forward on the shoulder (clear of the streaming hair). Melee
  // sweeps an overhead bonk arc; dash trails it low behind; airborne tilts it.
  let parasolHand: Point = [16 + stride * 0.6 + lean, 20 + lift];
  let parasolTip: Point = [21.5, 3.5 + lift * 0.5];
  if (pose.dashing) { parasolHand = [8 + lean, 20]; parasolTip = [2, 15]; }
  if (pose.airborne) { parasolTip = [20.5, 2 + lift]; }
  parasolHand = [parasolHand[0] + (20 - parasolHand[0]) * swing, parasolHand[1] + (12.5 - parasolHand[1]) * swing];
  parasolTip = [parasolTip[0] + (27 - parasolTip[0]) * swing, parasolTip[1] + (6 - parasolTip[1]) * swing];
  // Shaft with a light edge highlight so it reads at 1×.
  mark(P.ink, [parasolHand, [(parasolHand[0] + parasolTip[0]) / 2, (parasolHand[1] + parasolTip[1]) / 2 - 0.8], parasolTip], 0.9);
  mark(P.edge, [[parasolHand[0] + 0.3, parasolHand[1] - 0.3], [parasolTip[0] * 0.5 + parasolHand[0] * 0.5, parasolTip[1] * 0.5 + parasolHand[1] * 0.5 - 1]], 0.3);
  // Handle hook below the grip.
  mark(P.edge, [[parasolHand[0] - 1.2, parasolHand[1] + 2], [parasolHand[0], parasolHand[1] + 0.8]], 0.6);
  const spread = 2.2 + swing * 1.8;
  poly(P.accent, [
    [parasolTip[0] - spread, parasolTip[1] + 5],
    [parasolTip[0] - spread * 0.55, parasolTip[1] + 1],
    [parasolTip[0], parasolTip[1] - 0.6],
    [parasolTip[0] + spread * 0.55, parasolTip[1] + 1],
    [parasolTip[0] + spread, parasolTip[1] + 5],
    [parasolTip[0] + spread * 0.5, parasolTip[1] + 3.8],
    [parasolTip[0], parasolTip[1] + 5.4],
    [parasolTip[0] - spread * 0.5, parasolTip[1] + 3.8],
  ]);
  mark(P.deep, [[parasolTip[0] - spread * 0.9, parasolTip[1] + 4.4], [parasolTip[0], parasolTip[1] + 0.4], [parasolTip[0] + spread * 0.9, parasolTip[1] + 4.4]], 0.45);
  mark(P.edge, [[parasolTip[0], parasolTip[1] - 0.6], [parasolTip[0], parasolTip[1] + 1.2]], 0.4);
}

/* ------------------------------------------------------------------ */
/* B. Cherry Reaper — hooded cape, shadowed face, stem whip            */
/* ------------------------------------------------------------------ */

export function drawCherryReaper(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: CharacterArtPose,
): void {
  const P = CHERRY_PALETTE;
  const { stride, swing, tuck, lean, lift } = poseTerms(pose);
  const sx = width / 22;
  const sy = height / 32;
  const { poly, mark, shift } = helpersFor(ctx, sx, sy, lean, lift);

  // Hooded cape stays BEHIND the torso: hip-length, tattered trailing edge,
  // cherry lining only as a thin top sliver.
  const reach = pose.dashing ? 22 : pose.airborne ? 16 : 10 + Math.abs(stride) * 1.8;
  const wave = stride * 0.6;
  poly(P.ink, shift([
    [15, 12], [9, 9], [0 - reach, 6 + wave], [-3 - reach, 10 + wave],
    [-1 - reach, 15 - wave], [2, 19], [6, 22], [9, 20.5], [11, 22.5], [13, 20], [15, 17],
  ]));
  poly(P.accent, shift([[14.5, 11.5], [9.5, 9.5], [1 - reach, 7 + wave], [-2 - reach, 9.8 + wave], [3, 11.5], [10, 12.5]]));
  mark(P.edge, shift([[1 - reach, 7 + wave], [-2 - reach, 11], [0, 17], [5, 21.5]]), 0.5);

  // Boots (thigh-highs) first — the tattered skirt hem overlaps them.
  const hip: Point = [11, 20];
  let rearKnee: Point = [7 - stride * 0.8, 24];
  let rearFoot: Point = [6 - stride * 1.5, 31 - Math.max(0, stride)];
  let frontKnee: Point = [15 + stride * 0.8, 24];
  let frontFoot: Point = [16 + stride * 1.5, 31 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [4, 22]; rearFoot = [0, 27]; frontKnee = [17, 21]; frontFoot = [14, 31]; }
  if (pose.dashing) { rearKnee = [2, 24]; rearFoot = [-2, 29]; frontKnee = [15, 24]; frontFoot = [21, 30]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(P.ink, [[hip[0] - 2.5, hip[1] - 1], [hip[0] + 2.5, hip[1]], [kx + 2, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.5, fy], [fx + 3, fy + 1], [fx - 2, fy + 1], [fx - 2, fy - 2], [kx - 2, ky + 2], [hip[0] - 3.5, hip[1] + 2]]);
    mark(rear ? P.fold : P.edge, [[kx - 2, ky - 1.5], [kx + 2, ky - 1.5]], 0.5);
    mark(rear ? P.fold : P.edge, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
  };
  leg(rearKnee, rearFoot, true);

  // Rear arm holds the coiled stem whip at the hip; on melee it lashes.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 21];
  if (pose.airborne) { rearElbow = [3, 16]; rearHand = [0, 14]; }
  if (pose.dashing) { rearElbow = [1, 16]; rearHand = [-3, 15]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(P.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    mark(rear ? P.fold : P.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
    return [hx, hy] as Point;
  };
  const rearHandPt = arm(rearShoulder, rearElbow, rearHand, true);
  // Whip: coiled at rest (spiral hint), a red arc lash on melee.
  if (swing > 0.05) {
    const tip: Point = [rearHandPt[0] + (26 - rearHandPt[0]) * swing, rearHandPt[1] + (8 - rearHandPt[1]) * swing];
    const mid: Point = [(rearHandPt[0] + tip[0]) / 2, Math.min(rearHandPt[1], tip[1]) - 4.5 * swing];
    mark(P.accent, [rearHandPt, mid, [mid[0] + 2, (mid[1] + tip[1]) / 2], tip], 0.55);
    poly(P.accent, [[tip[0] - 1.4, tip[1] - 1], [tip[0] + 0.4, tip[1] - 1.4], [tip[0] + 0.8, tip[1] + 0.6], [tip[0] - 1, tip[1] + 1]]);
    poly(P.accent, [[tip[0] + 0.2, tip[1] + 0.6], [tip[0] + 2, tip[1] + 0.2], [tip[0] + 1.6, tip[1] + 2.2], [tip[0] + 0.2, tip[1] + 2]]);
    mark(P.stem, [[tip[0], tip[1] - 0.8], [tip[0] + 1, tip[1] + 0.4]], 0.4);
  } else {
    mark(P.accent, [[rearHandPt[0] + 1, rearHandPt[1] + 1], [rearHandPt[0] + 3, rearHandPt[1] + 2], [rearHandPt[0] + 1.6, rearHandPt[1] + 3.2], [rearHandPt[0] + 3.2, rearHandPt[1] + 4]], 0.5);
  }

  // Tattered skirt + fitted bodice.
  const sway = -stride * 0.6;
  poly(P.ink, shift([
    [7, 19], [15, 19], [17.5 + sway, 24], [15.5, 25.5], [13, 24], [11, 25.8],
    [9, 24], [6.5, 25.5], [4.5 - sway, 24],
  ]));
  poly(P.ink, shift([[6.5 + lean, 15 + lift], [15.5 + lean, 15 + lift], [16, 20], [13, 21], [9, 21], [6, 20]]));
  poly(P.fold, shift([[7.5 + lean, 16 + lift], [14.5 + lean, 16 + lift], [14.5, 19.5], [7.5, 19.5]]));
  mark(P.edge, shift([[11, 16.5], [11, 19.5]], 0.4));
  // Cherry clasp on the cape collar.
  poly(P.accent, shift([[10.4, 20.8], [11.4, 20.8], [11.4, 21.8], [10.4, 21.8]]));
  poly(P.accent, shift([[12, 21.2], [13, 21.2], [13, 22.2], [12, 22.2]]));
  mark(P.stem, [[10.9, 20.6], [12.5, 21]], 0.4);

  leg(frontKnee, frontFoot, false);
  const frontShoulder: Point = [15 + lean, 16 + lift];
  let frontElbow: Point = [17 + stride * 0.6, 18];
  let frontHand: Point = [16 + stride, 22];
  if (pose.airborne) { frontElbow = [19, 16]; frontHand = [18, 12]; }
  if (pose.dashing) { frontElbow = [12, 19]; frontHand = [8, 20]; }
  arm(frontShoulder, frontElbow, frontHand, false);

  // Hood: peak swept back, face swallowed in shadow, two cherry eye slits.
  // Choppy red fringe peeks out under the hood rim; one thin sidetail escapes.
  poly(P.ink, shift([[4.5, 12.5], [3, 7], [8, 2], [13, 1.2], [17, 3.5], [18, 8], [17, 12.5], [12, 14.5], [7.5, 14.5]]));
  poly(P.ink, shift([[6.8, 6.5], [11, 5], [15.4, 6.5], [15.8, 11.5], [11, 13], [7, 11.2]]));
  poly(P.accent, shift([[7, 6.2], [11, 5], [15, 6.2], [15, 7.4], [13, 6.2], [11, 7.4], [9, 6.2], [7, 7.4]]));
  // Thin sidetail escaping the hood.
  const tailReach = pose.dashing ? 13 : pose.airborne ? 9 : 6 + Math.abs(stride);
  poly(P.accent, shift([[16, 4.5], [11, 3], [6, 4 + wave], [2 - tailReach, 5.5 + wave], [6, 7], [12, 6.5], [15.5, 6]]));
  mark(P.edge, shift([[3.8, 8], [3.2, 11], [5, 13.5]]), 0.5);
  poly('#ff5d73', shift([[8.6, 8.8], [11.4, 9.8], [11, 11], [9, 10.4]]));
  poly('#ff5d73', shift([[12.8, 9.8], [15.6, 8.8], [15, 10.8], [13.2, 11]]));
}

/* ------------------------------------------------------------------ */
/* C. Cherry Punk — bob with streaks, cropped jacket, knuckle punch     */
/* ------------------------------------------------------------------ */

export function drawCherryPunk(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: CharacterArtPose,
): void {
  const P = CHERRY_PALETTE;
  const { stride, swing, tuck, lean, lift } = poseTerms(pose);
  const sx = width / 22;
  const sy = height / 32;
  const { poly, mark, shift } = helpersFor(ctx, sx, sy, lean, lift);

  // Wind-blown bob: compact mass with rounded, downward-curling tips.
  const reach = pose.dashing ? 10 : pose.airborne ? 7 : 4 + Math.abs(stride) * 1.2;
  const wave = stride * 0.4;
  poly(P.accent, shift([[16, 4], [10, 2], [5, 2.6 + wave], [0.5 - reach, 4.4 + wave], [1, 6.6 + wave], [4.5, 6.4], [11, 6.2], [15.5, 5.6]]));
  poly(P.deep, shift([[15, 3.6], [10, 2.4], [5.5, 3 + wave], [2 - reach, 4.5 + wave], [3, 5.6], [9, 5.4]]));
  // Black streak panel in the bob.
  poly(P.ink, shift([[13, 3], [15.5, 4], [15.8, 7.5], [13.4, 7]]));
  // Cherry hairpin: two dots + stem.
  poly(P.accent, shift([[14, 3.4], [15, 3.4], [15, 4.4], [14, 4.4]]));
  poly(P.accent, shift([[15.4, 3.8], [16.4, 3.8], [16.4, 4.8], [15.4, 4.8]]));
  mark(P.stem, shift([[14.5, 3.2], [15.9, 3.6]], 0), 0.4);

  // Striped stockings + chunky boots.
  const hip: Point = [11, 20];
  let rearKnee: Point = [7 - stride * 0.8, 24];
  let rearFoot: Point = [6 - stride * 1.5, 31 - Math.max(0, stride)];
  let frontKnee: Point = [15 + stride * 0.8, 24];
  let frontFoot: Point = [16 + stride * 1.5, 31 - Math.max(0, -stride)];
  if (pose.airborne) { rearKnee = [4, 22]; rearFoot = [0, 27]; frontKnee = [17, 21]; frontFoot = [14, 31]; }
  if (pose.dashing) { rearKnee = [2, 24]; rearFoot = [-2, 29]; frontKnee = [15, 24]; frontFoot = [21, 30]; }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx, ky] = knee, [fx, fy] = foot;
    poly(P.ink, [[hip[0] - 2.5, hip[1] - 1], [hip[0] + 2.5, hip[1]], [kx + 2, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.5, fy], [fx + 3, fy + 1], [fx - 2, fy + 1], [fx - 2, fy - 2], [kx - 2, ky + 2], [hip[0] - 3.5, hip[1] + 2]]);
    poly(P.fold, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
    mark(rear ? P.fold : P.edge, [[kx - 1.5, ky + 0.5], [kx + 1.5, ky + 1.2]], 0.5);
    mark(rear ? P.fold : P.edge, [[fx - 2, fy - 1.5], [fx + 3, fy - 1.5]], 0.6);
  };
  leg(rearKnee, rearFoot, true);

  // Arms: jacket sleeves; the front fist wears the cherry knuckle.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 21];
  let frontElbow: Point = [17 + stride * 0.6, 18];
  let frontHand: Point = [16 + stride, 22];
  if (pose.airborne) { rearElbow = [3, 16]; rearHand = [0, 14]; frontElbow = [19, 16]; frontHand = [18, 12]; }
  if (pose.dashing) { rearElbow = [1, 16]; rearHand = [-3, 15]; frontElbow = [12, 19]; frontHand = [8, 20]; }
  // Melee: straight knuckle punch past the nose.
  frontElbow = [frontElbow[0] + (21 - frontElbow[0]) * swing, frontElbow[1] + (14 - frontElbow[1]) * swing];
  frontHand = [frontHand[0] + (25 - frontHand[0]) * swing, frontHand[1] + (12 - frontHand[1]) * swing];
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(P.ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(P.fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? P.fold : P.edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Straight pleated skirt (small sway) + cropped jacket over a cherry-print tee.
  const sway = -stride * 0.5;
  poly(P.fold, shift([[6.5, 19], [15.5, 19], [17 + sway, 25], [5 - sway, 25]]));
  mark(P.edge, shift([[8.5, 19.5], [8, 24.5]], 0.35));
  mark(P.edge, shift([[11, 19.5], [11, 24.8]], 0.35));
  mark(P.edge, shift([[13.5, 19.5], [14, 24.5]], 0.35));
  poly(P.ink, shift([[5.5 + lean, 14 + lift], [16.5 + lean, 14 + lift], [16, 19], [6, 19]]));
  // Tee panel with the cherry print.
  poly(P.skin, shift([[8.5 + lean, 15 + lift], [13.5 + lean, 15 + lift], [13.2, 18.6], [8.8, 18.6]]));
  poly(P.accent, shift([[10, 16.8], [10.9, 16.8], [10.9, 17.7], [10, 17.7]]));
  poly(P.accent, shift([[11.5, 17.2], [12.4, 17.2], [12.4, 18.1], [11.5, 18.1]]));
  mark(P.stem, [[10.45, 16.6], [11.95, 17]], 0.35);
  // Cherry-red lapels.
  mark(P.accent, shift([[6 + lean, 14.5 + lift], [8 + lean, 15.5 + lift]], 0.7));
  mark(P.accent, shift([[16 + lean, 14.5 + lift], [14 + lean, 15.5 + lift]], 0.7));
  // Choker + tiny cherry.
  mark(P.accent, shift([[8.8, 14.6], [13.2, 14.6]], 0.6));
  poly(P.accent, shift([[10.6, 15.4], [11.4, 15.4], [11.4, 16.2], [10.6, 16.2]]));

  leg(frontKnee, frontFoot, false);
  arm([15 + lean, 16 + lift], frontElbow, frontHand, false);
  // Cherry knuckle on the punching fist.
  poly(P.accent, [[frontHand[0] + 1, frontHand[1] - 1.5], [frontHand[0] + 2.8, frontHand[1] - 1], [frontHand[0] + 2.4, frontHand[1] + 1], [frontHand[0] + 0.8, frontHand[1] + 0.5]]);

  // Head: pale face, red bob with choppy fringe.
  poly(P.skin, shift([[7.4, 6.5], [11.5, 5], [15.4, 6.5], [15.4, 11], [13, 13.5], [9.4, 13.5], [7.2, 11]]));
  poly(P.accent, shift([[6, 6], [11, 3.2], [16.4, 6], [16.8, 9], [15, 7.2], [12.8, 8.8], [10.6, 7.2], [8.4, 8.8], [6.4, 7.4]]));
  poly(P.deep, shift([[16, 5], [17.6, 6.5], [17.2, 12.5], [15.6, 11.5]]));
  poly(P.deep, shift([[6.2, 5.5], [4.8, 7], [5.2, 12], [6.6, 11]]));
  poly('#ff5d73', shift([[8.8, 9], [11.6, 10.2], [11.2, 11.4], [9.4, 10.8]]));
  poly('#ff5d73', shift([[13.2, 10], [16, 9], [15.4, 11.2], [13.6, 11.2]]));
  mark(P.ink, shift([[9.4, 12.6], [11.8, 13], [13.8, 12.6]]), 0.5);
}

export const CONCEPTS = [
  { id: 'lolita', label: 'A — Midnight Lolita (parasol)', draw: drawCherryLolita },
  { id: 'reaper', label: 'B — Cherry Reaper (whip)', draw: drawCherryReaper },
  { id: 'punk', label: 'C — Cherry Punk (knuckle)', draw: drawCherryPunk },
] as const;

export const POSES: Array<{ label: string; pose: CharacterArtPose }> = [
  { label: 'idle', pose: {} },
  { label: 'run', pose: { stride: 2.4 } },
  { label: 'air', pose: { airborne: true } },
  { label: 'dash', pose: { dashing: true } },
  { label: 'melee', pose: { melee: 0.5 } },
  { label: 'tumble', pose: { airborne: true, tumble: 0.5 } },
];
