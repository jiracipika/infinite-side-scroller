'use client';

import { type FC } from 'react';
import { type GameStats, type GameSettings } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  settings: GameSettings;
}

const HUD: FC<Props> = ({ stats, settings }) => {
  const healthPct = stats.health / stats.maxHealth;
  const healthColor = healthPct > 0.6 ? '#22c55e' : healthPct > 0.3 ? '#eab308' : '#ef4444';

  return (
    <div className="absolute inset-x-0 top-0 z-10 pointer-events-none">
      <div className="flex items-start justify-between p-4 gap-4">
        {/* Left: Health */}
        <div className="flex items-center gap-3">
          {/* Health bar */}
          <div className="w-32 sm:w-40 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${healthPct * 100}%`,
                backgroundColor: healthColor,
                boxShadow: `0 0 8px ${healthColor}60`,
              }}
            />
          </div>
          {/* Coin */}
          <div className="flex items-center gap-1.5 bg-white/10 rounded-full px-2.5 py-1">
            <span className="text-yellow-400 text-xs">●</span>
            <span className="text-white/80 text-xs font-medium tabular-nums">{stats.coins}</span>
          </div>
        </div>

        {/* Center: Score */}
        <div className="text-center">
          <div className="text-white/90 text-xl sm:text-2xl font-bold tabular-nums tracking-tight"
               style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            {stats.score.toLocaleString()}
          </div>
          <div className="text-white/30 text-xs tabular-nums">{Math.round(stats.distance)}m</div>
        </div>

        {/* Right: Biome + FPS */}
        <div className="flex flex-col items-end gap-1">
          <div className="bg-white/10 rounded-full px-2.5 py-1">
            <span className="text-white/50 text-xs">{stats.biome}</span>
          </div>
          {settings.showFPS && (
            <span className="text-[10px] text-white/25 tabular-nums font-mono">{stats.fps} fps</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default HUD;
