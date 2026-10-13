"use client";

import { useEffect, useRef, type FC } from "react";
import { getCharacterById } from "@/game/data/characters";
import { drawCharacterArt } from "@/game/rendering/character-art";
import { subscribeCharacterArt } from "@/game/rendering/sprite-sheet";
import { CHARACTER_SHEET_LAYOUTS } from "@/game/rendering/character-sheets-data";

interface CharacterSpriteProps {
  characterId: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  facingRight?: boolean;
}

/** Menu preview shares the equipped gameplay art and fits its full silhouette. */
const CharacterSprite: FC<CharacterSpriteProps> = ({
  characterId,
  size = 64,
  className,
  decorative = false,
  facingRight = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const character = getCharacterById(characterId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const paint = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);

      const bounds = CHARACTER_SHEET_LAYOUTS[character.id]?.idleBounds ?? {
        left: 0, top: 0, right: character.width, bottom: character.height,
      };
      const artWidth = bounds.right - bounds.left;
      const artHeight = bounds.bottom - bounds.top;
      const scale = Math.min((size * 0.88) / artWidth, (size * 0.82) / artHeight);
      const drawnWidth = character.width * scale;
      const originY = (size - artHeight * scale) / 2 - bounds.top * scale;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.beginPath();
      ctx.ellipse(size / 2, originY + bounds.bottom * scale + scale, drawnWidth * 0.42, Math.max(1, scale), 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.translate(size / 2, originY);
      ctx.scale(facingRight ? scale : -scale, scale);
      ctx.translate(-(bounds.left + bounds.right) / 2, 0);
      drawCharacterArt(ctx, character, character.width, character.height);
      ctx.restore();
    };
    const unsubscribe = subscribeCharacterArt(character.id, paint);
    paint();
    return unsubscribe;
  }, [character, facingRight, size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, display: "block" }}
      className={className}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${character.name} character preview`}
    />
  );
};

export default CharacterSprite;
