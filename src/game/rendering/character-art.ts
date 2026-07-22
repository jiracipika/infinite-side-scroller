import type { CharacterDef } from "../data/characters";

export interface CharacterArtPose {
  stride?: number;
  airborne?: boolean;
  dashing?: boolean;
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

/**
 * Shared procedural pixel art for menu previews and live gameplay.
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
  const headX = center - headW / 2;
  const headY = 4;
  const torsoY = 15;
  const torsoH = Math.max(10, height - 25);
  const legY = torsoY + torsoH - 1;
  const skin = char.id === "ninja" ? "#1f2937" : "#f1c9a5";

  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.lineJoin = "miter";

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
    rect(ctx, dark, 5, legY, 5, height - legY - 2 + stride);
    rect(ctx, dark, width - 10, legY, 5, height - legY - 2 - stride);
    rect(ctx, "#0f172a", 3, height - 3 + Math.max(0, stride), 8, 3);
    rect(ctx, "#0f172a", width - 11, height - 3 + Math.max(0, -stride), 8, 3);
  }

  // Torso and arms.
  rect(ctx, dark, 2, torsoY + 1, width - 4, torsoH);
  rect(ctx, char.bodyColor, 4, torsoY, width - 8, torsoH - 1);
  rect(ctx, light, 5, torsoY + 1, Math.max(4, width - 13), 3);
  rect(ctx, dark, 0, torsoY + 2, 4, Math.min(10, torsoH));
  rect(ctx, dark, width - 4, torsoY + 2, 4, Math.min(10, torsoH));

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
    drawBow(ctx, width + 1, torsoY + 6);
  } else if (char.id === "knight") {
    rect(ctx, "#fbbf24", center - 1, torsoY + 3, 2, torsoH - 4);
    drawSword(ctx, width + 1, torsoY - 1);
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

  ctx.restore();
}
