'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ADVENTURE_LEVELS, TIME_ATTACK_LEVELS, type LevelConfig } from '@/game/data/levels';

interface LevelProgress {
  stars: number;       // 0-3
  bestScore: number;
  unlocked: boolean;
}

interface Props {
  onLevelSelect: (level: LevelConfig) => void;
  onBack: () => void;
  onEndlessPlay: () => void;
}

const BIOME_COLORS: Record<string, { bg: string; accent: string; emoji: string }> = {
  forest:  { bg: 'rgba(48,209,88,0.08)',  accent: '#30D158', emoji: '🌲' },
  desert:  { bg: 'rgba(255,159,10,0.08)', accent: '#FF9F0A', emoji: '🏜️' },
  ice:     { bg: 'rgba(90,200,250,0.08)',  accent: '#5AC8FA', emoji: '❄️' },
  volcano: { bg: 'rgba(255,69,58,0.08)',   accent: '#FF453A', emoji: '🌋' },
  mixed:   { bg: 'rgba(191,90,242,0.08)',  accent: '#BF5AF2', emoji: '🌈' },
};

const STORAGE_KEY = 'iss-level-progress';

function loadProgress(): Record<number, LevelProgress> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProgress(data: Record<number, LevelProgress>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

function ensureDefault(progress: Record<number, LevelProgress>, id: number): LevelProgress {
  if (!progress[id]) {
    progress[id] = { stars: 0, bestScore: 0, unlocked: id === 1 || id === 21 };
  }
  return progress[id];
}

const LevelCard: FC<{
  level: LevelConfig;
  prog: LevelProgress;
  onClick: () => void;
  index: number;
}> = ({ level, prog, onClick, index }) => {
  const biome = BIOME_COLORS[level.biome] || BIOME_COLORS.forest;
  const isTimeAttack = level.mode === 'time-attack';
  const locked = !prog.unlocked;

  return (
    <motion.button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={!locked ? { scale: 1.03, y: -2 } : {}}
      whileTap={!locked ? { scale: 0.97 } : {}}
      style={{
        position: 'relative',
        borderRadius: 14,
        padding: '14px 12px',
        border: locked ? '1px solid rgba(255,255,255,0.04)' : `1px solid ${biome.accent}25`,
        background: locked ? 'rgba(255,255,255,0.02)' : `linear-gradient(145deg, ${biome.bg}, transparent)`,
        cursor: locked ? 'default' : 'pointer',
        textAlign: 'left',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minWidth: 0,
      }}
    >
      {/* Background emoji */}
      <div style={{ position: 'absolute', top: -4, right: -4, fontSize: 36, opacity: locked ? 0.03 : 0.08, pointerEvents: 'none' }}>
        {biome.emoji}
      </div>

      {/* Level number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
          color: locked ? 'rgba(255,255,255,0.15)' : biome.accent,
        }}>
          {isTimeAttack ? `TA-${level.id - 20}` : `${level.id}`}
        </span>
        {locked ? (
          <span style={{ fontSize: 14, opacity: 0.2 }}>🔒</span>
        ) : (
          <div style={{ display: 'flex', gap: 2 }}>
            {[1,2,3].map(s => (
              <span key={s} style={{ fontSize: 10, opacity: prog.stars >= s ? 1 : 0.15 }}>
                ⭐
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 13, fontWeight: 600, color: locked ? 'rgba(255,255,255,0.15)' : '#fff',
        letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {level.name}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 10, color: locked ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)', lineHeight: 1.3 }}>
        {isTimeAttack ? `${level.timeLimit}s · ${level.targetDistance}m` : `${level.targetDistance}m`}
        {level.boss && ' · 👑'}
      </div>

      {/* Best score */}
      {prog.bestScore > 0 && (
        <div style={{ fontSize: 10, color: biome.accent, fontWeight: 600, marginTop: 'auto' }}>
          Best: {prog.bestScore}
        </div>
      )}
    </motion.button>
  );
};

const EndlessCard: FC<{ onClick: () => void }> = ({ onClick }) => {
  const [best, setBest] = useState(0);
  useEffect(() => {
    try { setBest(parseInt(localStorage.getItem('iss-high-score') || '0', 10)); } catch {}
  }, []);

  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05, duration: 0.4 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      style={{
        width: '100%',
        borderRadius: 16,
        padding: 24,
        border: '1px solid rgba(10,132,255,0.2)',
        background: 'linear-gradient(145deg, rgba(10,132,255,0.12), rgba(94,92,230,0.06))',
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -10, right: -10, fontSize: 64, opacity: 0.06 }}>♾️</div>
      <div style={{ fontSize: 40, marginBottom: 8 }}>♾️</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', letterSpacing: '-0.5px' }}>Endless Mode</div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>Survive as long as you can</div>
      {best > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#0A84FF', fontWeight: 600 }}>
          High Score: {best}
        </div>
      )}
    </motion.button>
  );
};

const LevelSelectScreen: FC<Props> = ({ onLevelSelect, onBack, onEndlessPlay }) => {
  const [tab, setTab] = useState<'adventure' | 'endless' | 'time-attack'>('adventure');
  const [progress, setProgress] = useState<Record<number, LevelProgress>>({});

  useEffect(() => { setProgress(loadProgress()); }, []);

  const currentLevels = useMemo(() => {
    if (tab === 'adventure') return ADVENTURE_LEVELS;
    if (tab === 'time-attack') return TIME_ATTACK_LEVELS;
    return [];
  }, [tab]);

  const tabs = [
    { id: 'adventure' as const, label: 'Adventure', icon: '🏰' },
    { id: 'endless' as const, label: 'Endless', icon: '♾️' },
    { id: 'time-attack' as const, label: 'Time Attack', icon: '⏱️' },
  ];

  return (
    <div style={{
      width: '100%', maxWidth: 600, margin: '0 auto', padding: '20px 16px',
      color: '#fff', fontFamily: '-apple-system, system-ui, sans-serif',
      minHeight: '100vh',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
        >
          ←
        </motion.button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Select Level</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Choose your challenge</p>
        </div>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 4 }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => setTab(t.id)}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                border: 'none', cursor: 'pointer', color: active ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              <span>{t.icon}</span> {t.label}
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'endless' ? (
          <motion.div key="endless" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <EndlessCard onClick={onEndlessPlay} />
          </motion.div>
        ) : (
          <motion.div
            key={tab}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
          >
            {/* World header */}
            <div style={{
              fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5,
              color: tab === 'adventure' ? BIOME_COLORS.forest.accent : BIOME_COLORS.mixed.accent,
              marginBottom: 12, paddingLeft: 4,
            }}>
              {tab === 'adventure' ? '🏰 Adventure Levels' : '⏱️ Time Attack Levels'}
            </div>

            {/* Level grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {currentLevels.map((level, i) => {
                const p = ensureDefault({ ...progress }, level.id);
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    prog={p}
                    index={i}
                    onClick={() => onLevelSelect(level)}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expose completion handler for parent */}
      <div data-level-complete-handler style={{ display: 'none' }} />
    </div>
  );
};

export default LevelSelectScreen;
export { loadProgress, saveProgress, ensureDefault, STORAGE_KEY, BIOME_COLORS };
export type { LevelProgress };
