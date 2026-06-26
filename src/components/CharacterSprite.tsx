"use client";

import { useEffect, useRef, type FC } from "react";
import { getCharacterById, type CharacterDef } from "@/game/data/characters";

/* ── Canvas helpers (mirrors GameRenderer internals) ── */

function shadeHexColor(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return hex;
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(parseInt(clean.slice(0, 2), 16) + amount);
  const g = clamp(parseInt(clean.slice(2, 4), 16) + amount);
  const b = clamp(parseInt(clean.slice(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function drawRoundedRect(
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

/**
 * Draws a single character sprite onto a canvas context.
 * This is the same art used in-game (renderer.ts drawPlayer), extracted so the
 * menu can show real sprites instead of flat colored divs.
 *
 * @param ctx     target canvas context
 * @param char    character definition
 * @param cx      center X in target space
 * @param topY    top Y of the sprite box in target space
 * @param scale   pixel scale (2 = 2x zoom)
 */
export function drawCharacterSprite(
  ctx: CanvasRenderingContext2D,
  char: CharacterDef,
  cx: number,
  topY: number,
  scale: number,
): void {
  const w = char.width;
  const h = char.height;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // Position so the sprite is centered horizontally on cx.
  ctx.translate(cx - (w * scale) / 2, topY);
  ctx.scale(scale, scale);

  // Shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(w / 2, h + 3, w * 0.42, h * 0.14, 0, 0, Math.PI * 2);
  ctx.fill();

  // Cape / scarf (trails behind = left side for a right-facing character)
  const capeColor =
    char.id === "ninja" ? "rgba(239,68,68,0.6)" : "rgba(185,28,28,0.45)";
  ctx.fillStyle = capeColor;
  ctx.beginPath();
  ctx.moveTo(4, 10);
  ctx.lineTo(-7, 16);
  ctx.lineTo(4, h - 7);
  ctx.closePath();
  ctx.fill();

  // Legs and boots
  ctx.fillStyle = shadeHexColor(char.outlineColor, -18);
  ctx.fillRect(5, h - 11, 5, 10);
  ctx.fillRect(w - 10, h - 11, 5, 10);
  ctx.fillStyle = "#111827";
  ctx.fillRect(3, h - 2, 8, 3);
  ctx.fillRect(w - 11, h - 2, 8, 3);

  // Torso
  const torso = ctx.createLinearGradient(0, 4, 0, h - 7);
  torso.addColorStop(0, shadeHexColor(char.bodyColor, 22));
  torso.addColorStop(1, char.outlineColor);
  ctx.fillStyle = torso;
  drawRoundedRect(ctx, 2, 8, w - 4, h - 11, 5);
  ctx.fill();
  ctx.strokeStyle = shadeHexColor(char.outlineColor, -22);
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Character-specific accents
  if (char.id === "mage") {
    ctx.fillStyle = "#312e81";
    ctx.beginPath();
    ctx.moveTo(w / 2, -2);
    ctx.lineTo(2, 12);
    ctx.lineTo(w - 2, 12);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fef08a";
    ctx.fillRect(w / 2 + 2, 4, 2, 2);
  } else if (char.id === "ranger") {
    ctx.fillStyle = "#166534";
    ctx.fillRect(3, 7, w - 6, 2);
    ctx.fillStyle = "#65a30d";
    ctx.fillRect(2, 11, w - 4, 2);
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, h - 13);
    ctx.lineTo(w - 2, h - 20);
    ctx.stroke();
  } else if (char.id === "cyborg") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(3, 9, w - 6, 3);
    ctx.fillStyle = "#22d3ee";
    ctx.fillRect(5, 10, w - 10, 1.6);
    ctx.fillStyle = "#334155";
    ctx.fillRect(-2, 13, 4, 9);
    ctx.fillRect(w - 2, 13, 4, 9);
  } else if (char.id === "spirit") {
    ctx.fillStyle = "rgba(221,214,254,0.75)";
    ctx.beginPath();
    ctx.moveTo(3, h - 10);
    ctx.quadraticCurveTo(w / 2, h - 1, w - 3, h - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#a78bfa";
    ctx.fillRect(4, 7, w - 8, 2);
  } else if (char.id === "healer") {
    ctx.fillStyle = "#0d9488";
    ctx.fillRect(3, 9, w - 6, 3);
    ctx.strokeStyle = "#ccfbf1";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 6);
    ctx.lineTo(w / 2, h - 12);
    ctx.moveTo(6, h - 16);
    ctx.lineTo(w - 6, h - 16);
    ctx.stroke();
  } else if (char.id === "tank") {
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(4, 11, w - 8, 5);
    ctx.fillStyle = "#334155";
    ctx.fillRect(-2, 13, 5, 10);
    ctx.fillRect(w - 3, 13, 5, 10);
  } else if (char.id === "ninja") {
    ctx.fillStyle = "#0f172a";
    drawRoundedRect(ctx, 3, 3, w - 6, 15, 5);
    ctx.fill();
    ctx.fillStyle = "#dc2626";
    ctx.fillRect(4, 10, w - 8, 3);
  } else {
    // Knight default
    ctx.fillStyle = "#94a3b8";
    ctx.fillRect(4, 5, w - 8, 5);
    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(w / 2 - 1, 1, 2, 5);
  }

  // Head / face
  ctx.fillStyle = char.id === "ninja" ? "#111827" : "#e2e8f0";
  drawRoundedRect(ctx, 3, 4, w - 6, 12, 4);
  ctx.fill();
  ctx.strokeStyle = shadeHexColor(char.outlineColor, -18);
  ctx.stroke();

  // Forward-pointing snout/nose
  ctx.fillStyle = char.id === "ninja" ? "#334155" : "#cbd5e1";
  ctx.beginPath();
  ctx.moveTo(w - 4, 7);
  ctx.lineTo(w + 3, 10);
  ctx.lineTo(w - 4, 13);
  ctx.closePath();
  ctx.fill();

  if (char.id === "knight" || char.id === "tank" || char.id === "cyborg") {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(Math.floor(w / 2) - 1, 8, w - 4 - Math.floor(w / 2), 4);
    ctx.fillStyle = char.eyeColor;
    ctx.fillRect(w - 9, 9, 4, 2);
  } else {
    ctx.fillStyle = char.eyeColor;
    ctx.fillRect(w - 12, 8, 3, 3);
    ctx.fillRect(w - 7, 8, 3, 3);
    ctx.fillStyle = "#020617";
    ctx.fillRect(w - 11, 9, 1, 1);
    ctx.fillRect(w - 6, 9, 1, 1);
  }

  // Chest highlight
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(5, 18, w - 10, 3);

  ctx.restore();
}

interface CharacterSpriteProps {
  characterId: string;
  size?: number; // CSS pixel size of the square canvas
  className?: string;
  decorative?: boolean; // when true, canvas is aria-hidden (use inside a labeled button)
}

/**
 * Renders a single in-game character sprite on a canvas. Used in menus to show
 * real character art instead of flat colored blocks.
 */
const CharacterSprite: FC<CharacterSpriteProps> = ({
  characterId,
  size = 64,
  className,
  decorative = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const char = getCharacterById(characterId);
    const dpr =
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    // Scale sprite to fit nicely in the canvas with some padding.
    // Tallest character is 36px; leave ~20% vertical padding.
    const maxSpriteH = 36;
    const scale = Math.max(1, (size * 0.72) / maxSpriteH);
    const cx = size / 2;
    const topY = size * 0.14;

    drawCharacterSprite(ctx, char, cx, topY, scale);
  }, [characterId, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
      className={className}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : getCharacterById(characterId).name}
    />
  );
};

export default CharacterSprite;
