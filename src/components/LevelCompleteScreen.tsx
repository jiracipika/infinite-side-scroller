'use client';

import { type FC, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LevelConfig } from '@/game/data/levels';
import { BIOME_COLORS } from './LevelSelectScreen';
import { resolveLevelCompleteKey } from './level-complete-keys';

interface LevelResult {
  score: number;
  coins: number;
  distance: number;
  timeMs: number;
  enemiesDefeated: number;
}

interface Props {
  level: LevelConfig;
  result: LevelResult;
  onNext?: () => void;
  onRetry: () => void;
  onBack: () => void;
}

function calcStars(level: LevelConfig, score: number): number {
  if (score >= level.starThresholds.three) return 3;
  if (score >= level.starThresholds.two) return 2;
  if (score >= level.starThresholds.one) return 1;
  return 0;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

const Star: FC<{ filled: boolean; delay: number; size?: number }> = ({ filled, delay, size = 36 }) => (
  <motion.div
    initial={{ scale: 0, rotate: -180 }}
    animate={filled ? { scale: 1, rotate: 0 } : { scale: 1, rotate: 0 }}
    transition={{ delay, type: 'spring', stiffness: 300, damping: 15 }}
    style={{ fontSize: size, opacity: filled ? 1 : 0.15, display: 'inline-block' }}
  >
    ⭐
  </motion.div>
);

const StatRow: FC<{ label: string; value: string; color?: string; delay: number }> = ({ label, value, color, delay }) => (
  <motion.div
    initial={{ opacity: 0, x: -12 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.3 }}
    style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
  >
    <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>{label}</span>
    <span style={{ fontSize: 15, fontWeight: 700, color: color || '#fff', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
  </motion.div>
);

const LevelCompleteScreen: FC<Props> = ({ level, result, onNext, onRetry, onBack }) => {
  const stars = calcStars(level, result.score);
  const biome = BIOME_COLORS[level.biome] || BIOME_COLORS.forest;
  const [showButtons, setShowButtons] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowButtons(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard shortcuts: Enter = Next (or Retry if no Next), R = Retry, Esc = Levels.
  // - Grace period (1300ms) so a reflexive keypress at the moment of level
  //   completion cannot skip the star/score reveal animation. Set just after
  //   the action buttons appear (1200ms) so keyboard and touch are in sync.
  // - Modifier guard (via resolveLevelCompleteKey) prevents hijacking
  //   Ctrl+Enter, Cmd+Esc, Alt+R, Shift+R (browser reload), etc.
  // - Debounce: keys auto-repeat on hold; only act on the first keydown.
  // - No Space binding: Space is the jump key, and binding it here would let
  //   a held jump press instantly retry or advance the level.
  // - `canAdvance` mirrors the render gate for the Next button (≥1 star AND a
  //   next-level handler exists), so Enter only triggers Next when Next would
  //   be visible — otherwise it retries, matching "confirm" intent.
  const canAdvance = Boolean(onNext) && stars >= 1;
  const keyboardReadyRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    keyboardReadyRef.current = false;
    const grace = window.setTimeout(() => { keyboardReadyRef.current = true; }, 1300);

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const action = resolveLevelCompleteKey(
        e.code,
        e.ctrlKey || e.metaKey || e.altKey || e.shiftKey,
        canAdvance,
      );
      if (!action) return;
      // Debounce: ignore if this exact key already fired since mount.
      if (lastKeyRef.current === e.code) return;
      // Wait until the reveal grace window has elapsed.
      if (!keyboardReadyRef.current) return;
      lastKeyRef.current = e.code;
      e.preventDefault();
      if (action === 'next') onNext?.();
      else if (action === 'retry') onRetry();
      else onBack();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(grace);
      window.removeEventListener('keydown', onKey);
    };
  }, [canAdvance, onNext, onRetry, onBack]);

  return (
    <div style={{
      width: '100%', maxWidth: 420, margin: '0 auto', padding: '32px 20px',
      color: '#fff', fontFamily: '-apple-system, system-ui, sans-serif',
      textAlign: 'center', minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: 8 }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: biome.accent }}>
          {level.mode === 'time-attack' ? `Time Attack ${level.id - 20}` : `Level ${level.id}`}
        </div>
      </motion.div>

      <motion.h2
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ fontSize: 28, fontWeight: 700, margin: '0 0 20px', letterSpacing: '-0.5px' }}
      >
        {level.name}
      </motion.h2>

      {/* Stars */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 28 }}>
        {[1, 2, 3].map(s => (
          <Star key={s} filled={stars >= s} delay={0.4 + s * 0.2} size={42} />
        ))}
      </div>

      {/* Score */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        style={{
          fontSize: 48, fontWeight: 700, letterSpacing: '-1px',
          color: stars >= 3 ? '#FFD60A' : stars >= 1 ? biome.accent : '#fff',
          textShadow: stars >= 3 ? '0 0 20px rgba(255,214,10,0.3)' : 'none',
          marginBottom: 8,
        }}
      >
        {result.score}
      </motion.div>

      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24, fontWeight: 600 }}>
        {stars >= 3 ? 'PERFECT!' : stars >= 2 ? 'GREAT!' : stars >= 1 ? 'GOOD!' : 'TRY AGAIN'}
      </div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
        style={{ width: '100%', marginBottom: 32 }}
      >
        <StatRow label="Distance" value={`${Math.round(result.distance)}m`} delay={0.7} />
        <StatRow label="Coins" value={`${result.coins}`} color="#FFD60A" delay={0.75} />
        <StatRow label="Time" value={formatTime(result.timeMs)} delay={0.8} />
        <StatRow label="Enemies Defeated" value={`${result.enemiesDefeated}`} color="#FF453A" delay={0.85} />
      </motion.div>

      {/* Buttons */}
      {showButtons && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', gap: 10, width: '100%' }}
        >
          <motion.button
            onClick={onBack}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: 1, padding: 14, borderRadius: 12,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.6)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Levels
            <kbd className="ios-kbd-hint" aria-hidden="true">Esc</kbd>
          </motion.button>
          <motion.button
            onClick={onRetry}
            whileTap={{ scale: 0.95 }}
            style={{
              flex: 1, padding: 14, borderRadius: 12,
              background: biome.accent, border: 'none',
              color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            Retry
            <kbd className="ios-kbd-hint" aria-hidden="true">R</kbd>
          </motion.button>
          {onNext && stars >= 1 && (
            <motion.button
              onClick={onNext}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1, padding: 14, borderRadius: 12,
                background: 'linear-gradient(135deg, #30D158, #0A84FF)', border: 'none',
                color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              Next →
              <kbd className="ios-kbd-hint" aria-hidden="true">Enter</kbd>
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default LevelCompleteScreen;
export { calcStars };
