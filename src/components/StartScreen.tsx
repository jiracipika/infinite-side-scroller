'use client';

import { useState, useEffect, useMemo, type FC } from 'react';
import { useGameStore } from './GameStore';
import { CHARACTERS, saveSelectedCharacter, loadSelectedCharacter } from '@/game/data/characters';
import AchievementsModal from './AchievementsModal';
import ACHIEVEMENTS, { loadUnlockedAchievements } from '@/lib/achievements';

interface Props {
  onPlay: (seed?: number) => void;
  onPlayMultiplayer?: (params: { mode: 'host' | 'join'; roomId?: string; playerName: string; seed?: number }) => void;
}

const StartScreen: FC<Props> = ({ onPlay, onPlayMultiplayer }) => {
  const { stats } = useGameStore();
  const [seedInput, setSeedInput] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [playerName, setPlayerName] = useState('Player');
  const [roomCode, setRoomCode] = useState('');
  const [mpError, setMpError] = useState('');
  const [showAchievements, setShowAchievements] = useState(false);
  const [achieveCount, setAchieveCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [selectedChar, setSelectedChar] = useState('knight');

  useEffect(() => {
    setAchieveCount(loadUnlockedAchievements().length);
  }, []);

  useEffect(() => {
    setSelectedChar(loadSelectedCharacter());
  }, []);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handlePlay = () => {
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    onPlay(seed);
  };

  const handleHostMultiplayer = () => {
    if (!onPlayMultiplayer) return;
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    const safeName = playerName.trim().slice(0, 20);
    if (!safeName) {
      setMpError('Enter a player name');
      return;
    }
    setMpError('');
    onPlayMultiplayer({ mode: 'host', playerName: safeName, seed });
  };

  const handleJoinMultiplayer = () => {
    if (!onPlayMultiplayer) return;
    const safeName = playerName.trim().slice(0, 20);
    const code = roomCode.trim().toUpperCase();
    if (!safeName) {
      setMpError('Enter a player name');
      return;
    }
    if (code.length < 4) {
      setMpError('Enter a valid room code');
      return;
    }
    setMpError('');
    onPlayMultiplayer({ mode: 'join', roomId: code, playerName: safeName });
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

        {/* ── Character Select ──────────────────────────────── */}
        <div
          className="ios-card"
          style={{ width: '100%', marginBottom: 10, animation: 'iosFadeIn 0.4s ease 0.1s both', overflow: 'hidden' }}
        >
          {/* Selected character preview + stats */}
          {(() => {
            const sel = CHARACTERS.find(c => c.id === selectedChar) ?? CHARACTERS[0];
            return (
              <div style={{
                padding: '12px 12px 0',
                display: 'flex',
                gap: 12,
                alignItems: 'flex-start',
              }}>
                {/* Big character avatar */}
                <div style={{
                  width: 52,
                  height: 64,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${sel.bodyColor}dd, ${sel.bodyColor})`,
                  border: `2px solid ${sel.outlineColor}`,
                  boxShadow: `0 4px 16px ${sel.bodyColor}44, inset 0 1px 0 rgba(255,255,255,0.15)`,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Eyes */}
                  <div style={{ display: 'flex', gap: 4, marginTop: -4 }}>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: sel.eyeColor }} />
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: sel.eyeColor }} />
                  </div>
                  {/* Shine */}
                  <div style={{
                    position: 'absolute', top: 4, left: 4, width: 14, height: 20,
                    background: 'linear-gradient(135deg, rgba(255,255,255,0.25), transparent)',
                    borderRadius: 6,
                  }} />
                </div>
                {/* Name, desc, stats */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span className="ios-row-label" style={{ fontSize: 15, fontWeight: 700 }}>{sel.name}</span>
                    <span className="ios-caption2" style={{ color: 'var(--ios-label3)' }}>{sel.description}</span>
                  </div>
                  {/* Mini stat bars */}
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <StatBar label="SPD" value={sel.speed} color="var(--ios-tint)" />
                    <StatBar label="JMP" value={sel.jumpVelocity} color="var(--ios-green)" />
                    <StatBar label="HP" value={sel.maxHealth / 5} color="var(--ios-red)" />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Character tabs */}
          <div style={{
            display: 'flex',
            gap: 0,
            padding: '8px 8px 10px',
          }}>
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                onClick={() => { setSelectedChar(c.id); saveSelectedCharacter(c.id); }}
                style={{
                  flex: 1,
                  padding: '8px 2px 6px',
                  borderRadius: 0,
                  border: 'none',
                  background: 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Active indicator dot */}
                {selectedChar === c.id && (
                  <div style={{
                    position: 'absolute', top: 0, left: '25%', right: '25%',
                    height: 2, borderRadius: 1,
                    background: c.bodyColor,
                    boxShadow: `0 0 8px ${c.bodyColor}88`,
                  }} />
                )}
                <div style={{
                  width: 20,
                  height: 24,
                  borderRadius: 5,
                  background: c.bodyColor,
                  border: `1.5px solid ${c.outlineColor}`,
                  opacity: selectedChar === c.id ? 1 : 0.45,
                  transform: selectedChar === c.id ? 'scale(1.1)' : 'scale(1)',
                  transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: selectedChar === c.id ? `0 2px 10px ${c.bodyColor}55` : 'none',
                }} />
                <span className="ios-caption2" style={{
                  color: selectedChar === c.id ? 'var(--ios-label)' : 'var(--ios-label3)',
                  fontWeight: selectedChar === c.id ? 700 : 400,
                  fontSize: 10,
                  transition: 'all 0.15s ease',
                }}>
                  {c.name}
                </span>
              </button>
            ))}
          </div>
        </div>

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

            <div style={{ marginTop: 8 }}>
              <button
                className="ios-btn-secondary"
                onClick={() => setShowMultiplayer((v) => !v)}
                style={{ height: 40, fontSize: 15, width: '100%' }}
              >
                {showMultiplayer ? 'Hide Multiplayer' : 'Multiplayer (Same Wi-Fi)'}
              </button>
            </div>
          </div>
        </div>

        {showMultiplayer && (
          <div
            className="ios-card"
            style={{ width: '100%', marginTop: 10, padding: 10, animation: 'iosSlideDown 0.24s ease both' }}
          >
            <p className="ios-section-header" style={{ padding: '0 2px 8px' }}>Nearby Multiplayer</p>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="ios-text-field"
              style={{ height: 38, fontSize: 14, marginBottom: 8 }}
              maxLength={20}
            />
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
              placeholder="Room Code (join only)"
              className="ios-text-field"
              style={{ height: 38, fontSize: 14, marginBottom: 8 }}
              maxLength={8}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="ios-btn-primary" style={{ height: 40, fontSize: 14, flex: 1 }} onClick={handleHostMultiplayer}>
                Host Room
              </button>
              <button className="ios-btn-secondary" style={{ height: 40, fontSize: 14, flex: 1 }} onClick={handleJoinMultiplayer}>
                Join Room
              </button>
            </div>
            {mpError && (
              <p className="ios-caption2" style={{ color: '#f87171', marginTop: 8, paddingLeft: 4 }}>{mpError}</p>
            )}
          </div>
        )}

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

/* ── Stat bar for character select ───────────────────────────── */

const StatBar: FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const pct = Math.min(100, Math.round(value * 100));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span className="ios-caption2" style={{ color: 'var(--ios-label3)', width: 24, fontSize: 9, letterSpacing: '0.04em' }}>{label}</span>
      <div style={{
        flex: 1,
        height: 4,
        borderRadius: 2,
        background: 'var(--ios-fill3)',
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 2,
          background: color,
          transition: 'width 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          boxShadow: `0 0 6px ${color}44`,
        }} />
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
