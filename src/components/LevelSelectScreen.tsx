'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ADVENTURE_LEVELS, TIME_ATTACK_LEVELS, COIN_RUSH_LEVELS, GAUNTLET_LEVELS, type LevelConfig } from '@/game/data/levels';
import { rateLevelDifficulty } from '@/game/level-difficulty';
import { getLevelBiomeIdentity } from '@/game/world/biomes';
import { playUiClick } from '@/game/audio';
import {
  loadProgress,
  type LevelProgress,
  type LevelProgressMap,
} from '@/lib/level-progress';
import ControlsHint from './ControlsHint';
import { Icon, type IconName } from './Icon';

interface Props {
  onLevelSelect: (level: LevelConfig) => void;
  onBack: () => void;
  onEndlessPlay: () => void;
}

/** Local motif mark per level biome (palette itself comes from the
 *  authored registry via getLevelBiomeIdentity — never hardcode colors here). */
const BIOME_ICON: Record<string, IconName> = {
  forest: 'trees',
  desert: 'dunes',
  ice: 'snowflake',
  volcano: 'volcano',
  mixed: 'rainbow',
};

interface BiomeSkin {
  bg: string;
  accent: string;
  icon: IconName;
  stripe: string;
  name: string;
}

/** Card skins keyed by level biome id, derived from the AUTHORED biome
 *  registry — the same BIOMES palette the engine announces via
 *  `dashverse-biome` title cards — so every card previews the biome it
 *  actually runs. Only the motif mark is local. */
const BIOME_COLORS: Record<string, BiomeSkin> = {
  forest: skinFromRegistry('forest'),
  desert: skinFromRegistry('desert'),
  ice: skinFromRegistry('ice'),
  volcano: skinFromRegistry('volcano'),
  mixed: skinFromRegistry('mixed'),
};

function skinFromRegistry(levelBiome: LevelConfig['biome']): BiomeSkin {
  const identity = getLevelBiomeIdentity(levelBiome);
  return {
    bg: `${identity.ground}14`,
    accent: identity.accent,
    stripe: identity.stripe,
    name: identity.name,
    icon: BIOME_ICON[levelBiome] ?? BIOME_ICON.forest,
  };
}

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
      aria-label={`${level.name}, ${biome.name} biome${locked ? ', locked — earn a star on the previous level to unlock' : `, ${prog.stars} of 3 stars`}${isNext ? ', next up' : ''}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={!locked ? { scale: 1.03, y: -2 } : {}}
      whileTap={!locked ? { scale: 0.97 } : {}}
      style={{
        position: 'relative',
        borderRadius: 7,
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
      {/* Authored biome preview — stripe in the registry's ground → platform
          palette (same source as the in-run dashverse-biome title cards). */}
      <div
        aria-hidden="true"
        style={{
          height: 4,
          width: '100%',
          borderRadius: 2,
          background: biome.stripe,
          boxShadow: `0 0 10px ${biome.accent}66`,
          opacity: locked ? 0.15 : 1,
          marginBottom: 2,
        }}
      />

      {/* Background motif — the biome's mark, tinted in its own accent. It
          sits in the card's empty lower corner, clear of the stars and lock. */}
      <Icon
        name={biome.icon}
        size={56}
        strokeWidth={1.75}
        style={{ position: 'absolute', bottom: -10, right: -6, color: biome.accent, opacity: locked ? 0.05 : 0.16, pointerEvents: 'none' }}
      />

      {/* Next-up tag — a lime corner label, clear of the star row below it */}
      {isNext && !locked && (
        <div style={{
          position: 'absolute', top: 0, right: 0, padding: '3px 8px',
          fontSize: 11, fontWeight: 800, letterSpacing: 0.8,
          color: 'var(--dv-ink)', background: 'var(--dv-action)',
          borderRadius: '0 7px 0 8px',
        }}>
          NEXT
        </div>
      )}

      {/* Level number */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
          color: locked ? 'rgba(255,255,255,0.15)' : biome.accent,
        }}>
          {modePrefix ? `${modePrefix}-${level.id % 10}` : `${level.id}`}
        </span>
        {locked ? (
          <span style={{ display: 'inline-flex', opacity: 0.6 }}>
            <Icon name="lock" size={15} />
          </span>
        ) : (
          <div style={{ display: 'flex', gap: 2 }} aria-hidden="true">
            {[1,2,3].map(s => (
              <Icon
                key={s}
                name="star"
                filled
                size={13}
                style={{ color: prog.stars >= s ? 'var(--dv-action)' : 'rgba(255,255,255,0.18)' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: 14, fontWeight: 600, color: locked ? '#a69ab4' : 'var(--dv-text)',
        letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {level.name}
      </div>

      {/* Subtitle */}
      <div style={{ fontSize: 12, color: locked ? '#a69ab4' : 'var(--dv-muted)', lineHeight: 1.3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        {level.mode === 'coin-rush'
          ? `${level.timeLimit}s · ${level.targetCoins} coins`
          : level.mode === 'gauntlet'
            ? `${level.targetKills} KOs`
            : isTimeAttack
              ? `${level.timeLimit}s · ${level.targetDistance}m`
              : `${level.targetDistance}m`}
        {level.boss && (
          <>
            {'·'}
            <Icon name="crown" size={13} strokeWidth={2} style={{ color: locked ? '#a69ab4' : biome.accent }} />
          </>
        )}
      </div>

      {/* Locked — the unlock condition as visible copy. The title tooltip is
          hover-only (never shown on touch devices), and the lock mark alone
          doesn't say HOW, so the condition is also stated on the card
          (kept in sync with the aria-label copy). */}
      {locked && (
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#a69ab4', lineHeight: 1.3,
        }}>
          Earn a star on the previous level to unlock
        </div>
      )}

      {/* Difficulty — know before you go (pure authored-data rating). */}
      {(() => {
        const rating = rateLevelDifficulty(level);
        return (
          <div
            aria-label={`Difficulty ${rating.tier} of 3, ${rating.label.toLowerCase()}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <div style={{ display: 'flex', gap: 3 }}>
              {[1, 2, 3].map(d => (
                <span key={d} style={{
                  width: d === rating.tier ? 10 : 6,
                  height: 5,
                  borderRadius: 3,
                  background: d <= rating.tier ? biome.accent : 'rgba(255,255,255,0.18)',
                  opacity: locked ? 0.15 : 1,
                }} />
              ))}
            </div>
            <span style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 0.8,
              color: locked ? 'rgba(255,255,255,0.15)' : biome.accent,
            }}>
              {rating.label}
            </span>
          </div>
        );
      })()}

      {/* Best score */}
      {prog.bestScore > 0 && (
        <div style={{ fontSize: 12, color: biome.accent, fontWeight: 600, marginTop: 'auto' }}>
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
        border: '1px solid var(--dv-stroke)',
        background: 'linear-gradient(145deg, var(--dv-raised), var(--dv-panel))',
        cursor: 'pointer',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Icon name="infinity" size={72} strokeWidth={1.5} style={{ position: 'absolute', top: -14, right: -12, color: 'var(--dv-violet)', opacity: 0.1 }} />
      <Icon name="infinity" size={40} style={{ color: 'var(--dv-violet)', marginBottom: 10 }} />
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--dv-text)', letterSpacing: '-0.5px' }}>Endless Mode</div>
      <div style={{ fontSize: 14, color: 'var(--dv-muted)', marginTop: 4 }}>Survive as long as you can</div>
      {best > 0 && (
        <div style={{ marginTop: 12, fontSize: 13, color: 'var(--dv-action)', fontWeight: 600 }}>
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

  // Click feedback wrappers — level cards pass through unlocked clicks only
  // (locked cards are disabled), so a sound always means "a run is starting".
  const handleBack = () => {
    playUiClick();
    onBack();
  };
  const handleEndlessPlay = () => {
    playUiClick();
    onEndlessPlay();
  };
  const handlePickLevel = (level: LevelConfig) => {
    playUiClick();
    onLevelSelect(level);
  };

  const tabs: { id: typeof tab; label: string; icon: IconName }[] = [
    { id: 'adventure', label: 'Adventure', icon: 'castle' },
    { id: 'endless', label: 'Endless', icon: 'infinity' },
    { id: 'time-attack', label: 'Time Attack', icon: 'timer' },
    { id: 'coin-rush', label: 'Coin Rush', icon: 'coins' },
    { id: 'gauntlet', label: 'Gauntlet', icon: 'swords' },
  ];

  return (
    <div className="dash-level-select" style={{
      width: '100%', maxWidth: 720, margin: '0 auto', padding: '20px 16px',
      minHeight: '100dvh', clipPath: 'inset(0 -100vmax)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <motion.button
          onClick={handleBack}
          whileTap={{ scale: 0.9 }}
          aria-label="Back to main menu"
          style={{ background: 'var(--dv-panel)', border: '1px solid var(--dv-stroke)', borderRadius: 10, width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--dv-text)' }}
        >
          <Icon name="arrow-left" size={20} />
        </motion.button>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 820, margin: 0, letterSpacing: '-0.5px' }}>Select Level</h1>
          <p style={{ fontSize: 13, color: 'var(--dv-muted)', margin: 0 }}>Choose your challenge</p>
        </div>
        {tab !== 'endless' && (
          <div
            aria-label={`Mode progress: ${starsEarned} of ${starsTotal} stars earned`}
            style={{ marginLeft: 'auto', fontSize: 14, color: 'var(--dv-text)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name="star" filled size={16} style={{ color: 'var(--dv-action)' }} />
            {starsEarned}/{starsTotal}
          </div>
        )}
      </div>

      {/* Continue banner — one obvious next level */}
      {tab !== 'endless' && continueLevel && (
        <motion.button
          onClick={() => handlePickLevel(continueLevel)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          aria-label={`Continue: ${continueLevel.name}`}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 14,
            padding: '14px 18px', marginBottom: 20, borderRadius: 14, cursor: 'pointer',
            border: `1px solid ${(BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).accent}55`,
            background: `linear-gradient(120deg, ${(BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).bg}, var(--dv-panel))`,
            textAlign: 'left',
          }}
        >
          <Icon
            name={(BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).icon}
            size={30}
            strokeWidth={2}
            style={{ color: (BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).accent }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--dv-muted)' }}>
              CONTINUE
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--dv-text)', letterSpacing: '-0.3px' }}>
              {continueLevel.name}
            </div>
          </div>
          <Icon name="play" filled size={22} style={{ color: (BIOME_COLORS[continueLevel.biome] || BIOME_COLORS.forest).accent }} />
        </motion.button>
      )}

      {/* Mode tabs — one opaque ink bar (no frosted backdrop) */}
      <div role="tablist" aria-label="Game modes" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4, marginBottom: 20, background: 'var(--dv-panel)', border: '1px solid var(--dv-stroke)', borderRadius: 12, padding: 4 }}>
        {tabs.map(t => {
          const active = tab === t.id;
          return (
            <motion.button
              key={t.id}
              onClick={() => {
                playUiClick();
                setTab(t.id);
              }}
              whileTap={{ scale: 0.95 }}
              role="tab"
              aria-selected={active}
              aria-label={`${t.label} levels`}
              style={{
                flex: 1, padding: '10px 8px', borderRadius: 10,
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                transition: 'background 0.2s, color 0.2s',
              }}
            >
              <Icon name={t.icon} size={17} /> {t.label}
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {tab === 'endless' ? (
          <motion.div key="endless" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
            <EndlessCard onClick={handleEndlessPlay} />
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
              display: 'flex', alignItems: 'center', gap: 7,
            }}>
              <Icon name={tabs.find(t => t.id === tab)?.icon ?? 'castle'} size={15} />
              {tab === 'adventure' ? 'Adventure Levels' : tab === 'time-attack' ? 'Time Attack Levels' : tab === 'coin-rush' ? 'Coin Rush Levels' : 'Gauntlet Levels'}
            </div>

            {/* Level grid */}
            <div className="dash-level-grid">
              {currentLevels.map((level, i) => {
                const p = levelProgress[level.id];
                return (
                  <LevelCard
                    key={level.id}
                    level={level}
                    prog={p}
                    index={i}
                    isNext={continueLevel?.id === level.id}
                    onClick={() => handlePickLevel(level)}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls preview — what this run will be played with (touch-adaptive:
          canonical touch set on coarse pointers, keyboard map otherwise).
          Always rendered (dismissible={false}) so the level area explains the
          controls before launch, not after. */}
      <ControlsHint dismissible={false} />

      {/* Expose completion handler for parent */}
      <div data-level-complete-handler style={{ display: 'none' }} />
    </div>
  );
};

export default LevelSelectScreen;
export { BIOME_COLORS };
export type { LevelProgress };
