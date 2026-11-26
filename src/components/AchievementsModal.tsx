'use client';

import { useState, useEffect, useRef, type FC } from 'react';
import { playUiClick } from '@/game/audio';
import ACHIEVEMENTS, {
  loadUnlockedAchievements,
  loadLifetimeStats,
  type AchievementStats,
} from '@/lib/achievements';
import { Icon, type IconName } from './Icon';

const LIME_GLOW = '0 0 8px rgba(199, 255, 77, 0.35)';

/* ── Toast notification (shown briefly when unlocked) ── */

interface ToastProps {
  title: string;
  icon: IconName;
  onDone: () => void;
}

export const AchievementToast: FC<ToastProps> = ({ title, icon, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 18px',
        borderRadius: 12,
        background: 'var(--dv-panel)',
        border: '1px solid var(--dv-stroke)',
        boxShadow: `0 8px 32px rgba(0,0,0,0.5), ${LIME_GLOW}`,
        animation: 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: '90vw',
      }}
    >
      <span style={{ display: 'flex', color: 'var(--dv-action)' }}>
        <Icon name={icon} size={26} />
      </span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 }}>
          Achievement Unlocked
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dv-text)', letterSpacing: '-0.23px' }}>
          {title}
        </div>
      </div>
    </div>
  );
};

/* ── Full achievements modal ── */

interface Props {
  onClose: () => void;
}

export default function AchievementsModal({ onClose }: Props) {
  const [unlocked, setUnlocked] = useState<string[]>([]);
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // The parent passes a fresh onClose every render; keep the latest one so the
  // key handler below binds once.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setUnlocked(loadUnlockedAchievements());
    setStats(loadLifetimeStats());
  }, []);

  // Dialog behaviour: focus moves in, Escape closes, Tab stays on the single
  // control, and focus returns to whatever opened the modal.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
      } else if (event.key === 'Tab') {
        event.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  const total = ACHIEVEMENTS.length;
  const done = unlocked.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    // Scoped like the run dialogs (ink sheet, ink buttons) and marked as a
    // still dialog: it opens over the animated start screen, where a
    // backdrop blur would be recomputed every frame. Fixed to the viewport:
    // the menu shell scrolls, and an absolutely positioned modal stayed at
    // the top of its content — off-screen whenever the player had scrolled
    // down to the profile panel, which is where the opener lives on phones.
    <div
      className="dash-run-dialog dash-still-dialog fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 40, animation: 'iosFadeIn 0.3s ease' }}
    >
      <div className="absolute inset-0 ios-overlay" onClick={onClose} />
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: 380,
          padding: '0 16px',
          animation: 'iosModalIn 0.48s cubic-bezier(0.34,1.56,0.64,1) 0.06s both',
        }}
      >
        <div
          className="ios-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Achievements"
          style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7)', borderRadius: 12 }}
        >
          {/* Header */}
          <div style={{ padding: '20px 16px 16px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--dv-action)', marginBottom: 8 }}>
              <Icon name="trophy" size={36} strokeWidth={2} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.4px', marginBottom: 4 }}>
              Achievements
            </h2>
            <div style={{ fontSize: 13, color: 'var(--dv-muted)', marginBottom: 12 }}>
              {done} / {total} unlocked ({pct}%)
            </div>
            {/* Progress bar */}
            <div
              role="progressbar"
              aria-label="Achievements unlocked"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ height: 6, borderRadius: 3, background: 'rgba(244, 242, 237, 0.1)', overflow: 'hidden' }}
            >
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  background: 'var(--dv-action)',
                  width: `${pct}%`,
                  transition: 'width 0.6s ease-out',
                  boxShadow: LIME_GLOW,
                }}
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ overflowY: 'auto', borderTop: '1px solid var(--dv-stroke)', flex: 1 }}>
            {ACHIEVEMENTS.map((a) => {
              const isUnlocked = unlocked.includes(a.id);
              const isHiddenSecret = a.secret && !isUnlocked;
              // Show a progress bar only for visible, locked achievements that
              // expose a progress callback. Skip secrets (their progress would
              // leak the unlock target) and unlocked items (already complete).
              const prog = (!isUnlocked && !isHiddenSecret && stats)
                ? (a.progress?.(stats) ?? null)
                : null;
              const pct = prog && prog.target > 0
                ? Math.min(100, Math.round((prog.current / prog.target) * 100))
                : 0;
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderTop: '1px solid rgba(244, 242, 237, 0.06)',
                    opacity: isUnlocked ? 1 : 0.78,
                  }}
                >
                  <div
                    aria-hidden="true"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 9,
                      background: isUnlocked ? 'rgba(199, 255, 77, 0.14)' : 'var(--dv-raised)',
                      color: isUnlocked ? 'var(--dv-action)' : 'var(--dv-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      border: isUnlocked ? '1px solid rgba(199, 255, 77, 0.4)' : '1px solid transparent',
                    }}
                  >
                    <Icon name={isHiddenSecret ? 'circle-help' : a.icon} size={21} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: isUnlocked ? 'var(--dv-text)' : 'var(--dv-muted)', letterSpacing: '-0.23px' }}>
                      {isHiddenSecret ? '???' : a.title}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--dv-muted)', marginTop: 2 }}>
                      {isHiddenSecret ? 'Secret achievement' : a.desc}
                    </div>
                    {/* Live progress bar for locked, non-secret achievements */}
                    {prog && (
                      <div style={{ marginTop: 6 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: 12,
                            fontWeight: 600,
                            color: 'var(--dv-muted)',
                            marginBottom: 3,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <span>{formatProgressValue(prog.current)} / {formatProgressValue(prog.target)}</span>
                          <span>{pct}%</span>
                        </div>
                        <div
                          style={{
                            height: 4,
                            borderRadius: 2,
                            background: 'rgba(244, 242, 237, 0.1)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              borderRadius: 2,
                              width: `${pct}%`,
                              background: 'var(--dv-action)',
                              transition: 'width 0.4s ease-out',
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  {isUnlocked && (
                    <div
                      aria-label="Unlocked"
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 5,
                        background: 'var(--dv-action)',
                        color: 'var(--dv-ink)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '2px 2px 0 #0a0a0f',
                      }}
                    >
                      <Icon name="check" size={15} strokeWidth={3} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px', borderTop: '1px solid var(--dv-stroke)', flexShrink: 0 }}>
            <button
              ref={closeRef}
              className="ios-btn-gray"
              onClick={() => {
                playUiClick();
                onClose();
              }}
              style={{ width: '100%', minHeight: 48, fontSize: 16, fontWeight: 700 }}
            >
              Close
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/**
 * Compact formatting for achievement progress values. Large milestones
 * (e.g. 100,000m total distance) would otherwise overflow the narrow row,
 * so we abbreviate to "k"/"M" suffixes. Small values render as-is.
 */
function formatProgressValue(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${m % 1 === 0 ? m : m.toFixed(1)}M`;
  }
  if (value >= 10_000) {
    const k = value / 1_000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return value.toLocaleString();
}
