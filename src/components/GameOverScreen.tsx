'use client';

import { useEffect, useState, useRef, type FC, type TouchEvent } from 'react';
import { type GameStats } from '@/game/state/game-state';
import { addLeaderboardEntry, loadLeaderboardAvatarId, loadLeaderboardName } from '@/lib/leaderboard';
import { loadSelectedCharacter } from '@/game/data/characters';
import { type NewRecords } from './GameStore';
import { resolveGameOverKey } from './game-over-keys';
import { fireHaptic } from '@/game/input/haptics';

interface Props {
  stats: GameStats;
  newRecords?: NewRecords;
  hapticsEnabled?: boolean;
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

const GameOverScreen: FC<Props> = ({ stats, newRecords, hapticsEnabled = true, onRestart, onQuit }) => {
  const submittedRef = useRef(false);
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;

  const records = newRecords ?? {
    score: false, distance: false, coins: false, combo: false, kills: false,
  };
  const recordCount = (records.score ? 1 : 0) + (records.distance ? 1 : 0) +
    (records.coins ? 1 : 0) + (records.combo ? 1 : 0) + (records.kills ? 1 : 0);
  const showRecordBanner = recordCount >= 2;

  const displayScore    = useCountUp(stats.score,                   820, 200);
  const displayBest     = useCountUp(stats.highScore,               680, 320);
  const displayDistance = useCountUp(Math.round(stats.distance),    600, 440);
  const displayCoins    = useCountUp(stats.coins,                   550, 520);
  const displayMaxCombo = useCountUp(stats.maxCombo ?? 0,            500, 600);
  const displayKills    = useCountUp(stats.enemiesDefeated ?? 0,     500, 680);
  const handleRestartTouch = (e: TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onRestart();
  };
  const handleQuitTouch = (e: TouchEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onQuit();
  };

  // Keyboard shortcuts: Enter = Play Again, Esc = Main Menu.
  // - Grace period (700ms) so a reflexive keypress at the moment of death
  //   cannot skip the score count-up or fire before React mounts the overlay.
  // - Modifier guard (via resolveGameOverKey) prevents hijacking Ctrl+Enter,
  //   Cmd+Esc, Alt+Space, and other OS/browser shortcuts.
  // - Debounce: keys auto-repeat on hold; only act on the first keydown.
  // - No Space binding: Space is the jump key, and binding it here would let
  //   a held jump press instantly restart the run.
  const keyboardReadyRef = useRef(false);
  const lastKeyRef = useRef<string | null>(null);
  useEffect(() => {
    keyboardReadyRef.current = false;
    const grace = window.setTimeout(() => { keyboardReadyRef.current = true; }, 700);

    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      // Suppress the OS/browser default for Enter and Escape so, e.g., a
      // button doesn't double-fire via its native onClick, and Escape
      // doesn't exit fullscreen / trigger other page handlers.
      const action = resolveGameOverKey(
        e.code,
        e.ctrlKey || e.metaKey || e.altKey || e.shiftKey,
      );
      if (!action) return;
      // Debounce: ignore if this exact key already fired since mount.
      if (lastKeyRef.current === e.code) return;
      // Wait until the count-up grace window has elapsed.
      if (!keyboardReadyRef.current) return;
      lastKeyRef.current = e.code;
      e.preventDefault();
      if (action === 'restart') onRestart();
      else onQuit();
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(grace);
      window.removeEventListener('keydown', onKey);
    };
  }, [onRestart, onQuit]);

  useEffect(() => {
    if (submittedRef.current) return;
    const hasMeaningfulRun = stats.score > 0 || stats.coins > 0 || stats.distance > 0;
    if (!hasMeaningfulRun) return;
    submittedRef.current = true;
    addLeaderboardEntry({
      name: loadLeaderboardName(),
      avatarId: loadLeaderboardAvatarId(),
      score: stats.score,
      distance: Math.round(stats.distance),
      coins: stats.coins,
      characterId: loadSelectedCharacter(),
      maxCombo: stats.maxCombo,
      enemiesDefeated: stats.enemiesDefeated,
    });
  }, [stats.coins, stats.distance, stats.enemiesDefeated, stats.maxCombo, stats.score]);

  // Death haptic — one long dramatic pattern when the game-over sheet appears.
  // Fires once on mount only; safe no-op on browsers without Vibration API.
  useEffect(() => {
    fireHaptic('death', hapticsEnabled);
  }, [hapticsEnabled]);

  return (
    <div
      className="absolute inset-0 flex items-center justify-center pointer-events-auto"
      style={{ animation: 'iosFadeIn 0.3s ease' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-over-title"
    >
      {/* Frosted overlay */}
      <div className="absolute inset-0 ios-overlay" aria-hidden="true" />

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
              aria-hidden="true"
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
              id="game-over-title"
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

            {showRecordBanner && !isNewHighScore && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--ios-green)',
                  padding: '4px 12px',
                  borderRadius: 16,
                  background: 'rgba(48,209,88,0.15)',
                  border: '1px solid rgba(48,209,88,0.35)',
                  animation: 'iosBounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.35s both',
                }}
              >
                {recordCount} New Records!
              </div>
            )}
          </div>

          {/* ── Stats table ──────────────────────────────────── */}
          <div style={{ borderTop: '0.5px solid var(--ios-separator)' }}>
            <StatRow
              label="Score"
              value={displayScore.toLocaleString()}
              highlight={isNewHighScore}
              isNewBest={records.score}
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
              isNewBest={records.distance}
              delay={340}
            />
            <StatRow
              label="Coins"
              value={String(displayCoins)}
              isNewBest={records.coins}
              delay={420}
            />
            <StatRow
              label="Best Combo"
              value={displayMaxCombo > 0 ? `x${displayMaxCombo}` : '—'}
              highlight={displayMaxCombo >= 10}
              isNewBest={records.combo}
              delay={500}
            />
            <StatRow
              label="Defeated"
              value={String(displayKills)}
              isNewBest={records.kills}
              delay={580}
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
              type="button"
              className="ios-btn-primary ios-btn-shimmer"
              onClick={onRestart}
              onTouchEnd={handleRestartTouch}
              onContextMenu={(e) => e.preventDefault()}
              style={{ fontSize: 17 }}
              aria-label="Play again"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Play Again
                <kbd className="ios-kbd-hint" aria-hidden="true">Enter</kbd>
              </span>
            </button>
            <button
              type="button"
              className="ios-btn-gray"
              onClick={onQuit}
              onTouchEnd={handleQuitTouch}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Return to main menu"
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                Main Menu
                <kbd className="ios-kbd-hint" aria-hidden="true">Esc</kbd>
              </span>
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
  isNewBest?: boolean;
  delay?: number;
}

const StatRow: FC<StatRowProps> = ({ label, value, highlight, isNewBest, delay = 0 }) => (
  <div
    className="ios-row"
    style={{
      animation: `rowSlideIn 0.32s ease ${delay}ms both`,
    }}
  >
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="ios-row-label">{label}</span>
      {isNewBest && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: 'var(--ios-green)',
            background: 'rgba(48,209,88,0.15)',
            border: '1px solid rgba(48,209,88,0.3)',
            borderRadius: 5,
            padding: '1px 5px',
            lineHeight: 1.3,
            textTransform: 'uppercase',
            animation: `iosBounceIn 0.4s cubic-bezier(0.34,1.56,0.64,1) ${delay + 200}ms both`,
          }}
        >
          NEW!
        </span>
      )}
    </span>
    <span
      className="ios-row-value"
      style={
        isNewBest
          ? {
              color: 'var(--ios-green)',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              textShadow: '0 0 12px rgba(48,209,88,0.4)',
            }
          : highlight
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
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
