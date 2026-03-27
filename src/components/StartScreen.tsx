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

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handlePlay = () => {
    const seed = seedInput.trim() ? parseInt(seedInput, 10) : undefined;
    onPlay(seed);
  };

  return (
    <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 animate-[fadeSlideUp_0.6s_ease-out]">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-5xl sm:text-6xl font-bold text-white tracking-tight"
              style={{ textShadow: '0 0 40px rgba(100,180,255,0.3)' }}>
            Infinite
          </h1>
          <h2 className="text-2xl sm:text-3xl font-light text-white/70 tracking-widest uppercase mt-1">
            Side Scroller
          </h2>
        </div>

        {/* High Score */}
        {stats.highScore > 0 && (
          <p className="text-sm text-white/40">
            Best: <span className="text-yellow-400/80 font-medium">{stats.highScore.toLocaleString()}</span>
          </p>
        )}

        {/* Buttons */}
        <div className="flex flex-col items-center gap-3 w-full max-w-xs">
          <button
            onClick={handlePlay}
            className="w-full py-3.5 px-8 rounded-2xl font-semibold text-white text-lg
                       bg-gradient-to-r from-blue-500 to-indigo-600
                       hover:from-blue-400 hover:to-indigo-500
                       shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40
                       active:scale-[0.97] transition-all duration-200"
          >
            Play
          </button>

          {/* Seed input */}
          <div className="relative w-full">
            <input
              type="text"
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="Seed (optional)"
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 border border-white/10
                         text-white/80 text-sm placeholder:text-white/30
                         focus:outline-none focus:border-white/20 focus:bg-white/8
                         transition-all"
            />
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full py-2.5 px-8 rounded-xl font-medium text-white/50 text-sm
                       bg-white/5 border border-white/5
                       hover:bg-white/10 hover:text-white/70
                       active:scale-[0.97] transition-all duration-200"
          >
            Settings
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && <SettingsPanel />}

        {/* Controls hint */}
        <p className="text-xs text-white/25 mt-2">
          WASD / Arrow keys to move • Space to jump • Esc to pause
        </p>
      </div>
    </div>
  );
};

export default StartScreen;

const SettingsPanel: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-4 animate-[fadeIn_0.3s_ease-out]">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Settings</h3>

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

      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">Show FPS</span>
        <Toggle checked={settings.showFPS} onChange={(v) => setSettings({ showFPS: v })} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">Reduced Particles</span>
        <Toggle checked={settings.reducedParticles} onChange={(v) => setSettings({ reducedParticles: v })} />
      </div>
    </div>
  );
};

const SliderSetting: FC<{ label: string; value: number; onChange: (v: number) => void }> = ({ label, value, onChange }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/50">{label}</span>
      <span className="text-xs text-white/30">{Math.round(value * 100)}%</span>
    </div>
    <input
      type="range"
      min="0" max="1" step="0.05"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full h-1 rounded-full appearance-none bg-white/10
                 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5
                 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full
                 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
                 [&::-webkit-slider-thumb]:cursor-pointer"
    />
  </div>
);

const Toggle: FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${
      checked ? 'bg-blue-500' : 'bg-white/15'
    }`}
  >
    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
      checked ? 'translate-x-5' : 'translate-x-1'
    }`} />
  </button>
);
