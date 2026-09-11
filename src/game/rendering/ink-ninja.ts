import type { CharacterArtPose } from './character-art';

type Point = readonly [number, number];

/**
 * Inked anatomy authored at the Ninja's real 20×30 collision size. Only the
 * drawing changes: local joints never write back to Player/physics. Use filled
 * bent limbs and selective edge-light, not a closed neon wire around each part.
 */
export function drawInkNinja(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pose: CharacterArtPose,
): void {
  const ink = '#0a0a0f';
  const fold = '#373044';
  const edge = '#8e799e';
  const lime = '#c7ff4d';
  const sx = width / 20;
  const sy = height / 30;
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const swing = Math.sin(Math.max(0, Math.min(1, pose.melee ?? 0)) * Math.PI);
  const tuck = Math.sin(Math.max(0, Math.min(1, pose.tumble ?? 0)) * Math.PI);
  const lean = pose.dashing ? 3 : pose.airborne ? 1.5 : swing * 1.5 + Math.abs(stride) * .35;
  const lift = pose.airborne ? -1 : pose.dashing ? 1 : Math.abs(stride) * .2;

  const path = (points: readonly Point[]) => {
    ctx.beginPath();
    points.forEach(([x, y], i) => i ? ctx.lineTo(x * sx, y * sy) : ctx.moveTo(x * sx, y * sy));
  };
  const poly = (color: string, points: readonly Point[]) => {
    ctx.fillStyle = color;
    path(points); ctx.closePath(); ctx.fill();
  };
  const mark = (color: string, points: readonly Point[], weight = .55) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = weight * Math.min(sx, sy);
    path(points); ctx.stroke();
  };
  const shift = (points: readonly Point[], x = lean, y = lift): Point[] =>
    points.map(([px, py]) => [px + x, py + y]);

  // Sparse broken scarf: two asymmetrical blades, not a bright solid flag.
  const reach = pose.dashing ? 23 : pose.airborne ? 17 : 11 + Math.abs(stride) * 2;
  const wave = stride * .6;
  poly(ink, shift([[8,9],[1,7],[-reach,3+wave],[-reach+4,7],[-reach-2,10],[1,11],[9,12]]));
  poly(lime, shift([[7,9],[0,8],[-reach,4+wave],[-reach+5,8],[-reach-1,9],[1,10],[7,11]]));
  poly(lime, shift([[3,10],[-reach+6,12-wave],[-reach+10,13],[-reach+2,16-wave],[2,12],[6,11]]));
  mark(ink, shift([[-reach+7,7+wave],[-2,9],[3,9]]), .7);

  const hip: Point = [10,18];
  let rearKnee: Point = [5-stride*.8,23];
  let rearFoot: Point = [4-stride*1.5,29-Math.max(0,stride)];
  let frontKnee: Point = [14+stride*.8,23];
  let frontFoot: Point = [15+stride*1.5,29-Math.max(0,-stride)];
  if (pose.airborne) {
    rearKnee = [3,21]; rearFoot = [-1,25];
    frontKnee = [17,20]; frontFoot = [13,29];
  }
  if (pose.dashing) {
    rearKnee = [1,23]; rearFoot = [-3,27];
    frontKnee = [15,23]; frontFoot = [20,28];
  }
  const leg = (knee: Point, foot: Point, rear: boolean) => {
    const [kx,ky] = knee, [fx,fy] = foot;
    poly(ink, [[hip[0]-3,hip[1]-1],[hip[0]+3,hip[1]],[kx+2.5,ky-1],[fx+1.5,fy-2],
      [fx+4,fy],[fx+3.5,fy+1],[fx-2,fy+1],[fx-2,fy-2],[kx-2.5,ky+2],[hip[0]-4,hip[1]+2]]);
    poly(fold, [[hip[0]-1,hip[1]+1],[kx+1,ky],[fx,fy-2],[kx-1,ky+1]]);
    mark(rear ? fold : edge, [[hip[0]+2,hip[1]+1],[kx+2.5,ky],[fx+1.5,fy-2]]);
    // Two broad cloth cuts, not noisy micro-hatching that vanishes at 1×.
    mark(edge, [[kx-1.5,ky],[kx+.5,ky+.7]], .45);
  };
  leg(rearKnee, rearFoot, true);

  // Rear arm remains behind the torso. Melee and dash bend the elbows, not
  // merely shorten a rectangular sleeve. Tumble tucks fists toward shoulders.
  const rearShoulder: Point = [7+lean,11+lift];
  let rearElbow: Point = [3-stride,15];
  let rearHand: Point = [3-stride*1.3,18];
  let frontElbow: Point = [18+stride*.6,15];
  let frontHand: Point = [17+stride,19];
  if (pose.airborne) { rearElbow = [2,13]; rearHand = [-1,11]; frontElbow = [20,13]; frontHand = [18,9]; }
  if (pose.dashing) { rearElbow = [0,13]; rearHand = [-4,12]; frontElbow = [11,16]; frontHand = [6,17]; }
  // Layer the weapon thrust over locomotion so a mid-air/dash attack never
  // collapses to the plain jump/dash silhouette.
  frontElbow = [frontElbow[0] + (21-frontElbow[0])*swing, frontElbow[1] + (11-frontElbow[1])*swing];
  frontHand = [frontHand[0] + (23-frontHand[0])*swing, frontHand[1] + (7-frontHand[1])*swing];
  const arm = (shoulder: Point, elbow: Point, hand: Point, rear: boolean) => {
    const [ax,ay] = shoulder, [ex,ey] = elbow;
    const hx = hand[0] + (rear ? 2 : -2)*tuck, hy = hand[1]-3*tuck;
    poly(ink, [[ax-2,ay-1],[ax+2,ay],[ex+2,ey-1],[hx+2,hy-1],[hx+2,hy+2],
      [hx-1,hy+3],[hx-3,hy],[ex-2,ey+2],[ax-3,ay+2]]);
    poly(fold, [[ax-1,ay+1],[ex+1,ey],[hx,hy],[ex-1,ey+1]]);
    mark(rear ? fold : edge, [[ax+1,ay],[ex+2,ey],[hx+1,hy]]);
    mark(edge, [[hx-1,hy],[hx+1,hy+1]], .6);
  };
  arm(rearShoulder, rearElbow, rearHand, true);

  // Torso tapers into a low belt, leaving room for actual thigh/shin lengths.
  poly(ink, [[5+lean,11+lift],[11+lean,9+lift],[16+lean,12+lift],[14,17],[13,20],[7,20],[5,16]]);
  poly(fold, [[6+lean,12+lift],[12+lean,11+lift],[13+lean,13],[9,17],[7,17]]);
  mark(edge, [[6+lean,11+lift],[10+lean,10+lift],[12+lean,10.5+lift]]);
  mark(edge, [[13,15],[9,17],[12,17.5]], .45);
  poly(fold, [[6,18],[14,17.5],[14,19],[6,20]]);
  poly(ink, [[7,18.5],[10,18],[10,19.5],[8,20.5]]);
  leg(frontKnee, frontFoot, false);
  arm([14+lean,12+lift], frontElbow, frontHand, false);

  // Scabbard is a muted slash behind the shoulder, not a bright white cross.
  poly(fold, [[3,19],[15+lean,7+lift],[16+lean,8+lift],[5,21]]);
  mark(edge, [[4,19],[14+lean,9+lift]], .4);

  // Directional asymmetric hair tufts: a swept silhouette, never a crown.
  poly(ink, shift([[5,4],[3,0],[6,1],[5,-3],[9,0],[10,-4],[12,-1],[15,-3],[15,0],
    [19,-2],[17,2],[20,1],[17,5],[17,8],[13,11],[9,10],[6,7]]));
  mark(edge, shift([[5,0],[6,-2],[9,1],[10,-3],[12,0],[15,-2]]), .55);
  mark(edge, shift([[19,-1],[17,2],[19,2]]), .5);
  poly(fold, shift([[7,5],[11,6.5],[17,4],[16,7],[12,9],[8,8]]));
  // Slanted narrow eyes and scarf collar carry the accent budget.
  poly(lime, shift([[8,5.5],[11.5,6.8],[11,8],[9,7.5]]));
  poly(lime, shift([[13,6.5],[17,4.8],[16,7],[13,8]]));
  poly(lime, shift([[6,9],[10,10.5],[16,8.5],[14,11],[9,12],[5,10.5]]));
  mark(ink, shift([[8,10.5],[11,11],[14,10]]), .65);
}
