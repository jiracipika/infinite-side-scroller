"use client";

import { useEffect, useRef, type FC } from "react";
import { getCharacterById, type CharacterDef } from "@/game/data/characters";
import { drawCharacterSpriteArt } from "@/game/rendering/character-art";

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
  drawCharacterSpriteArt(ctx, char, {
    x: 0,
    y: 0,
    width: w,
    height: h,
    shadow: true,
  });

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
  const character = getCharacterById(characterId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    drawCharacterSprite(ctx, character, cx, topY, scale);
  }, [character, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
      className={className}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : character.name}
    />
  );
};

export default CharacterSprite;
