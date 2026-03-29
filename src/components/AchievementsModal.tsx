'use client';

import { useState, useEffect, useCallback, type FC } from 'react';
import ACHIEVEMENTS, {
  loadUnlockedAchievements, saveUnlockedAchievements,
  loadLifetimeStats, saveLifetimeStats, checkNewAchievements,
  type AchievementStats,
} from '@/lib/achievements';

/* ── Toast notification (shown briefly when unlocked) ── */

interface ToastProps {
  title: string;
  icon: string;
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
        borderRadius: 16,
        background: 'rgba(30,30,30,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '0.5px solid rgba(255,214,10,0.3)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 16px rgba(255,214,10,0.15)',
        animation: 'toastIn 0.4s cubic-bezier(0.34,1.56,0.64,1)',
        maxWidth: '90vw',
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#FFD60A', marginBottom: 2 }}>
          Achievement Unlocked
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#EBEBF5', letterSpacing: '-0.23px' }}>
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
  const [lifetime, setLifetime] = useState<AchievementStats | null>(null);

  useEffect(() => {
    setUnlocked(loadUnlockedAchievements());
    setLifetime(loadLifetimeStats());
  }, []);

  const total = ACHIEVEMENTS.length;
  const done = unlocked.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ animation: 'iosFadeIn 0.3s ease' }}
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
          style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.7), 0 0 0 0.5px rgba(255,255,255,0.06)' }}
        >
          {/* Header */}
          <div style={{ padding: '20px 16px 16px', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🏆</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#EBEBF5', letterSpacing: '-0.4px', marginBottom: 4 }}>
              Achievements
            </h2>
            <div style={{ fontSize: 13, color: 'rgba(235,235,245,0.55)', marginBottom: 12 }}>
              {done} / {total} unlocked ({pct}%)
            </div>
            {/* Progress bar */}
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  background: 'linear-gradient(90deg, #FFD60A, #FF9F0A)',
                  width: `${pct}%`,
                  transition: 'width 0.6s ease-out',
                  boxShadow: '0 0 8px rgba(255,214,10,0.4)',
                }}
              />
            </div>
          </div>

          {/* Scrollable list */}
          <div style={{ overflowY: 'auto', borderTop: '0.5px solid var(--ios-separator)', flex: 1 }}>
            {ACHIEVEMENTS.map((a) => {
              const isUnlocked = unlocked.includes(a.id);
              return (
                <div
                  key={a.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderTop: '0.5px solid rgba(255,255,255,0.04)',
                    opacity: isUnlocked ? 1 : 0.4,
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: isUnlocked
                        ? 'rgba(255,214,10,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 20,
                      flexShrink: 0,
                      border: isUnlocked ? '0.5px solid rgba(255,214,10,0.3)' : 'none',
                    }}
                  >
                    {a.secret && !isUnlocked ? '❓' : a.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: isUnlocked ? '#EBEBF5' : 'rgba(235,235,245,0.5)', letterSpacing: '-0.23px' }}>
                      {a.secret && !isUnlocked ? '???' : a.title}
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(235,235,245,0.4)', marginTop: 2 }}>
                      {a.secret && !isUnlocked ? 'Secret achievement' : a.desc}
                    </div>
                  </div>
                  {isUnlocked && (
                    <div style={{ fontSize: 16, flexShrink: 0 }}>✅</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div style={{ padding: '14px', borderTop: '0.5px solid var(--ios-separator)', flexShrink: 0 }}>
            <button className="ios-btn-gray" onClick={onClose} style={{ width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
