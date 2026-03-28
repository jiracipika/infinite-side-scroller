'use client';

import { type FC } from 'react';
import { type GameStats } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  onRestart: () => void;
  onQuit: () => void;
}

const GameOverScreen: FC<Props> = ({ stats, onRestart, onQuit }) => {
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;

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
          animation: 'iosModalIn 0.48s cubic-bezier(0.34,1.56,0.64,1) 0.08s both',
        }}
      >
        <div className="ios-sheet">
          {/* ── Header ───────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              paddingTop: 24,
              paddingBottom: 18,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <h2 className="ios-title1">Game Over</h2>

            {isNewHighScore && (
              <div
                className="ios-badge-yellow"
                style={{ marginTop: 8, animation: 'iosBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.28s both' }}
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
              value={stats.score.toLocaleString()}
              highlight={isNewHighScore}
            />
            <StatRow
              label="Best"
              value={stats.highScore.toLocaleString()}
            />
            <StatRow
              label="Distance"
              value={`${Math.round(stats.distance)}m`}
            />
            <StatRow
              label="Coins"
              value={String(stats.coins)}
            />
          </div>

          {/* ── Action buttons ────────────────────────────────── */}
          <div
            style={{
              padding: '14px 14px 14px',
              borderTop: '0.5px solid var(--ios-separator)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <button className="ios-btn-primary" onClick={onRestart}>
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

const StatRow: FC<{ label: string; value: string; highlight?: boolean }> = ({
  label, value, highlight,
}) => (
  <div className="ios-row">
    <span className="ios-row-label">{label}</span>
    <span
      className="ios-row-value"
      style={
        highlight
          ? { color: 'var(--ios-yellow)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }
          : { fontVariantNumeric: 'tabular-nums' }
      }
    >
      {value}
    </span>
  </div>
);

/* ── Star icon ───────────────────────────────────────────────── */

const StarIcon: FC = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 3 }}>
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
