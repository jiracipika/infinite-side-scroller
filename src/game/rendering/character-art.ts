import type { CharacterDef } from "../data/characters";

interface CharacterArtOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  stride?: number;
  dashing?: boolean;
  wallSliding?: boolean;
  shadow?: boolean;
}

function shadeHexColor(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const clamp = (value: number) => Math.max(0, Math.min(255, value));
  const r = clamp(parseInt(clean.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(clean.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(clean.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFrontEye(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  color: string,
  wide = false,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(w - (wide ? 10 : 8), y, wide ? 6 : 3, wide ? 2 : 3);
  ctx.fillStyle = "#020617";
  if (!wide) ctx.fillRect(w - 7, y + 1, 1, 1);
}

function drawProfileHead(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  w: number,
  headColor: string,
  helmetColor?: string,
): void {
  roundedRect(ctx, 3, 4, w - 6, 12, 4);
  ctx.fillStyle = headColor;
  ctx.fill();
  ctx.strokeStyle = shadeHexColor(char.outlineColor, -24);
  ctx.lineWidth = 1;
  ctx.stroke();

  if (helmetColor) {
    ctx.fillStyle = helmetColor;
    roundedRect(ctx, 3, 3, w - 6, 8, 3);
    ctx.fill();
  }

  // One-sided profile nose. It sits on the front edge only, never both sides.
  ctx.fillStyle = shadeHexColor(headColor, -16);
  ctx.fillRect(w - 3, 9, 3, 2);
}

function drawBaseBody(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  w: number,
  h: number,
  stride: number,
): void {
  ctx.fillStyle = shadeHexColor(char.outlineColor, -18);
  ctx.fillRect(5, h - 11, 5, 10 + stride);
  ctx.fillRect(w - 10, h - 11, 5, 10 - stride);
  ctx.fillStyle = "#111827";
  ctx.fillRect(3, h - 2, 8, 3);
  ctx.fillRect(w - 11, h - 2, 8, 3);

  const torso = ctx.createLinearGradient(0, 4, 0, h - 7);
  torso.addColorStop(0, shadeHexColor(char.bodyColor, 24));
  torso.addColorStop(1, char.outlineColor);
  ctx.fillStyle = torso;
  roundedRect(ctx, 2, 8, w - 4, h - 11, 5);
  ctx.fill();
  ctx.strokeStyle = shadeHexColor(char.outlineColor, -24);
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawBackCloth(
  ctx: CanvasRenderingContext2D,
  h: number,
  color: string,
  stride: number,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(4, 11);
  ctx.quadraticCurveTo(-4 - Math.max(0, stride), 17, 3, h - 8);
  ctx.lineTo(7, h - 10);
  ctx.quadraticCurveTo(1, 18, 7, 12);
  ctx.closePath();
  ctx.fill();
}

function drawCharacterDetails(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  w: number,
  h: number,
  stride: number,
): void {
  switch (char.id) {
    case "knight": {
      drawBackCloth(ctx, h, "rgba(37,99,235,0.42)", stride);
      drawBaseBody(ctx, char, w, h, stride);
      ctx.fillStyle = "#64748b";
      ctx.fillRect(4, 12, w - 8, 5);
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(w / 2 - 1, 0, 2, 5);
      drawProfileHead(ctx, char, w, "#dbeafe", "#94a3b8");
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(Math.floor(w / 2), 8, w - Math.floor(w / 2) - 4, 4);
      drawFrontEye(ctx, w, 9, char.eyeColor, true);
      break;
    }
    case "ninja": {
      drawBackCloth(ctx, h, "rgba(220,38,38,0.62)", stride + 1);
      drawBaseBody(ctx, char, w, h, stride);
      ctx.fillStyle = "#020617";
      roundedRect(ctx, 3, 3, w - 6, 15, 5);
      ctx.fill();
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(4, 10, w - 8, 3);
      drawProfileHead(ctx, char, w, "#111827", "#020617");
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(w - 12, 8, 8, 3);
      drawFrontEye(ctx, w, 8, char.eyeColor, true);
      break;
    }
    case "tank": {
      drawBaseBody(ctx, char, w, h, stride * 0.45);
      ctx.fillStyle = "#334155";
      roundedRect(ctx, -1, 12, 6, 12, 2);
      ctx.fill();
      roundedRect(ctx, w - 5, 12, 6, 12, 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(4, 13, w - 8, 5);
      drawProfileHead(ctx, char, w, "#e5e7eb", "#475569");
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(Math.floor(w / 2) - 1, 8, w - Math.floor(w / 2) - 3, 4);
      drawFrontEye(ctx, w, 9, char.eyeColor, true);
      break;
    }
    case "mage": {
      drawBackCloth(ctx, h, "rgba(109,40,217,0.34)", stride);
      drawBaseBody(ctx, char, w, h, stride);
      ctx.fillStyle = "#312e81";
      ctx.beginPath();
      ctx.moveTo(w / 2, -4);
      ctx.lineTo(4, 13);
      ctx.lineTo(w - 1, 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(w - 8, 4, 2, 2);
      drawProfileHead(ctx, char, w, "#ede9fe");
      drawFrontEye(ctx, w, 8, char.eyeColor);
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(5, 13);
      ctx.lineTo(2, h - 6);
      ctx.stroke();
      break;
    }
    case "ranger": {
      drawBaseBody(ctx, char, w, h, stride);
      ctx.fillStyle = "#14532d";
      roundedRect(ctx, 3, 5, w - 6, 10, 4);
      ctx.fill();
      ctx.fillStyle = "#65a30d";
      ctx.fillRect(4, 10, w - 8, 2);
      drawProfileHead(ctx, char, w, "#dcfce7", "#166534");
      drawFrontEye(ctx, w, 8, char.eyeColor);
      ctx.strokeStyle = "#86efac";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(3, h - 10);
      ctx.lineTo(w - 2, h - 21);
      ctx.stroke();
      ctx.fillStyle = "#713f12";
      ctx.fillRect(1, 12, 3, 13);
      break;
    }
    case "cyborg": {
      drawBaseBody(ctx, char, w, h, stride * 0.75);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(3, 10, w - 6, 4);
      ctx.fillStyle = "#22d3ee";
      ctx.fillRect(5, 11, w - 10, 1.6);
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, 14, 4, 9);
      ctx.fillRect(w - 3, 14, 4, 9);
      drawProfileHead(ctx, char, w, "#cbd5e1", "#475569");
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(w - 12, 8, 8, 4);
      drawFrontEye(ctx, w, 9, char.eyeColor, true);
      ctx.strokeStyle = "#22d3ee";
      ctx.beginPath();
      ctx.moveTo(6, 4);
      ctx.lineTo(3, -1);
      ctx.stroke();
      break;
    }
    case "spirit": {
      ctx.globalAlpha *= 0.88;
      drawBaseBody(ctx, char, w, h, stride * 0.5);
      ctx.fillStyle = "rgba(221,214,254,0.78)";
      ctx.beginPath();
      ctx.moveTo(3, h - 10);
      ctx.quadraticCurveTo(w / 2, h + 2, w - 3, h - 10);
      ctx.closePath();
      ctx.fill();
      drawProfileHead(ctx, char, w, "#ede9fe");
      drawFrontEye(ctx, w, 8, char.eyeColor);
      ctx.fillStyle = "rgba(245,208,254,0.72)";
      ctx.fillRect(w - 5, 13, 2, 2);
      break;
    }
    case "healer": {
      drawBackCloth(ctx, h, "rgba(20,184,166,0.26)", stride);
      drawBaseBody(ctx, char, w, h, stride);
      ctx.fillStyle = "#0d9488";
      roundedRect(ctx, 3, 6, w - 6, 9, 4);
      ctx.fill();
      drawProfileHead(ctx, char, w, "#ccfbf1", "#0f766e");
      drawFrontEye(ctx, w, 8, char.eyeColor);
      ctx.strokeStyle = "#ecfeff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(w / 2, 17);
      ctx.lineTo(w / 2, h - 10);
      ctx.moveTo(w / 2 - 4, h - 15);
      ctx.lineTo(w / 2 + 4, h - 15);
      ctx.stroke();
      ctx.fillStyle = "#99f6e4";
      ctx.fillRect(2, 13, 3, 12);
      break;
    }
    default: {
      drawBaseBody(ctx, char, w, h, stride);
      drawProfileHead(ctx, char, w, "#e2e8f0");
      drawFrontEye(ctx, w, 8, char.eyeColor);
      break;
    }
  }
}

export function drawCharacterSpriteArt(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  options: CharacterArtOptions,
): void {
  const {
    x,
    y,
    width: w,
    height: h,
    stride = 0,
    dashing = false,
    wallSliding = false,
    shadow = false,
  } = options;

  ctx.save();
  ctx.translate(x, y);

  if (shadow) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 3, w * 0.42, h * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCharacterDetails(ctx, char, w, h, stride);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(5, 18, w - 10, 3);

  if (dashing) {
    ctx.fillStyle = "rgba(125,211,252,0.42)";
    ctx.fillRect(-8, 8, 8, h - 12);
  }

  if (wallSliding) {
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(w + 1, h - 9, 2, 2);
    ctx.fillRect(w + 3, h - 5, 2, 2);
  }

  ctx.restore();
}
