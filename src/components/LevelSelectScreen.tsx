'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ADVENTURE_LEVELS, TIME_ATTACK_LEVELS, COIN_RUSH_LEVELS, GAUNTLET_LEVELS, type LevelConfig } from '@/game/data/levels';
import {
  loadProgress,
  type LevelProgress,
  type LevelProgressMap,
} from '@/lib/level-progress';

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

function ensureDefault(progress: LevelProgressMap, id: number): LevelProgress {
  if (!progress[id]) {
    progress[id] = { stars: 0, bestScore: 0, unlocked: id === 1 || id === 21 || id === 31 || id === 41 };
  }
  return progress[id];
}

const LevelCard: FC<{
  level: LevelConfig;
  prog: LevelProgress;
  onClick: () => void;
  index: number;
  isNext?: boolean;
}> = ({ level, prog, onClick, index, isNext = false }) => {
  const biome = BIOME_COLORS[level.biome] || BIOME_COLORS.forest;
  const isTimeAttack = level.mode === 'time-attack';
  const modePrefix = level.mode === 'time-attack' ? 'TA' : level.mode === 'coin-rush' ? 'CR' : level.mode === 'gauntlet' ? 'GX' : '';
  const locked = !prog.unlocked;

  return (
    <motion.button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      title={locked ? 'Earn at least 1 star on the previous level to unlock' : undefined}
      aria-label={`${level.name}${locked ? ', locked — earn a star on the previous level to unlock' : `, ${prog.stars} of 3 stars`}${isNext ? ', next up' : ''}`}
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
        background: locked ? 'rgba(14,17,26,0.9)' : `linear-gradient(145deg, ${biome.bg}, rgba(14,17,26,0.92))`,
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

      {/* Next-up badge */}
      {isNext && !locked && (
        <div style={{
          position: 'absolute', top: 6, right: 8, fontSize: 8, fontWeight: 800,
          letterSpacing: 0.8, color: biome.accent, opacity: 0.9,
        }}>
          NEXT
        </div>
      )}

      {/* Level number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
          color: locked ? 'rgba(255,255,255,0.15)' : biome.accent,
        }}>
          {modePrefix ? `${modePrefix}-${level.id % 10}` : `${level.id}`}
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
        {level.mode === 'coin-rush'
          ? `${level.timeLimit}s · ${level.targetCoins} coins`
          : level.mode === 'gauntlet'
            ? `${level.targetKills} KOs`
            : isTimeAttack
              ? `${level.timeLimit}s · ${level.targetDistance}m`
              : `${level.targetDistance}m`}
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
        background: 'linear-gradient(145deg, rgba(10,132,255,0.26), rgba(20,23,38,0.94))',
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
  const [tab, setTab] = useState<'adventure' | 'endless' | 'time-attack' | 'coin-rush' | 'gauntlet'>('adventure');
  const [progress, setProgress] = useState<Record<number, LevelProgress>>({});

  useEffect(() => { setProgress(loadProgress()); }, []);

  const currentLevels = useMemo(() => {
    if (tab === 'adventure') return ADVENTURE_LEVELS;
    if (tab === 'time-attack') return TIME_ATTACK_LEVELS;
    if (tab === 'coin-rush') return COIN_RUSH_LEVELS;
    if (tab === 'gauntlet') return GAUNTLET_LEVELS;
    return [];
  }, [tab]);

  const levelProgress = useMemo(() => {
    const map: Record<number, LevelProgress> = {};
    for (const level of currentLevels) ensureDefault(map, level.id);
    // Overlay saved progress (copy so we never mutate loaded state)
    for (const id of Object.keys(map)) {
      const saved = progress[Number(id)];
      if (saved) map[Number(id)] = saved;
    }
    return map;
  }, [currentLevels, progress]);

  /** The level the player should continue on: first unlocked level that
   *  isn't fully starred, falling back to the last unlocked level. */
  const continueLevel = useMemo(() => {
    if (!currentLevels.length) return null;
    let fallback: LevelConfig | null = null;
    for (const level of currentLevels) {
      const p = levelProgress[level.id];
      if (p?.unlocked) {
        fallback = level;
        if (p.stars < 3) return level;
      }
    }
    return fallback;
  }, [currentLevels, levelProgress]);

  const starsEarned = useMemo(
    () => currentLevels.reduce((sum, l) => sum + (levelProgress[l.id]?.stars ?? 0), 0),
    [currentLevels, levelProgress],
  );
  const starsTotal = currentLevels.length * 3;

  const tabs = [
    { id: 'adventure' as const, label: 'Adventure', icon: '🏰' },
    { id: 'endless' as const, label: 'Endless', icon: '♾️' },
    { id: 'time-attack' as const, label: 'Time Attack', icon: '⏱️' },
    { id: 'coin-rush' as const, label: 'Coin Rush', icon: '🪙' },
    { id: 'gauntlet' as const, label: 'Gauntlet', icon: '⚔️' },
  ];

  return (
    <div style={{
      width: '100%', maxWidth: 600, margin: '0 auto', padding: '20px 16px',
      color: '#fff', fontFamily: '-apple-system, system-ui, sans-serif',
      minHeight: '100vh',
      background: 'radial-gradient(circle at 15% 8%, rgba(255,45,149,0.2), transparent 38%), radial-gradient(circle at 90% 22%, rgba(0,229,255,0.16), transparent 42%), linear-gradient(145deg, #070314, #11172c 48%, #18071d)',
      boxShadow: '0 0 0 100vmax rgba(3,6,14,0.94)',
      clipPath: 'inset(0 -100vmax)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.9 }}
          aria-label="Back to main menu"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 18 }}
        >
          ←
        </motion.button>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>Select Level</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: 0 }}>Choose your challenge</p>
        </div>
        {tab !== 'endless' && (
          <div
            aria-label={`Mode progress: ${starsEarned} of ${starsTotal} stars earned`}
            style={{ marginLeft: 'auto', fontSize: 13, color: 'rgba(255,255,255,0.55)', whiteSpace: 'nowrap' }}
          >
            ⭐ {starsEarned}/{starsTotal}
          </div>
        )}
      </div>

      {/* Continue banner — one obvious next level */}
      {tab !== 'endless' && continueLevel && (
        <motion.button
          onClick={() => onLevelSelect(continueLevel)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          aria-label={`Continue: ${continueLevel.name}`}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 18px', marginBottom: 20, borderRadius: 14, cursor: 'pointer',
            border: `1px solid ${(BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).accent}55`,
            background: `linear-gradient(120deg, ${(BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).bg}, rgba(13,16,26,0.9))`,
            textAlign: 'left',
          }}
        >
          <div style={{ fontSize: 24 }}>{(BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).emoji}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
              CONTINUE
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#fff', letterSpacing: '-0.3px' }}>
              {continueLevel.name}
            </div>
          </div>
          <div style={{ fontSize: 22, color: (BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).accent }}>▶</div>
        </motion.button>
      )}

      {/* Mode tabs */}
      <div role="tablist" aria-label="Game modes" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 20, background: 'rgba(13,16,26,0.82)', borderRadius: 12, padding: 4, backdropFilter: 'blur(18px)' }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => setTab(t.id)}
              whileTap={{ scale: 0.95 }}
              role="tab"
              aria-selected={active}
              aria-label={`${t.label} levels`}
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
              {tab === 'adventure' ? '🏰 Adventure Levels' : tab === 'time-attack' ? '⏱️ Time Attack Levels' : tab === 'coin-rush' ? '🪙 Coin Rush Levels' : '⚔️ Gauntlet Levels'}
            </div>

            {/* Level grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {currentLevels.map((level, i) => {
                const p = levelProgress[level.id];
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    prog={p}
                    index={i}
                    isNext={continueLevel?.id === level.id}
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
export { BIOME_COLORS };
export type { LevelProgress };
