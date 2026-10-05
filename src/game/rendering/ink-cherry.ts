import type { CharacterArtPose } from './character-art';

type Point = readonly [number, number];

/**
 * Inked anatomy authored at Cherry's real 22×32 collision size. Cherry-goth
 * DNA: deep cherry-red twin-tails, near-black gothic lolita dress, pale skin,
 * and the accent budget spent on hair, eyes, the collar charm, and her
 * closed parasol. Same drawing-only contract as the ninja: local joints never
 * write back to Player/physics, filled bent limbs, no closed neon contours.
 */
export function drawInkCherry(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: CharacterArtPose,
): void {
  const ink = '#141019';
  const fold = '#3a2c42';
  const edge = '#a78bb0';
  const cherry = '#e5304a';
  const deep = '#8e1226';
  const stem = '#5a8f5a';
  const skin = '#f2e2da';
  const sx = width / 22;
  const sy = height / 32;
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
  const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
  const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * .35;
  const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * .2;

  const poly = (color: string, points: readonly Point[]) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy));
    ctx.closePath(); ctx.fill();
  };
  const mark = (color: string, points: readonly Point[], weight = .55) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = weight * Math.min(sx, sy);
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy));
    ctx.stroke();
  };
  const shift = (points: readonly Point[], x = lean, y = lift): Point[] =>
    points.map(([px, py]) => [px + x, py + y]);

  // Twin-tails: two distinct ribbon locks streaming back and drooping with
  // the wind, each tapering to a point. Reach is bounded so the sprite never
  // collapses into a flag; the locks phase against each other via the wave.
  const reach = pose.dashing ? 17 : pose.airborne ? 12 : 8 + Math.abs(stride) * 1.6;
  const wave = stride * .5;
  poly(cherry, shift([[14.5, 4.5], [10, 3.5], [5, 4.5 + wave], [-0.5 - reach, 6 + wave], [3, 6.8], [9, 6.2], [14, 5.6]]));
  poly(deep, shift([[14, 4.9], [9, 4], [4.5, 4.9 + wave], [0, 6 + wave], [3.5, 6.3], [9, 5.7]]));
  poly(cherry, shift([[14, 7.5], [9, 6.8], [4, 8 - wave], [-1 - reach, 10.5 - wave], [2.5, 11.2], [8.5, 9.6], [13.6, 8.8]]));
  poly(deep, shift([[13.6, 7.8], [8.5, 7.2], [4, 8.4 - wave], [-0.5 - reach, 10.3 - wave], [3, 10.4], [8.5, 9.2]]));
  // Stem bows tying the locks.
  mark(stem, shift([[14.2, 3.9], [15.4, 2.6], [16.2, 1.4]], 0), .5);
  mark(stem, shift([[13.6, 7.1], [14.8, 5.9], [15.8, 4.9]], 0), .5);

  // Bent-limb legs in dark stockings; Mary-Jane boots with a strap line.
  const hip: Point = [11, 20];
  let rearKnee: Point = [7 - stride * .8, 24];
  let rearFoot: Point = [6 - stride * 1.5, 31 - Math.max(0, stride)];
  let frontKnee: Point = [15 + stride * .8, 24];
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
    poly(ink, [[hip[0] - 2.5, hip[1] - 1], [hip[0] + 2.5, hip[1]], [kx + 2, ky - 1], [fx + 1.5, fy - 2],
      [fx + 3.5, fy], [fx + 3, fy + 1], [fx - 2, fy + 1], [fx - 2, fy - 2], [kx - 2, ky + 2], [hip[0] - 3.5, hip[1] + 2]]);
    poly(fold, [[hip[0] - 1, hip[1] + 1], [kx + 1, ky], [fx, fy - 2], [kx - 1, ky + 1]]);
    mark(rear ? fold : edge, [[hip[0] + 1.5, hip[1] + 1], [kx + 2, ky], [fx + 1.5, fy - 2]]);
    mark(edge, [[fx - 2, fy - 1.5], [fx + 3, fy - 1.5]], .5);
  };
  leg(rearKnee, rearFoot, true);

  // Rear arm stays behind the bodice. Melee bends the front elbow into the
  // swing; tumble tucks both fists toward the shoulders.
  const rearShoulder: Point = [8 + lean, 15 + lift];
  let rearElbow: Point = [4 - stride, 18];
  let rearHand: Point = [4 - stride * 1.3, 21];
  let frontElbow: Point = [17 + stride * .6, 18];
  let frontHand: Point = [16 + stride, 22];
  if (pose.airborne) { rearElbow = [3, 16]; rearHand = [0, 14]; frontElbow = [19, 16]; frontHand = [18, 12]; }
  if (pose.dashing) { rearElbow = [1, 16]; rearHand = [-3, 15]; frontElbow = [12, 19]; frontHand = [8, 20]; }
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax, ay] = shoulder, [ex, ey] = elbow;
    const hx = hand[0] + (rear ? 1.5 : -1.5) * tuck, hy = hand[1] - 2.5 * tuck;
    poly(ink, [[ax - 1.8, ay - 1], [ax + 1.8, ay], [ex + 1.8, ey - 1], [hx + 1.5, hy - 1], [hx + 1.5, hy + 1.5],
      [hx - 1, hy + 2], [hx - 2.5, hy], [ex - 1.8, ey + 1.5], [ax - 2.5, ay + 1.5]]);
    poly(fold, [[ax - 0.8, ay + 0.8], [ex + 0.8, ey], [hx, hy], [ex - 0.8, ey + 0.8]]);
    mark(rear ? fold : edge, [[ax + 0.8, ay], [ex + 1.8, ey], [hx + 0.8, hy]]);
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Scalloped bell skirt: the hem sways against the run, flares airborne, and
  // a cherry-red underskirt sliver peeks between the hem scallops.
  const sway = -stride * .8;
  const flare = pose.airborne ? 2 : 0;
  poly(cherry, shift([
    [3 - sway - flare, 26 + flare * .5], [7, 28.2 + flare * .4], [11, 26.6 + flare * .5],
    [15, 28.2 + flare * .4], [19 + sway + flare, 26 + flare * .5],
    [19 + sway + flare, 24.5], [3 - sway - flare, 24.5],
  ]));
  poly(ink, shift([
    [7, 19], [15, 19], [18.5 + sway + flare, 25 + flare * .5],
    [15, 26.8 + flare * .4], [11, 25.2 + flare * .5], [7, 26.8 + flare * .4],
    [3.5 - sway - flare, 25 + flare * .5],
  ]));
  mark(edge, shift([[3.5 - sway - flare, 25], [7, 26.6], [11, 25], [15, 26.6], [18.5 + sway + flare, 25]]), .45);

  // Fitted bodice with corset lacing.
  poly(ink, shift([[6.5 + lean, 15 + lift], [15.5 + lean, 15 + lift], [16, 20], [13, 21.5], [9, 21.5], [6, 20]]));
  poly(fold, shift([[7.5 + lean, 16 + lift], [14.5 + lean, 16 + lift], [14.5, 19.5], [7.5, 19.5]]));
  mark(edge, shift([[9, 16.5], [9, 19.5]]), .4);
  mark(edge, shift([[13, 16.5], [13, 19.5]]), .4);
  mark(edge, shift([[9, 17], [13, 18.5]]), .35);
  mark(edge, shift([[9, 18.5], [13, 17]]), .35);

  // Cherry charm at the collar: two fruit + a green stem.
  poly(cherry, shift([[10.2, 21.5], [11.2, 21.5], [11.2, 22.5], [10.2, 22.5]]));
  poly(cherry, shift([[11.8, 22], [12.8, 22], [12.8, 23], [11.8, 23]]));
  mark(stem, shift([[10.7, 21.3], [12.3, 21.8]], 0), .45);

  leg(frontKnee, frontFoot, false);
  arm([15 + lean, 16 + lift], frontElbow, frontHand, false);

  // Head: pale gothic face under blunt bangs with a zigzag hem (broken
  // contour), side locks framing the cheeks, cherry-red angular eyes.
  poly(skin, shift([[7, 6], [11, 4.2], [15, 6], [15.4, 11], [13, 13.8], [9, 13.8], [6.6, 11]]));
  poly(cherry, shift([[5.8, 4.5], [11, 2.2], [16.2, 4.5], [16.2, 7], [14.6, 5.4], [12.6, 7], [10.6, 5.4], [8.6, 7], [6.6, 5.4], [5.8, 7]]));
  poly(deep, shift([[5, 5], [6.6, 6], [6.2, 13], [4.6, 11.5]]));
  poly(cherry, shift([[16.2, 5], [17.6, 6], [17.9, 12], [16.3, 12.6]]));
  poly('#ff5d73', shift([[8.4, 8.4], [11.2, 9.6], [10.8, 10.8], [9.2, 10.2]]));
  poly('#ff5d73', shift([[13, 9.4], [16.2, 8.2], [15.6, 10.6], [13.4, 10.6]]));
  mark(ink, shift([[9, 12.2], [11.5, 12.7], [13.5, 12.2]]), .5);

  // Parasol, drawn LAST so nothing occludes it: the closed cherry-red canopy
  // rides up-forward on her shoulder, clear of the streaming hair. Melee
  // sweeps an overhead bonk arc; dash trails it low behind; airborne tilts it.
  let parasolHand: Point = [16 + stride * .6 + lean, 20 + lift];
  let parasolTip: Point = [21.5, 3.5 + lift * .5];
  if (pose.dashing) { parasolHand = [8 + lean, 20]; parasolTip = [2, 15]; }
  if (pose.airborne) parasolTip = [20.5, 2 + lift];
  parasolHand = [parasolHand[0] + (20 - parasolHand[0]) * swing, parasolHand[1] + (12.5 - parasolHand[1]) * swing];
  parasolTip = [parasolTip[0] + (27 - parasolTip[0]) * swing, parasolTip[1] + (6 - parasolTip[1]) * swing];
  mark(ink, [parasolHand, [(parasolHand[0] + parasolTip[0]) / 2, (parasolHand[1] + parasolTip[1]) / 2 - .8], parasolTip], .9);
  mark(edge, [[parasolHand[0] + .3, parasolHand[1] - .3], [parasolTip[0] * .5 + parasolHand[0] * .5, parasolTip[1] * .5 + parasolHand[1] * .5 - 1]], .3);
  mark(edge, [[parasolHand[0] - 1.2, parasolHand[1] + 2], [parasolHand[0], parasolHand[1] + .8]], .6);
  const spread = 2.2 + swing * 1.8;
  poly(cherry, [
    [parasolTip[0] - spread, parasolTip[1] + 5],
    [parasolTip[0] - spread * .55, parasolTip[1] + 1],
    [parasolTip[0], parasolTip[1] - .6],
    [parasolTip[0] + spread * .55, parasolTip[1] + 1],
    [parasolTip[0] + spread, parasolTip[1] + 5],
    [parasolTip[0] + spread * .5, parasolTip[1] + 3.8],
    [parasolTip[0], parasolTip[1] + 5.4],
    [parasolTip[0] - spread * .5, parasolTip[1] + 3.8],
  ]);
  mark(deep, [[parasolTip[0] - spread * .9, parasolTip[1] + 4.4], [parasolTip[0], parasolTip[1] + .4], [parasolTip[0] + spread * .9, parasolTip[1] + 4.4]], .45);
  mark(edge, [[parasolTip[0], parasolTip[1] - .6], [parasolTip[0], parasolTip[1] + 1.2]], .4);
}
