'use client';

import { useEffect, useState, type FC } from 'react';

/**
 * GameOverFlash — comic-book knockout frame.
 *
 * Plays once when the run ends, before the results panel reads: a 2-frame
 * ink flash (white → dark) plus radial burst lines from screen center, the
 * classic manga "impact" treatment. Pure CSS, no canvas work, removed from
 * the DOM after ~700ms. Skipped entirely under reduced motion.
 */

const GameOverFlash: FC<{ still?: boolean }> = ({ still = false }) => {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    if (still) return;
    const timers = [
      window.setTimeout(() => setPhase(1), 70),
      window.setTimeout(() => setPhase(2), 170),
      window.setTimeout(() => setPhase(0), 650),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [still]);

  if (still || phase === 0) return null;

  const isWhite = phase === 1;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        pointerEvents: 'none',
        background: isWhite ? '#f4f2ed' : '#0a0a0f',
        opacity: phase === 2 ? 0.88 : 1,
        // Radial burst lines via repeating-conic-gradient — inked impact rays.
        ...(phase === 2
          ? {
              backgroundImage:
                'repeating-conic-gradient(from 0deg at 50% 46%, rgba(244,242,237,0.14) 0deg 1.6deg, transparent 1.6deg 7deg)',
            }
          : {}),
        transition: 'opacity 120ms linear',
      }}
    />
  );
};

export default GameOverFlash;
