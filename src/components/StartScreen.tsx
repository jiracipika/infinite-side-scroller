'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useGameStore } from './GameStore';
import AchievementsModal from './AchievementsModal';
import ACHIEVEMENTS, { loadUnlockedAchievements } from '@/lib/achievements';

interface Props {
  onPlay: (seed?: number) => void;
}

const StartScreen: FC<Props> = ({ onPlay }) => {
  const { stats } = useGameStore();
  const [seedInput, setSeedInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [achieveCount, setAchieveCount] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setAchieveCount(loadUnlockedAchievements().length);
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handlePlay = () => {
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    onPlay(seed);
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center ios-overlay"
      style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.35s ease' }}
    >
      {/* Background star field */}
      <StarField />

      <div
        className="flex flex-col items-center w-full"
        style={{
          maxWidth: 360,
          padding: '0 16px',
          position: 'relative',
          zIndex: 1,
          animation: mounted ? 'iosSpringIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
        }}
      >
        {/* ── App Icon + Title ─────────────────────────────── */}
        <div className="flex flex-col items-center" style={{ marginBottom: 28 }}>
          <AppIcon />
          <h1
            className="ios-large-title"
            style={{ marginTop: 16, animation: 'iosGlow 5s ease-in-out infinite' }}
          >
            Infinite
          </h1>
          <p
            className="ios-caption2"
            style={{
              marginTop: 5,
              letterSpacing: '0.28em',
              textTransform: 'uppercase',
              color: 'rgba(235,235,245,0.35)',
            }}
          >
            Side Scroller
          </p>
        </div>

        {/* ── High Score pill ──────────────────────────────── */}
        {stats.highScore > 0 && (
          <div
            className="ios-hud-pill"
            style={{ marginBottom: 22, gap: 6, animation: 'iosFadeIn 0.4s ease 0.15s both' }}
          >
            <StarIcon />
            <span className="ios-footnote" style={{ color: 'var(--ios-label3)' }}>Best</span>
            <span
              className="ios-footnote"
              style={{ color: 'var(--ios-label)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
            >
              {stats.highScore.toLocaleString()}
            </span>
          </div>
        )}

        {/* ── Play button ──────────────────────────────────── */}
        <div style={{ width: '100%', marginBottom: 10 }}>
          <button
            className="ios-btn-primary ios-btn-shimmer"
            onClick={handlePlay}
            style={{ fontSize: 18, letterSpacing: '-0.3px' }}
          >
            Play
          </button>
        </div>

        {/* ── Secondary card: seed + settings ─────────────── */}
        <div className="ios-card" style={{ width: '100%' }}>
          <div style={{ padding: '10px 10px 10px' }}>
            <input
              type="text"
              inputMode="numeric"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="World Seed (optional)"
              className="ios-text-field"
              style={{ height: 40, fontSize: 15, marginBottom: 8 }}
              onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="ios-btn-secondary"
                onClick={() => setShowAchievements(true)}
                style={{ height: 40, fontSize: 15, flex: 1 }}
              >
                🏆 {achieveCount}/{ACHIEVEMENTS.length}
              </button>
              <button
                className="ios-btn-secondary"
                onClick={() => setShowSettings((s) => !s)}
                style={{ height: 40, fontSize: 15, flex: 1 }}
              >
                {showSettings ? 'Hide Settings' : 'Settings'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Settings panel ───────────────────────────────── */}
        {showSettings && (
          <div
            style={{ width: '100%', marginTop: 10, animation: 'iosSlideDown 0.32s cubic-bezier(0.34,1.56,0.64,1) both' }}
          >
            <SettingsPanel />
          </div>
        )}
      </div>

      {/* ── Keyboard hint ────────────────────────────────────── */}
      <KeyboardHint />

      {/* ── Achievements modal ── */}
      {showAchievements && <AchievementsModal onClose={() => { setShowAchievements(false); setAchieveCount(loadUnlockedAchievements().length); }} />}
    </div>
  );
};

export default StartScreen;

/* ── Star field background ────────────────────────────────────── */

const StarField: FC = () => {
  // Golden-ratio distribution for even spacing, no JS randomness needed
  const stars = useMemo(() =>
    Array.from({ length: 38 }, (_, i) => ({
      x: ((i * 137.508) % 100).toFixed(3),
      y: ((i * 61.803) % 100).toFixed(3),
      size: 0.9 + (i % 4) * 0.55,
      delay: ((i * 0.618) % 3.5).toFixed(2),
      duration: (1.6 + (i % 5) * 0.7).toFixed(2),
    })), []);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: 0 }}
    >
      {stars.map((star, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: star.size,
            height: star.size,
            borderRadius: '50%',
            background: 'white',
            opacity: 0,
            animation: `starTwinkle ${star.duration}s ease-in-out ${star.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
};

/* ── App icon with ambient glow ring ─────────────────────────── */

const AppIcon: FC = () => (
  <div style={{ position: 'relative', width: 88, height: 88 }}>
    {/* Expanding glow ring */}
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: 22,
        background: 'rgba(0,122,255,0.18)',
        animation: 'ringExpand 3.2s ease-out 0.4s infinite',
        pointerEvents: 'none',
      }}
    />
    {/* Ambient soft glow */}
    <div
      style={{
        position: 'absolute',
        inset: -14,
        borderRadius: 36,
        background: 'radial-gradient(circle, rgba(0,122,255,0.18) 0%, transparent 70%)',
        animation: 'iconAmbient 3.6s ease-in-out infinite',
        pointerEvents: 'none',
      }}
    />
    {/* App icon face */}
    <div
      style={{
        position: 'relative',
        width: 88,
        height: 88,
        borderRadius: 20,
        background: 'linear-gradient(148deg, #0C1A30 0%, #0E2244 55%, #091C38 100%)',
        boxShadow: '0 10px 32px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(255,255,255,0.09), 0 1px 0 rgba(255,255,255,0.06) inset',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 46,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      ∞
    </div>
  </div>
);

/* ── Keyboard hint with key caps ─────────────────────────────── */

const KeyboardHint: FC = () => (
  <div
    style={{
      position: 'absolute',
      bottom: 28,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      flexWrap: 'wrap',
      justifyContent: 'center',
      padding: '0 24px',
      animation: 'iosFadeIn 0.5s ease 0.5s both',
      opacity: 0,
    }}
  >
    <span className="ios-keycap">W</span>
    <span className="ios-keycap">A</span>
    <span className="ios-keycap">S</span>
    <span className="ios-keycap">D</span>
    <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.22)', letterSpacing: '0.04em', margin: '0 2px' }}>·</span>
    <span className="ios-keycap">Space</span>
    <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.22)', letterSpacing: '0.04em', margin: '0 2px' }}>to jump</span>
    <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.22)', letterSpacing: '0.04em', margin: '0 2px' }}>·</span>
    <span className="ios-keycap">Esc</span>
    <span style={{ fontSize: 10, color: 'rgba(235,235,245,0.22)', letterSpacing: '0.04em', margin: '0 2px' }}>to pause</span>
  </div>
);

/* ── Settings Panel ──────────────────────────────────────────── */

const SettingsPanel: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <div>
      <p className="ios-section-header">Settings</p>
      <div className="ios-card">
        <SliderRow
          label="Master Volume"
          value={settings.masterVolume}
          onChange={(v) => setSettings({ masterVolume: v })}
        />
        <SliderRow
          label="SFX"
          value={settings.sfxVolume}
          onChange={(v) => setSettings({ sfxVolume: v })}
        />
        <SliderRow
          label="Music"
          value={settings.musicVolume}
          onChange={(v) => setSettings({ musicVolume: v })}
        />
        <ToggleRow
          label="Show FPS"
          value={settings.showFPS}
          onChange={(v) => setSettings({ showFPS: v })}
        />
        <ToggleRow
          label="Reduced Particles"
          value={settings.reducedParticles}
          onChange={(v) => setSettings({ reducedParticles: v })}
        />
      </div>
    </div>
  );
};

/* ── Shared row components ────────────────────────────────────── */

const SliderRow: FC<{ label: string; value: number; onChange: (v: number) => void }> = ({
  label, value, onChange,
}) => (
  <div
    className="ios-row"
    style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8, paddingTop: 13, paddingBottom: 13 }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span className="ios-row-label">{label}</span>
      <span
        className="ios-footnote"
        style={{ fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
    <input
      type="range" min="0" max="1" step="0.05"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
    />
  </div>
);

const ToggleRow: FC<{ label: string; value: boolean; onChange: (v: boolean) => void }> = ({
  label, value, onChange,
}) => (
  <div className="ios-row">
    <span className="ios-row-label">{label}</span>
    <IOSToggle checked={value} onChange={onChange} />
  </div>
);

const IOSToggle: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    className="ios-toggle-track"
    onClick={() => onChange(!checked)}
    style={{ background: checked ? 'var(--ios-green)' : 'var(--ios-fill)' }}
    role="switch"
    aria-checked={checked}
  >
    <div
      className="ios-toggle-thumb"
      style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
    />
  </button>
);

/* ── Decorative icons ─────────────────────────────────────────── */

const StarIcon: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--ios-yellow)">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
