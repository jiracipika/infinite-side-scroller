'use client';

import { useState, useEffect, type FC } from 'react';
import { useGameStore } from './GameStore';

interface Props {
  onPlay: (seed?: number) => void;
}

const StartScreen: FC<Props> = ({ onPlay }) => {
  const { stats } = useGameStore();
  const [seedInput, setSeedInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [mounted, setMounted] = useState(false);

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
      <div
        className="flex flex-col items-center w-full"
        style={{
          maxWidth: 360,
          padding: '0 16px',
          animation: mounted ? 'iosSpringIn 0.55s cubic-bezier(0.34,1.56,0.64,1) both' : 'none',
        }}
      >
        {/* ── App Icon + Title ─────────────────────────────── */}
        <div className="flex flex-col items-center" style={{ marginBottom: 32 }}>
          <AppIcon />
          <h1
            className="ios-large-title"
            style={{ marginTop: 14, animation: 'iosGlow 5s ease-in-out infinite' }}
          >
            Infinite
          </h1>
          <p
            className="ios-caption2"
            style={{ marginTop: 4, letterSpacing: '0.22em', textTransform: 'uppercase' }}
          >
            Side Scroller
          </p>
        </div>

        {/* ── High Score pill ──────────────────────────────── */}
        {stats.highScore > 0 && (
          <div
            className="ios-hud-pill"
            style={{ marginBottom: 20, gap: 6, animation: 'iosFadeIn 0.4s ease 0.15s both' }}
          >
            <StarIcon />
            <span className="ios-footnote" style={{ color: 'var(--ios-label2)' }}>Best</span>
            <span
              className="ios-footnote"
              style={{ color: 'var(--ios-label)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
            >
              {stats.highScore.toLocaleString()}
            </span>
          </div>
        )}

        {/* ── Play button ──────────────────────────────────── */}
        <div style={{ width: '100%', marginBottom: 10 }}>
          <button className="ios-btn-primary" onClick={handlePlay}>
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
            <button
              className="ios-btn-secondary"
              onClick={() => setShowSettings((s) => !s)}
              style={{ height: 40, fontSize: 15 }}
            >
              {showSettings ? 'Hide Settings' : 'Settings'}
            </button>
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
      <p
        className="ios-caption2"
        style={{
          position: 'absolute',
          bottom: 28,
          letterSpacing: '0.05em',
          color: 'var(--ios-label4)',
        }}
      >
        WASD · Space to jump · Esc to pause
      </p>
    </div>
  );
};

export default StartScreen;

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

const AppIcon: FC = () => (
  <div
    style={{
      width: 88,
      height: 88,
      borderRadius: 20,
      background: 'linear-gradient(150deg, #0A1628 0%, #0D1F3C 50%, #0A2240 100%)',
      boxShadow: '0 8px 28px rgba(0,0,0,0.55), 0 0 0 0.5px rgba(255,255,255,0.08)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: 46,
      lineHeight: 1,
    }}
  >
    ∞
  </div>
);

const StarIcon: FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--ios-yellow)">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);
