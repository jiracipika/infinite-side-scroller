"use client";

import { useEffect, useRef, type FC } from "react";
import { getCharacterById } from "@/game/data/characters";
import { drawCharacterArt } from "@/game/rendering/character-art";
import { characterHasFullArt } from "@/game/rendering/character-fullart";

interface CharacterSpriteProps {
  characterId: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  facingRight?: boolean;
  /** Only the selected hero breathes; roster chips don't each run a RAF loop. */
  animated?: boolean;
}

/** One shared painter for gameplay and previews, including asynchronously
 * loaded Pixel alternatives. Framing reserves room for hair, hats and props. */
const CharacterSprite: FC<CharacterSpriteProps> = ({
  characterId, size = 64, className, decorative = false, facingRight = true, animated = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const character = getCharacterById(characterId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    // Full-art figures draw at 1.3x box height (head/hat overhangs the
    // collision box), so reserve extra room or they clip the frame.
    const fullArt = characterHasFullArt(characterId);
    const scale = Math.min((size - 6) / (character.width + 24), (size - 6) / (character.height + 12)) * (fullArt ? 0.75 : 1);
    const drawnWidth = character.width * scale;
    const drawnHeight = character.height * scale;
    const originY = (size - drawnHeight) / 2 + scale;
    const draw = (time = 0) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#17121f";
      ctx.beginPath();
      ctx.ellipse(size / 2, originY + drawnHeight + scale, drawnWidth * .42, scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(size / 2, originY);
      ctx.scale(facingRight ? scale : -scale, scale);
      ctx.translate(-character.width * .6, 0);
      drawCharacterArt(ctx, character, character.width, character.height, { time, moving: false });
      ctx.restore();
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, last = 0, elapsed = 0;
    let visible = true;
    const tick = (now: number) => {
      if (now - last >= 1000 / 24) {
        if (last && visible && !document.hidden) elapsed += Math.min(.1, (now - last) / 1000);
        last = now;
        if (visible && !document.hidden) draw(elapsed);
      }
      frame = requestAnimationFrame(tick);
    };
    const refresh = () => draw(media.matches ? 0 : elapsed);
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      frame = 0; last = 0;
      refresh();
      if (animated && !media.matches && visible && !document.hidden) frame = requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; syncMotion(); });
    observer.observe(canvas);
    window.addEventListener('dashverse-art-change', refresh);
    document.addEventListener('visibilitychange', syncMotion);
    media.addEventListener('change', syncMotion);
    syncMotion();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('dashverse-art-change', refresh);
      document.removeEventListener('visibilitychange', syncMotion);
      media.removeEventListener('change', syncMotion);
    };
  }, [animated, character, facingRight, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }}
    className={className} aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : `${character.name} character preview`} />;
};
export default CharacterSprite;
