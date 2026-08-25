'use client';

import { motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * ScreenTransition — shared motion wrapper for game state screens.
 *
 * Two variants:
 * - "screen": full-screen states (menu, level select) slide+fade up into
 *   place, and slide away downward on exit. Mirrors the runner's
 *   scrolling direction so screens feel like layers of the world.
 * - "modal": interruptions (pause, game over, level complete) spring-scale
 *   in over the gameplay underneath — they overlay the run rather than
 *   replace it.
 *
 * Mount/unmount is driven by the parent's React `key` inside an
 * <AnimatePresence>, which is what triggers the enter/exit animations.
 *
 * pointerEvents is part of the MOTION LIFECYCLE: entering screens become
 * interactive only after they settle, and exiting screens drop
 * pointer-events immediately so a leaving overlay can never block clicks
 * on the screen underneath — even when rAF is throttled (occluded tab,
 * background window) and the exit animation stalls.
 *
 * Respects prefers-reduced-motion: cross-fade only, no displacement.
 */

export type ScreenTransitionVariant = 'screen' | 'modal';

interface ScreenTransitionProps {
  variant: ScreenTransitionVariant;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** Accessible label for the overlay region. */
  'aria-label'?: string;
  role?: string;
}

/** Reactive prefers-reduced-motion hook (SSR-safe). */
function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setPrefers(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return prefers;
}

const EASE = [0.22, 1, 0.36, 1] as const;

export default function ScreenTransition({
  variant,
  children,
  className,
  style,
  'aria-label': ariaLabel,
  role,
}: ScreenTransitionProps) {
  const prefersReduced = usePrefersReducedMotion();

  if (prefersReduced) {
    return (
      <motion.div
        className={className}
        style={style}
        role={role}
        aria-label={ariaLabel}
        initial={{ opacity: 0, pointerEvents: 'none' }}
        animate={{ opacity: 1, pointerEvents: 'auto' }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {children}
      </motion.div>
    );
  }

  if (variant === 'modal') {
    return (
      <motion.div
        className={className}
        style={style}
        role={role}
        aria-label={ariaLabel}
        initial={{ opacity: 0, scale: 0.94, y: 10, pointerEvents: 'none' }}
        animate={{ opacity: 1, scale: 1, y: 0, pointerEvents: 'auto' }}
        exit={{ opacity: 0, scale: 0.97, y: 6, pointerEvents: 'none' }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={className}
      style={style}
      role={role}
      aria-label={ariaLabel}
      initial={{ opacity: 0, y: 26, pointerEvents: 'none' }}
      animate={{ opacity: 1, y: 0, pointerEvents: 'auto' }}
      exit={{ opacity: 0, y: -18, pointerEvents: 'none' }}
      transition={{ duration: 0.28, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
