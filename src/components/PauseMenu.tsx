'use client';

import { useState, type FC } from 'react';
import { useGameStore } from './GameStore';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onQuit: () => void;
}

const PauseMenu: FC<Props> = ({ onResume, onRestart, onQuit }) => {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="absolute inset-0 flex items-center justify-center animate-[fadeIn_0.2s_ease-out]">
      {/* Frosted glass backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-5 px-6 animate-[fadeSlideUp_0.3s_ease-out]">
        <h2 className="text-3xl font-bold text-white/90 tracking-tight">Paused</h2>

        <div className="flex flex-col items-center gap-2.5 w-full max-w-xs">
          <button
            onClick={onResume}
            className="w-full py-3 px-8 rounded-2xl font-semibold text-white
                       bg-gradient-to-r from-blue-500 to-indigo-600
                       hover:from-blue-400 hover:to-indigo-500
                       shadow-lg shadow-blue-500/20 active:scale-[0.97] transition-all"
          >
            Resume
          </button>

          <button
            onClick={onRestart}
            className="w-full py-2.5 px-8 rounded-xl font-medium text-white/60 text-sm
                       bg-white/5 border border-white/8 hover:bg-white/10 hover:text-white/80
                       active:scale-[0.97] transition-all"
          >
            Restart
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full py-2.5 px-8 rounded-xl font-medium text-white/50 text-sm
                       bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white/70
                       active:scale-[0.97] transition-all"
          >
            Settings
          </button>

          <button
            onClick={onQuit}
            className="w-full py-2.5 px-8 rounded-xl font-medium text-red-400/60 text-sm
                       bg-white/5 border border-white/5 hover:bg-red-500/10 hover:text-red-400/80
                       active:scale-[0.97] transition-all"
          >
            Quit to Menu
          </button>
        </div>

        {showSettings && <SettingsPanel />}
      </div>
    </div>
  );
};

export default PauseMenu;

const SettingsPanel: FC = () => {
  const { settings, setSettings } = useGameStore();

  return (
    <div className="w-full max-w-xs rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xl p-5 space-y-4 animate-[fadeIn_0.3s_ease-out]">
      <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Settings</h3>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-white/50">Master Volume</span>
          <span className="text-xs text-white/30">{Math.round(settings.masterVolume * 100)}%</span>
        </div>
        <input type="range" min="0" max="1" step="0.05" value={settings.masterVolume}
          onChange={(e) => setSettings({ masterVolume: parseFloat(e.target.value) })}
          className="w-full h-1 rounded-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md" />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">Show FPS</span>
        <button onClick={() => setSettings({ showFPS: !settings.showFPS })}
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${settings.showFPS ? 'bg-blue-500' : 'bg-white/15'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${settings.showFPS ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-white/50">Reduced Particles</span>
        <button onClick={() => setSettings({ reducedParticles: !settings.reducedParticles })}
          className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${settings.reducedParticles ? 'bg-blue-500' : 'bg-white/15'}`}>
          <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${settings.reducedParticles ? 'translate-x-5' : 'translate-x-1'}`} />
        </button>
      </div>
    </div>
  );
};
