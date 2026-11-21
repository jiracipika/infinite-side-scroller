"use client";

import { useEffect, useRef, type FC } from "react";
import { getCharacterById } from "@/game/data/characters";
import { drawCharacterArt } from "@/game/rendering/character-art";
import { characterPreviewPose, type CharacterPreviewAction } from '@/game/rendering/character-performance';
import { characterPreviewBounds, characterStageBounds, fitCharacterPreview } from '@/game/rendering/character-framing';

interface CharacterSpriteProps {
  characterId: string;
  size?: number;
  className?: string;
  decorative?: boolean;
  facingRight?: boolean;
  /** Only the selected hero breathes; roster chips don't each run a RAF loop. */
  animated?: boolean;
  previewAction?: CharacterPreviewAction;
  stableFraming?: boolean;
  motionSetting?: 'auto' | 'on' | 'off';
}

// Give each move a readable still pose when the animation is disabled.
const STILL_POSE_TIME: Record<CharacterPreviewAction, number> = {
  idle: 0,
  run: .12,
  jump: .32,
  attack: .35,
};

/** One shared painter for gameplay and previews, including asynchronously
 * loaded Pixel alternatives. Framing reserves room for hair, hats and props. */
const CharacterSprite: FC<CharacterSpriteProps> = ({
  characterId, size = 64, className, decorative = false, facingRight = true, animated = false, previewAction = 'idle',
  stableFraming = false, motionSetting = 'auto',
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
    const boundsForPreview = () => stableFraming
      ? characterStageBounds(character)
      : characterPreviewBounds(character, previewAction, animated);
    let framing = fitCharacterPreview(boundsForPreview(), size);
    const draw = (time = 0) => {
      const { x, y, scale } = framing;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = "#17121f";
      ctx.beginPath();
      const shadowX = (facingRight ? x : size - x) + (facingRight ? 1 : -1) * character.width * scale / 2;
      const shadowY = Math.min(size - 2, y + character.height * scale + 1);
      ctx.ellipse(shadowX, shadowY, character.width * scale * .42, Math.max(.5, scale * .5), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(facingRight ? x : size - x, y);
      ctx.scale(facingRight ? scale : -scale, scale);
      drawCharacterArt(ctx, character, character.width, character.height, characterPreviewPose(character, time, previewAction));
      ctx.restore();
    };
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => motionSetting === 'on' || (motionSetting === 'auto' && media.matches);
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
    const refresh = () => {
      framing = fitCharacterPreview(boundsForPreview(), size);
      draw(reduced() ? STILL_POSE_TIME[previewAction] : elapsed);
    };
    const syncMotion = () => {
      cancelAnimationFrame(frame);
      frame = 0; last = 0;
      refresh();
      if (animated && !reduced() && visible && !document.hidden) frame = requestAnimationFrame(tick);
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
  }, [animated, character, characterId, facingRight, size, previewAction, stableFraming, motionSetting]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }}
    className={className} aria-hidden={decorative || undefined}
    aria-label={decorative ? undefined : `${character.name} character preview`} />;
};
export default CharacterSprite;
