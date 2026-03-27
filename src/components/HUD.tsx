'use client';

import { type FC } from 'react';
import { type GameStats, type GameSettings } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  settings: GameSettings;
}

const HUD: FC<Props> = ({ stats, settings }) => {
  const healthPct = stats.health / stats.maxHealth;
  const hearts = Math.ceil(stats.maxHealth / 25);
  const filledHearts = Math.ceil(stats.health / 25);

  return (
    <div className="absolute inset-x-0 top-0 z-10 pointer-events-none">
      <div className="flex items-start justify-between p-4 sm:p-5 gap-3">
        {/* Left: Hearts + Coins */}
        <div className="flex flex-col gap-2 animate-[slideInRight_0.4s_ease-out]">
          {/* Hearts */}
          <div className="flex items-center gap-1 glass-badge !px-2 !py-1">
            {Array.from({ length: Math.min(hearts, 6) }).map((_, i) => (
              <span
                key={i}
                className={`text-xs transition-all duration-300 ${
                  i < filledHearts
                    ? i === filledHearts - 1 && healthPct <= 0.25
                      ? 'text-red-500 animate-[pulse-soft_1s_ease-in-out_infinite]'
                      : 'text-red-400'
                    : 'text-white/15'
                }`}
                style={i < filledHearts ? { filter: 'drop-shadow(0 0 4px rgba(248,113,113,0.4))' } : {}}
              >
                ♥
              </span>
            ))}
          </div>
          {/* Coin counter */}
          <div className="flex items-center gap-1.5 glass-badge !px-2.5 !py-1">
            <span className="text-yellow-400 text-xs" style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.4))' }}>●</span>
            <span className="text-white/70 text-xs font-medium tabular-nums">{stats.coins}</span>
          </div>
        </div>

        {/* Center: Score */}
        <div className="text-center flex-1 animate-[fadeSlideUp_0.5s_ease-out]">
          <div
            className="text-white/90 text-2xl sm:text-3xl font-bold tabular-nums tracking-tight"
            style={{ textShadow: '0 2px 12px rgba(0,0,0,0.6)' }}
          >
            {stats.score.toLocaleString()}
          </div>
          <div className="text-white/25 text-[11px] tabular-nums mt-0.5 tracking-wider">
            {Math.round(stats.distance)}m
          </div>
        </div>

        {/* Right: Biome + FPS */}
        <div className="flex flex-col items-end gap-2 animate-[slideInRight_0.4s_ease-out_0.1s_both]">
          <div className="glass-badge !py-1">
            <span className="text-white/40 text-[11px] font-medium tracking-wide">{stats.biome}</span>
          </div>
          {settings.showFPS && (
            <span className="text-[10px] text-white/15 tabular-nums font-mono">
              {stats.fps} fps
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default HUD;
