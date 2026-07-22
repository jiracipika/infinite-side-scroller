"use client";

import { useEffect, useRef, type FC } from "react";
import { getCharacterById } from "@/game/data/characters";
import { drawCharacterArt } from "@/game/rendering/character-art";

interface CharacterSpriteProps {
  characterId: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  facingRight?: boolean;
}

/** Crisp menu preview that uses the exact same procedural art as gameplay. */
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

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const artHeight = character.height + 5;
    const scale = Math.max(1, Math.round((size * 0.9) / artHeight));
    const drawnWidth = character.width * scale;
    const drawnHeight = character.height * scale;
    const originY = Math.max(2, (size - drawnHeight) / 2 - scale);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(size / 2, originY + drawnHeight + scale * 2, drawnWidth * 0.42, scale * 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(size / 2, originY);
    ctx.scale(facingRight ? scale : -scale, scale);
    ctx.translate(-character.width / 2, 0);
    drawCharacterArt(ctx, character, character.width, character.height);
    ctx.restore();
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
