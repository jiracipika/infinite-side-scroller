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
  const [visible, setVisible] = useState(false);
  const [titleVisible, setTitleVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    setTimeout(() => setTitleVisible(true), 200);
  }, []);

  const handlePlay = () => {
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    onPlay(seed);
  };

  return (
    <div className={`absolute inset-0 flex items-center justify-center transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop with subtle radial gradient */}
      <div className="absolute inset-0 bg-black/50" />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 30%, rgba(59,130,246,0.08) 0%, transparent 60%)',
      }} />

      {/* Main panel */}
      <div className="relative z-10 flex flex-col items-center gap-10 px-6 animate-[fadeSlideUp_0.7s_ease-out]">
        {/* Title */}
        <div className={`text-center transition-all duration-700 ${titleVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
          <h1
            className="text-5xl sm:text-7xl font-bold text-white tracking-tight leading-none"
            style={{ animation: 'titleGlow 4s ease-in-out infinite' }}
          >
            Infinite
          </h1>
          <h2 className="text-lg sm:text-xl font-light text-white/40 tracking-[0.3em] uppercase mt-2">
            Side Scroller
          </h2>
          {/* Decorative line */}
          <div className="mx-auto mt-4 w-12 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        </div>

        {/* Glass card */}
        <div className="glass-panel-strong w-full max-w-sm p-8 flex flex-col items-center gap-6">
          {/* High Score */}
          {stats.highScore > 0 && (
            <div className="flex items-center gap-2 animate-[fadeIn_0.5s_ease-out_0.3s_both]">
              <span className="text-yellow-400/70 text-sm">✦</span>
              <span className="text-xs text-white/30 uppercase tracking-widest">Best Score</span>
              <span className="text-sm text-yellow-400/90 font-semibold tabular-nums ml-1">
                {stats.highScore.toLocaleString()}
              </span>
            </div>
          )}

          {/* Buttons */}
          <div className="flex flex-col items-center gap-3 w-full">
            <button
              onClick={handlePlay}
              className="glass-btn w-full py-3.5 px-8 text-lg"
            >
              Play
            </button>

            {/* Seed input */}
            <div className="relative w-full animate-[fadeIn_0.4s_ease-out_0.2s_both]">
              <input
                type="text"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="World seed (optional)"
                className="glass-input"
                onKeyDown={(e) => e.key === 'Enter' && handlePlay()}
              />
            </div>

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="glass-btn-secondary w-full py-2.5 px-8"
            >
              Settings
            </button>
          </div>

          {/* Settings panel */}
          {showSettings && <SettingsPanel />}
        </div>

        {/* Controls hint */}
        <p className="text-[11px] text-white/20 mt-1 tracking-wide">
          WASD · Arrows to move · Space to jump · Esc to pause
        </p>
      </div>
    </div>
  );
};

export default StartScreen;

const SettingsPanel: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <div className="w-full glass-panel p-5 space-y-4 animate-[fadeScaleIn_0.3s_ease-out] mt-1">
      <h3 className="text-[11px] font-semibold text-white/40 uppercase tracking-[0.15em]">Settings</h3>

      <SliderSetting
        label="Master Volume"
        value={settings.masterVolume}
        onChange={(v) => setSettings({ masterVolume: v })}
      />
      <SliderSetting
        label="SFX"
        value={settings.sfxVolume}
        onChange={(v) => setSettings({ sfxVolume: v })}
      />
      <SliderSetting
        label="Music"
        value={settings.musicVolume}
        onChange={(v) => setSettings({ musicVolume: v })}
      />

      <div className="flex items-center justify-between pt-1">
        <span className="text-sm text-white/40">Show FPS</span>
        <Toggle checked={settings.showFPS} onChange={(v) => setSettings({ showFPS: v })} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-white/40">Reduced Particles</span>
        <Toggle checked={settings.reducedParticles} onChange={(v) => setSettings({ reducedParticles: v })} />
      </div>
    </div>
  );
};

const SliderSetting: FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/40">{label}</span>
      <span className="text-[11px] text-white/25 tabular-nums w-8 text-right">{Math.round(value * 100)}%</span>
    </div>
    <input
      type="range" min="0" max="1" step="0.05"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full"
    />
  </div>
);

const Toggle: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-11 h-[26px] rounded-full transition-colors duration-300 ${
      checked
        ? 'bg-gradient-to-r from-blue-500 to-indigo-500'
        : 'bg-white/[0.08]'
    }`}
    style={{
      boxShadow: checked
        ? '0 0 12px rgba(59,130,246,0.3), inset 0 0 0 0.5px rgba(255,255,255,0.1)'
        : 'inset 0 0 0 0.5px rgba(255,255,255,0.05)',
    }}
  >
    <div className={`absolute top-[3px] w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${
      checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
    }`} />
  </button>
);
