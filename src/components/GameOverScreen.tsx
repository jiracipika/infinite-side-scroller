'use client';

import { useEffect, useState, useRef, type FC } from 'react';
import { type GameStats } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  onRestart: () => void;
  onQuit: () => void;
}

/* ── Count-up hook — animates a number from 0 to target ─────── */
const useCountUp = (target: number, duration = 750, delay = 0): number => {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(0);
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - (1 - progress) ** 3;
        setValue(Math.round(target * eased));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, delay]);

  return value;
};

/* ── Screen ─────────────────────────────────────────────────── */

const GameOverScreen: FC<Props> = ({ stats, onRestart, onQuit }) => {
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;

  const displayScore    = useCountUp(stats.score,                   820, 200);
  const displayBest     = useCountUp(stats.highScore,               680, 320);
  const displayDistance = useCountUp(Math.round(stats.distance),    600, 440);
  const displayCoins    = useCountUp(stats.coins,                   550, 520);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ animation: 'iosFadeIn 0.3s ease' }}
    >
      {/* Frosted overlay */}
      <div className="absolute inset-0 ios-overlay" />

      {/* Modal sheet */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 340,
          padding: '0 16px',
          animation: 'iosModalIn 0.48s cubic-bezier(0.34,1.56,0.64,1) 0.06s both',
        }}
      >
        <div
          className="ios-sheet"
          style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.06)' }}
        >
          {/* ── Header ───────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 26,
              paddingBottom: 20,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            {/* Death icon */}
            <div
              style={{
                fontSize: 36,
                lineHeight: 1,
                marginBottom: 10,
                animation: 'iosBounceIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
                filter: 'drop-shadow(0 0 8px rgba(255,59,48,0.4))',
              }}
            >
              💀
            </div>

            <h2
              className="ios-title1"
              style={{ letterSpacing: '-0.4px' }}
            >
              Game Over
            </h2>

            {isNewHighScore && (
              <div
                className="ios-badge-yellow"
                style={{
                  marginTop: 10,
                  gap: 5,
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '4px 12px',
                  animation: 'iosBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.32s both',
                  boxShadow: '0 0 20px rgba(255,214,10,0.2)',
                }}
              >
                <StarIcon />
                New High Score!
              </div>
            )}
          </div>

          {/* ── Stats table ──────────────────────────────────── */}
          <div style={{ borderTop: '0.5px solid var(--ios-separator)' }}>
            <StatRow
              label="Score"
              value={displayScore.toLocaleString()}
              highlight={isNewHighScore}
              delay={180}
            />
            <StatRow
              label="Best"
              value={displayBest.toLocaleString()}
              delay={260}
            />
            <StatRow
              label="Distance"
              value={`${displayDistance}m`}
              delay={340}
            />
            <StatRow
              label="Coins"
              value={String(displayCoins)}
              delay={420}
            />
          </div>

          {/* ── Action buttons ────────────────────────────────── */}
          <div
            style={{
              padding: '14px 14px',
              borderTop: '0.5px solid var(--ios-separator)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              animation: 'iosFadeIn 0.4s ease 0.6s both',
            }}
          >
            <button
              className="ios-btn-primary ios-btn-shimmer"
              onClick={onRestart}
              style={{ fontSize: 17 }}
            >
              Play Again
            </button>
            <button className="ios-btn-gray" onClick={onQuit}>
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;

/* ── Stat row ────────────────────────────────────────────────── */

interface StatRowProps {
  label: string;
  value: string;
  highlight?: boolean;
  delay?: number;
}

const StatRow: FC<StatRowProps> = ({ label, value, highlight, delay = 0 }) => (
  <div
    className="ios-row"
    style={{
      animation: `rowSlideIn 0.32s ease ${delay}ms both`,
    }}
  >
    <span className="ios-row-label">{label}</span>
    <span
      className="ios-row-value"
      style={
        highlight
          ? {
              color: 'var(--ios-yellow)',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 12px rgba(255,214,10,0.4)',
            }
          : { fontVariantNumeric: 'tabular-nums' }
      }
    >
      {value}
    </span>
  </div>
);

/* ── Star icon ───────────────────────────────────────────────── */

const StarIcon: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
