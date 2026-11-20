"use client";

import { useEffect, useRef } from 'react';
import { drawBackgroundSky, drawBackgroundParallax } from '@/game/rendering/background';
import { paintInkSlab } from '@/game/rendering/ink-city';
import { BIOMES, BiomeType } from '@/game/world/biomes';
import CharacterSprite from './CharacterSprite';
import styles from './StartScreen.module.css';

/** Frame the equipped runner against the same moonlit ruins used in gameplay. */
export default function InkCover({ characterId }: { characterId: string }) {
  const backdropRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = backdropRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const paint = () => {
      const { width: layoutWidth, height: layoutHeight } = canvas.getBoundingClientRect();
      if (!layoutWidth || !layoutHeight) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pixelWidth = Math.round(layoutWidth * dpr);
      const pixelHeight = Math.round(layoutHeight * dpr);
      if (canvas.width === pixelWidth && canvas.height === pixelHeight) return;
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;

      const height = 480;
      const width = height * layoutWidth / layoutHeight;
      ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
      const colors = BIOMES[BiomeType.Grassland].colors;
      const scene = {
        width, height, colors, cameraX: 900, cameraY: 0, gameTime: 0,
        detail: 'high', reducedMotion: true,
      } as const;
      drawBackgroundSky(ctx, scene);
      drawBackgroundParallax(ctx, scene);
      const ledge = height - 34;
      ctx.fillStyle = colors.groundDark;
      ctx.fillRect(0, ledge, width, height - ledge);
      paintInkSlab(ctx, -8, ledge, width + 16, 17, colors.platform);
    };
    const observer = new ResizeObserver(paint);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.cover} data-ink-cover aria-hidden="true">
      <canvas ref={backdropRef} width={0} height={0} className={styles.coverBackdrop} />
      <div className={styles.coverHero}>
        <CharacterSprite characterId={characterId} size={266} decorative facingRight={false} />
      </div>
    </div>
  );
}
