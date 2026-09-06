import type { CharacterDef } from "../data/characters";

export interface CharacterArtPose {
  stride?: number;
  airborne?: boolean;
  dashing?: boolean;
  /** Melee swing progress 0..1; >0 while a swing is animating. */
  melee?: number;
  /**
   * Double-jump tumble intensity 0..1 (from Player.airbornePose). 0 = no
   * tumble; the sprite eases a forward half-flip as the value rises.
   */
  tumble?: number;
}

/**
 * Pure tumble-rotation solver for the double-jump flourish. Returns the
 * sprite rotation in radians: 0 at pose 0, a full half flip (PI) at pose 1,
 * mirrored by facing direction so the flip always reads "forward". Purely
 * visual — gameplay physics and the collision box never rotate.
 */
export function resolveTumbleRotation(
  facingRight: number,
  pose: number,
): number {
  const clamped = Math.max(0, Math.min(1, pose));
  // Ease-out: the flip snaps in at the double jump and settles gently
  // upright as the pose decays (reads as a quick tumble, not a spin-down).
  const magnitude = Math.pow(clamped, 1.6) * Math.PI;
  // Normalize -0 (0 magnitude × left-facing sign) so pose 0 is exactly +0.
  return magnitude === 0 ? 0 : magnitude * (facingRight >= 0 ? 1 : -1);
}

export interface TumbleArmPose {
  frontArmDx: number;
  frontArmDy: number;
  rearArmDx: number;
  rearArmDy: number;
}

/**
 * Pure tumble arm offsets (local-space px): arms tuck up and inward at the
 * mid-tumble spin and settle back to the base pose by pose 1 (landing clears
 * the pose, so the settled state is only ever seen for a frame or two).
 * Offsets are integers within ±4px so pixel-art alignment holds.
 */
export function resolveTumbleArms(pose: number): TumbleArmPose {
  const clamped = Math.max(0, Math.min(1, pose));
  // Sine envelope: 0 → 0, peaks 1 at mid-tumble, back to 0 at pose 1.
  const lift = Math.round(Math.sin(clamped * Math.PI) * 3);
  const inward = Math.round(Math.sin(clamped * Math.PI) * 2);
  // `0 - x` instead of `-x` so zero magnitude is +0, never -0.
  return {
    frontArmDx: 0 - inward,
    frontArmDy: 0 - lift,
    rearArmDx: inward,
    rearArmDy: 0 - Math.round(lift * 0.67),
  };
}

/** Y anchor where legs attach: torsoY(15) + torsoH(max(10, h-25)) - 1. */
export function characterLegAnchorY(height: number): number {
  return Math.max(10, height - 25) + 14;
}

/** Arm anchor: 2px below the torso top. Arms are 4px wide. */
const ARM_BASE_Y = 17;

/**
 * Resolved arm geometry for the shared character sprite (local space).
 * Arms are drawn 4px wide, hanging from the torso shoulders.
 */
export interface CharacterArmPose {
  rearArmX: number;
  rearArmY: number;
  rearArmH: number;
  frontArmX: number;
  frontArmY: number;
  frontArmH: number;
}

/**
 * Pure arm-pose solver (micro-animation): arms cross-swing with the run
 * cycle (opposite phase to the legs), raise asymmetrically when airborne,
 * sweep back compressed while dashing, and thrust the front arm up at the
 * melee swing peak. All motion is a few pixels — silhouette stays readable.
 */
export function resolveArmPose(
  width: number,
  height: number,
  pose: CharacterArtPose = {},
): CharacterArmPose {
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const armLen = Math.min(10, Math.max(10, height - 25));

  // Base shoulder positions.
  let rearX = 0;
  let frontX = width - 4;
  let rearY = ARM_BASE_Y;
  let frontY = ARM_BASE_Y;
  let rearH = armLen;
  let frontH = armLen;

  // Run cycle: arms swing opposite the legs.
  rearY -= stride;
  frontY += stride;

  if (pose.airborne) {
    // Both arms lift; front reaches higher (asymmetric jump flourish).
    rearY -= 1;
    frontY -= 3;
    frontH -= 3;
    rearH -= 1;
  } else if (pose.dashing) {
    // Arms stream back: shift toward the rear and compress.
    rearX -= 3;
    frontX -= 5;
    rearH -= 2;
    frontH -= 2;
  }

  // Melee thrust: front arm sweeps up through the swing (sine over progress).
  if (pose.melee && pose.melee > 0) {
    const swing = Math.sin(Math.min(1, pose.melee) * Math.PI);
    frontY -= Math.round(swing * 4);
    frontH -= Math.round(swing * 2);
  }

  // Bounds: arms never rise above the torso top or spill below the hips.
  rearY = Math.max(15, rearY);
  frontY = Math.max(15, frontY);
  rearH = Math.max(3, Math.min(armLen, rearH));
  frontH = Math.max(3, Math.min(armLen, frontH));

  return { rearArmX: rearX, rearArmY: rearY, rearArmH: rearH, frontArmX: frontX, frontArmY: frontY, frontArmH: frontH };
}

/**
 * Resolved head offset for the shared character sprite (local space).
 * Values are small (|offset| <= 1px) so the face stays readable.
 */
export interface CharacterHeadPose {
  offsetX: number;
  offsetY: number;
}

/**
 * Pure head-pose solver (micro-animation): a 1px bob at the stride extremes,
 * a forward lean with a 1px lift when airborne, a crouched forward lean while
 * dashing, and a lean into the melee thrust.
 */
export function resolveHeadPose(
  _width: number,
  pose: CharacterArtPose = {},
): CharacterHeadPose {
  let offsetX = 0;
  let offsetY = 0;

  if (pose.airborne) {
    offsetX = 1;
    offsetY = -1;
  } else if (pose.dashing) {
    offsetX = 1;
    offsetY = 1;
  } else {
    // Bob at the walk-cycle extremes only (legs visibly extended).
    if (Math.abs(pose.stride ?? 0) > 1.2) offsetY = 1;
    if (pose.melee && pose.melee > 0.1) offsetX = 1;
  }

  return { offsetX, offsetY };
}

/**
 * Resolved leg geometry for the shared character sprite. Coordinates are
 * authored in the sprite's local space (origin = top-left of the collision
 * box) and consumed by drawCharacterArt. Legs are 5px wide, boots 8x3.
 */
export interface CharacterLegPose {
  rearLegX: number;
  rearLegY: number;
  rearLegH: number;
  frontLegX: number;
  frontLegY: number;
  frontLegH: number;
  rearBootX: number;
  rearBootY: number;
  frontBootX: number;
  frontBootY: number;
  airborne: boolean;
}

/**
 * Pure leg-pose solver shared by gameplay rendering and tests.
 *
 * Ground: both legs hang from the torso anchor; the walk cycle swaps their
 * lengths via the clamped stride and boots ride the stride along the ground
 * baseline (height - 3).
 *
 * Airborne (previously the `airborne` pose flag was accepted but never
 * consumed — the sprite kept running its walk cycle mid-air): the rear leg
 * tucks up (attaches 2px higher, 6px shorter) while the front leg reaches
 * forward/down (5px longer). Boots track the ends of their legs instead of
 * planting on the ground baseline.
 */
export function resolveLegPose(
  width: number,
  height: number,
  pose: CharacterArtPose = {},
): CharacterLegPose {
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const anchor = characterLegAnchorY(height);
  const baseLen = height - anchor - 2;

  if (pose.airborne) {
    const rearLegY = anchor - 2;
    const rearLegH = baseLen - 6;
    const frontLegY = anchor;
    const frontLegH = baseLen + 5;
    return {
      rearLegX: 5,
      rearLegY,
      rearLegH,
      frontLegX: width - 10,
      frontLegY,
      frontLegH,
      rearBootX: 3,
      rearBootY: rearLegY + rearLegH,
      frontBootX: width - 11,
      frontBootY: frontLegY + frontLegH - 1,
      airborne: true,
    };
  }

  return {
    rearLegX: 5,
    rearLegY: anchor,
    rearLegH: baseLen + stride,
    frontLegX: width - 10,
    frontLegY: anchor,
    frontLegH: baseLen - stride,
    rearBootX: 3,
    rearBootY: height - 3 + Math.max(0, stride),
    frontBootX: width - 11,
    frontBootY: height - 3 + Math.max(0, -stride),
    airborne: false,
  };
}

function rect(
  ctx: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function shade(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const channel = (start: number) =>
    clamp(parseInt(clean.slice(start, start + 2), 16) + amount)
      .toString(16)
      .padStart(2, "0");
  return `#${channel(0)}${channel(2)}${channel(4)}`;
}

function drawSword(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  rect(ctx, "#f8fafc", x, y, 2, 11);
  rect(ctx, "#94a3b8", x + 2, y + 1, 1, 9);
  rect(ctx, "#fbbf24", x - 2, y + 9, 6, 2);
  rect(ctx, "#78350f", x, y + 11, 2, 5);
}

function drawBow(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 8, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.strokeStyle = "#fef3c7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x, y + 8);
  ctx.stroke();
}

/** Ink silhouette uses the same pose solvers as the other runners. No physics changes. */
function drawInkNinja(ctx: CanvasRenderingContext2D, width: number, height: number, pose: CharacterArtPose): void {
  const ink = "#0a0a0f";
  const lime = "#c7ff4d";
  const mid = "#373044";
  const legs = resolveLegPose(width, height, pose);
  const arms = resolveArmPose(width, height, pose);
  const head = resolveHeadPose(width, pose);
  const tuck = resolveTumbleArms(pose.tumble ?? 0);
  const cx = width / 2;
  const hip = characterLegAnchorY(height);
  const ribbon = pose.dashing ? 27 : pose.airborne ? 20 : 13;
  const flutter = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const poly = (color: string, points: number[][], outlined = false) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
    if (outlined) {
      ctx.strokeStyle = lime;
      ctx.lineWidth = .7;
      ctx.stroke();
    }
  };
  // Two brush-cut scarf tails, never alpha-blended into the world.
  poly(lime, [[cx,14],[1,11],[-ribbon,6+flutter],[-ribbon+6,12+flutter],[-ribbon-2,15],[0,14],[cx,18]]);
  poly(lime, [[3,14],[-ribbon+3,19-flutter],[-ribbon+9,20],[-ribbon+1,25-flutter],[5,18]]);
  // Katana on back; fixed geometry follows the body/tumble transform.
  poly('#f4f2ed', [[2,25],[width-2,6],[width,7],[5,28]]);
  poly(mid, [[1,25],[4,24],[7,28],[4,30]]);
  for (const [x,y,h,bx,by] of [
    [legs.rearLegX,legs.rearLegY,legs.rearLegH,legs.rearBootX,legs.rearBootY],
    [legs.frontLegX,legs.frontLegY,legs.frontLegH,legs.frontBootX,legs.frontBootY],
  ]) {
    poly(ink, [[cx,hip-2],[x+5,y],[x+5,y+h],[bx+8,by+1],[bx+8,by+3],[bx,by+3],[x,y+h-2],[x,y]], true);
    poly(mid, [[x+1,y+2],[x+4,y+3],[x+3,y+h-1],[x+1,y+h-2]]);
  }
  poly(ink, [[4,16],[cx,13],[width-4,16],[width-5,hip],[cx,hip+2],[4,hip]], true);
  poly(mid, [[5,17],[cx,16],[width-6,19],[cx-1,hip-1],[5,hip-3]]);
  poly(lime, [[4,hip-4],[width-5,hip-6],[width-4,hip-3],[4,hip-1]]);
  for (const [x,y,h] of [
    [arms.rearArmX+tuck.rearArmDx, arms.rearArmY+tuck.rearArmDy, arms.rearArmH],
    [arms.frontArmX+tuck.frontArmDx, arms.frontArmY+tuck.frontArmDy, arms.frontArmH],
  ]) {
    poly(ink, [[x+3,y-1],[x+5,y+3],[x+3,y+h],[x-1,y+h+1],[x-2,y+h-3],[x,y+1]], true);
    poly(mid, [[x,y+3],[x+3,y+4],[x+2,y+7],[x-1,y+6]]);
  }
  const hx = head.offsetX;
  const hy = head.offsetY;
  // Crown-like spikes, sloped mask and two sharp eyes replace the square head.
  poly(ink, [[3+hx,5+hy],[2+hx,-3+hy],[8+hx,1+hy],[11+hx,-5+hy],[15+hx,1+hy],[22+hx,-2+hy],[20+hx,5+hy],[width-2+hx,8+hy],[width-4+hx,14+hy],[cx+hx,16+hy],[5+hx,12+hy]], true);
  poly(mid, [[4+hx,5+hy],[cx+hx,8+hy],[width-3+hx,6+hy],[width-5+hx,12+hy],[cx+hx,13+hy]]);
  poly(lime, [[7+hx,8+hy],[12+hx,10+hy],[11+hx,12+hy],[8+hx,11+hy]]);
  poly(lime, [[15+hx,10+hy],[21+hx,7+hy],[19+hx,11+hy],[15+hx,12+hy]]);
}

/** Armored ink silhouette. Same pose solvers and collision dimensions as before. */
function drawInkKnight(ctx: CanvasRenderingContext2D, w: number, h: number, pose: CharacterArtPose) {
  const legs = resolveLegPose(w, h, pose);
  const arms = resolveArmPose(w, h, pose);
  const head = resolveHeadPose(w, pose);
  const hip = characterLegAnchorY(h);
  const poly = (fill: string, points: number[][], rim = "#b885d7") => {
    ctx.fillStyle = fill; ctx.strokeStyle = rim; ctx.lineWidth = 0.8;
    ctx.beginPath(); points.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y));
    ctx.closePath(); ctx.fill(); ctx.stroke();
  };
  const reach = pose.dashing ? 35 : pose.airborne ? 23 : 14;
  const flutter = pose.stride ?? 0;
  poly("#754294", [[6,12],[-reach,14+flutter],[-reach+8,20],[-reach-3,28-flutter],[3,h-1],[9,20]], "#09080f");
  for (const [x,y,len,bx,by] of [
    [legs.rearLegX,legs.rearLegY,legs.rearLegH,legs.rearBootX,legs.rearBootY],
    [legs.frontLegX,legs.frontLegY,legs.frontLegH,legs.frontBootX,legs.frontBootY],
  ]) poly("#09080f", [[x,y],[x+5,y],[x+5,y+len],[bx+8,by],[bx+8,by+3],[bx,by+3],[x,y+len]]);
  poly("#09080f", [[3,15],[w/2,12],[w-3,15],[w-4,hip],[w/2,hip+2],[4,hip]]);
  poly("#44205f", [[5,16],[w/2,15],[w-5,17],[w/2,hip-2],[5,hip-3]], "#44205f");
  for(const [x,y,len] of [[arms.rearArmX,arms.rearArmY,arms.rearArmH],[arms.frontArmX,arms.frontArmY,arms.frontArmH]])
    poly("#09080f", [[x-1,y],[x+4,y-1],[x+6,y+4],[x+3,y+len],[x,y+len]]);
  const hx=head.offsetX; const hy=head.offsetY;
  poly("#09080f", [[3+hx,4+hy],[w/2+hx,1+hy],[w-3+hx,5+hy],[w-4+hx,14+hy],[w/2+hx,17+hy],[4+hx,13+hy]], "#c7ff4d");
  poly("#44205f", [[5+hx,5+hy],[w/2+hx,3+hy],[w/2+hx,7+hy],[5+hx,8+hy]], "#44205f");
  ctx.fillStyle="#c7ff4d";ctx.fillRect(6+hx,9+hy,w-12,2);ctx.fillRect(w/2-1,18,2,6);ctx.fillRect(w/2-4,20,8,2);
  // Shoulder-driven sword; exaggerated silhouette, unchanged melee hitbox.
  const sx=arms.frontArmX+5, sy=arms.frontArmY;
  poly("#f4f2ed", [[sx,sy-8],[sx+2,sy-12],[sx+4,sy-8],[sx+3,sy+7],[sx,sy+7]], "#09080f");
  ctx.fillStyle="#c7ff4d";ctx.fillRect(sx-3,sy+5,9,2);
}

/**
 * Shared procedural character art for menu previews and live gameplay.
 * Coordinates are authored against each character's collision box, so the
 * visual silhouette remains aligned with physics while still reading clearly.
 */
export function drawCharacterArt(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  width: number,
  height: number,
  pose: CharacterArtPose = {},
): void {
  const stride = Math.max(-2.5, Math.min(2.5, pose.stride ?? 0));
  const dark = shade(char.outlineColor, -24);
  const light = shade(char.bodyColor, 28);
  const center = width / 2;
  const headW = Math.max(13, width - 8);
  const head = resolveHeadPose(width, pose);
  // Double-jump tumble: pure solver → eased rotation + tucked arms. Purely
  // visual — the collision box and gameplay physics stay unrotated.
  const tumblePose = Math.max(0, Math.min(1, pose.tumble ?? 0));
  const tumbleArms = resolveTumbleArms(tumblePose);
  const headX = center - headW / 2 + head.offsetX;
  const headY = 4 + head.offsetY;
  const torsoY = 15;
  const torsoH = Math.max(10, height - 25);
  const legY = torsoY + torsoH - 1;
  const skin = char.id === "ninja" ? "#1f2937" : "#f1c9a5";

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.lineJoin = "miter";

  // Tumble rotation wraps ALL sprite geometry (around the sprite center).
  // pose=0 keeps the transform exactly identity, so grounded/single-jump
  // rendering is bit-identical to the pre-tumble art.
  if (tumblePose > 0) {
    const rotation = resolveTumbleRotation(1, tumblePose);
    ctx.translate(width / 2, height / 2);
    ctx.rotate(rotation);
    ctx.translate(-width / 2, -height / 2);
  }

  if (char.id === "ninja") {
    drawInkNinja(ctx, width, height, pose);
    ctx.restore();
    return;
  }

  if (char.id === "knight") {
    drawInkKnight(ctx, width, height, pose);
    ctx.restore();
    return;
  }

  if (pose.dashing) {
    rect(ctx, "rgba(125,211,252,0.22)", -10, 8, 8, height - 12);
    rect(ctx, "rgba(125,211,252,0.38)", -5, 12, 5, height - 20);
  }

  // Rear accessories establish direction without turning every face into a snout.
  if (char.id === "ninja") {
    rect(ctx, "#dc2626", -7, 10, 10, 3);
    rect(ctx, "#991b1b", -11, 12, 9, 2);
  } else if (char.id === "knight") {
    ctx.fillStyle = "#b91c1c";
    ctx.beginPath();
    ctx.moveTo(4, 15);
    ctx.lineTo(-5, 19);
    ctx.lineTo(3, height - 5);
    ctx.closePath();
    ctx.fill();
  } else if (char.id === "ranger") {
    rect(ctx, "#713f12", 0, 13, 4, height - 16);
  } else if (char.id === "mage") {
    ctx.fillStyle = "#4c1d95";
    ctx.beginPath();
    ctx.moveTo(center, -2);
    ctx.lineTo(1, 12);
    ctx.lineTo(width - 1, 12);
    ctx.closePath();
    ctx.fill();
    rect(ctx, "#fde68a", center + 2, 3, 2, 2);
  }

  // Legs and planted boots. Spirit uses a tapered spectral tail instead.
  if (char.id === "spirit") {
    ctx.fillStyle = "rgba(221,214,254,0.72)";
    ctx.beginPath();
    ctx.moveTo(4, legY - 2);
    ctx.lineTo(width - 4, legY - 2);
    ctx.lineTo(center + 3, height + 1);
    ctx.lineTo(center - 2, height - 3);
    ctx.closePath();
    ctx.fill();
  } else {
    const legs = resolveLegPose(width, height, { stride, airborne: pose.airborne });
    rect(ctx, dark, legs.rearLegX, legs.rearLegY, 5, legs.rearLegH);
    rect(ctx, dark, legs.frontLegX, legs.frontLegY, 5, legs.frontLegH);
    rect(ctx, "#0f172a", legs.rearBootX, legs.rearBootY, 8, 3);
    rect(ctx, "#0f172a", legs.frontBootX, legs.frontBootY, 8, 3);
  }

  // Torso, then solver-driven arms (cross-swing / raise / trail / thrust).
  // Drawn after the torso so raised arms overlap the chest, not the reverse.
  rect(ctx, dark, 2, torsoY + 1, width - 4, torsoH);
  rect(ctx, char.bodyColor, 4, torsoY, width - 8, torsoH - 1);
  rect(ctx, light, 5, torsoY + 1, Math.max(4, width - 13), 3);
  const arms = resolveArmPose(width, height, pose);
  rect(
    ctx,
    dark,
    arms.rearArmX + tumbleArms.rearArmDx,
    arms.rearArmY + tumbleArms.rearArmDy,
    4,
    arms.rearArmH,
  );
  rect(
    ctx,
    dark,
    arms.frontArmX + tumbleArms.frontArmDx,
    arms.frontArmY + tumbleArms.frontArmDy,
    4,
    arms.frontArmH,
  );

  if (char.id === "tank") {
    rect(ctx, "#cbd5e1", 2, torsoY, width - 4, 4);
    rect(ctx, "#475569", -2, torsoY + 2, 6, 9);
    rect(ctx, "#475569", width - 4, torsoY + 2, 6, 9);
  } else if (char.id === "cyborg") {
    rect(ctx, "#0f172a", 4, torsoY + 3, width - 8, 3);
    rect(ctx, "#22d3ee", 6, torsoY + 4, width - 12, 1);
    rect(ctx, "#22d3ee", center - 2, torsoY + 8, 4, 4);
  } else if (char.id === "healer") {
    rect(ctx, "#ccfbf1", center - 1, torsoY + 2, 2, torsoH - 5);
    rect(ctx, "#ccfbf1", center - 5, torsoY + 6, 10, 2);
  } else if (char.id === "ranger") {
    rect(ctx, "#84cc16", 4, torsoY + 2, width - 8, 2);
    drawBow(
      ctx,
      arms.frontArmX + 5 + tumbleArms.frontArmDx,
      arms.frontArmY + 3 + tumbleArms.frontArmDy,
    );
  } else if (char.id === "knight") {
    rect(ctx, "#fbbf24", center - 1, torsoY + 3, 2, torsoH - 4);
    drawSword(
      ctx,
      arms.frontArmX + 5 + tumbleArms.frontArmDx,
      arms.frontArmY - 1 + tumbleArms.frontArmDy,
    );
  } else if (char.id === "ninja") {
    rect(ctx, "#111827", 4, torsoY, width - 8, torsoH - 1);
    rect(ctx, "#dc2626", 4, torsoY + 5, width - 8, 2);
  } else if (char.id === "mage") {
    rect(ctx, "#c084fc", center - 2, torsoY + 4, 4, 4);
  } else if (char.id === "spirit") {
    rect(ctx, "#ddd6fe", 5, torsoY + 2, width - 10, 2);
  }

  // Head base and one clearly forward-looking face.
  rect(ctx, dark, headX - 1, headY - 1, headW + 2, 12);
  rect(ctx, skin, headX, headY, headW, 10);

  if (char.id === "knight" || char.id === "tank") {
    rect(ctx, "#cbd5e1", headX - 1, headY - 2, headW + 2, 8);
    rect(ctx, "#475569", headX + 1, headY + 5, headW - 2, 4);
    rect(ctx, char.eyeColor, headX + headW - 5, headY + 6, 3, 2);
    if (char.id === "knight") {
      rect(ctx, "#fbbf24", center - 1, 0, 2, 4);
    }
  } else if (char.id === "cyborg") {
    rect(ctx, "#64748b", headX, headY, headW, 10);
    rect(ctx, "#0f172a", headX + 1, headY + 4, headW - 2, 4);
    rect(ctx, "#22d3ee", headX + headW - 6, headY + 5, 4, 2);
  } else if (char.id === "ninja") {
    rect(ctx, "#111827", headX, headY - 1, headW, 11);
    rect(ctx, "#334155", headX + 2, headY + 4, headW - 4, 4);
    rect(ctx, "#fde047", headX + headW - 6, headY + 5, 3, 2);
  } else if (char.id === "ranger") {
    rect(ctx, "#14532d", headX - 1, headY - 2, headW + 2, 5);
    rect(ctx, "#65a30d", headX - 3, headY + 1, headW + 6, 2);
    rect(ctx, "#172554", headX + headW - 5, headY + 4, 2, 2);
  } else if (char.id === "mage") {
    rect(ctx, "#312e81", headX - 1, headY - 1, headW + 2, 5);
    rect(ctx, "#fef08a", headX + headW - 5, headY + 4, 2, 2);
  } else if (char.id === "spirit") {
    rect(ctx, "#ede9fe", headX, headY, headW, 10);
    rect(ctx, "#7c3aed", headX + headW - 6, headY + 4, 3, 3);
    rect(ctx, "rgba(167,139,250,0.55)", headX - 2, headY + 9, headW + 4, 3);
  } else {
    rect(ctx, "#ccfbf1", headX - 1, headY - 2, headW + 2, 5);
    rect(ctx, "#0f766e", center - 1, headY - 3, 2, 5);
    rect(ctx, "#0f766e", center - 3, headY - 1, 6, 2);
    rect(ctx, "#134e4a", headX + headW - 5, headY + 4, 2, 2);
  }

  // Ink contour pass — the graphic-novel signature. A 1px near-black
  // silhouette outline around the full sprite keeps the character readable
  // over dark terrain and midground ridges at any biome/time-of-day.
  ctx.strokeStyle = "#0a0a0f";
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.9;
  ctx.strokeRect(0.5, 1.5, width - 1, height - 3);
  // Lime underglow accent ties the hero to the interaction palette without
  // a per-frame bloom: a static hairline at the boot line, ink-bordered
  // white so it stays visible even when standing on the lime ground cap
  // (lime-on-lime would vanish).
  ctx.strokeStyle = "#f4f2ed";
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(1, height - 0.5);
  ctx.lineTo(width - 1, height - 0.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.restore();
}
