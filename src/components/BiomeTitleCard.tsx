'use client';

import { useEffect, useRef, useState, type FC } from 'react';

/**
 * BiomeTitleCard — graphic-novel biome-entry announcement.
 *
 * Listens for the engine's `dashverse-biome` CustomEvent (dispatched once per
 * biome change during a run) and plays a dramatic ink title card: condensed
 * display type on an ink panel, accent underline in the biome's platform
 * color, ink-wipe entrance, calm fade exit. Fully suppressed (renders nothing)
 * when the user prefers reduced motion — the event still fires so other
 * listeners (haptics, audio) can react.
 */

interface BiomeTitleCardProps {
  /** How long the card stays fully on screen before fading (ms). */
  holdMs?: number;
  /** Force animation suppression (user preference plumbed from settings). */
  still?: boolean;
}

interface CardState {
  name: string;
  accent: string;
  key: number;
}

const BiomeTitleCard: FC<BiomeTitleCardProps> = ({ holdMs = 1400, still = false }) => {
  const [card, setCard] = useState<CardState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const onBiome = (e: Event) => {
      const detail = (e as CustomEvent<{ name: string; accent: string }>).detail;
      if (!detail?.name) return;
      // Clear any pending exit timers from a rapid re-entry.
      timersRef.current.forEach((t) => window.clearTimeout(t));
      timersRef.current = [];
      setLeaving(false);
      setCard((prev) => ({
        name: detail.name,
        accent: detail.accent || '#c7ff4d',
        key: (prev?.key ?? 0) + 1,
      }));
      const t1 = window.setTimeout(() => setLeaving(true), holdMs);
      const t2 = window.setTimeout(() => setCard(null), holdMs + 650);
      timersRef.current.push(t1, t2);
    };
    window.addEventListener('dashverse-biome', onBiome);
    return () => {
      window.removeEventListener('dashverse-biome', onBiome);
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, [holdMs]);

  if (!card) return null;

  return (
    <div
      key={card.key}
      aria-live="polite"
      style={{
        position: 'absolute',
        // Sits above the canvas and below pause overlays.
        zIndex: 15,
        left: '50%',
        top: '22%',
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        pointerEvents: 'none',
        animation: still
          ? undefined
          : leaving
            ? 'biomeCardOut 0.6s ease both'
            : 'biomeCardIn 0.45s cubic-bezier(0.22, 1.2, 0.36, 1) both',
      }}
    >
      <span
        style={{
          fontSize: 13,
          letterSpacing: '0.42em',
          textTransform: 'uppercase',
          color: '#9570ff',
          fontFamily: 'inherit',
          textIndent: '0.42em', // balance tracking for centered type
        }}
      >
        Now entering
      </span>
      <div
        style={{
          background: '#0a0a0f',
          border: '2px solid #1c1c2e',
          boxShadow: '6px 6px 0 rgba(10,10,15,0.55)',
          padding: '10px 26px 12px',
          transform: 'skewX(-6deg)',
        }}
      >
        <span
          style={{
            display: 'block',
            transform: 'skewX(6deg)',
            fontSize: 'clamp(26px, 5.5vw, 44px)',
            fontWeight: 900,
            letterSpacing: '0.06em',
            color: '#f4f2ed',
            fontFamily: 'inherit',
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
          }}
        >
          {card.name.toUpperCase()}
        </span>
      </div>
      <span
        aria-hidden="true"
        style={{
          height: 4,
          width: 'min(46vw, 240px)',
          background: card.accent,
          boxShadow: `0 0 12px ${card.accent}`,
        }}
      />
    </div>
  );
};

export default BiomeTitleCard;
