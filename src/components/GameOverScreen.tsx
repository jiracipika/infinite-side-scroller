'use client';

import { type FC } from 'react';
import { useGameStore } from './GameStore';
import { type GameStats } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  onRestart: () => void;
}

const GameOverScreen: FC<Props> = ({ stats, onRestart }) => {
  const { setSettings } = useGameStore();

  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center animate-[fadeIn_0.5s_ease-out]">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 animate-[fadeSlideUp_0.5s_ease-out_0.1s_both]">
        <h2 className="text-4xl font-bold text-white/90 tracking-tight">Game Over</h2>

        {isNewHighScore && (
          <div className="px-4 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 animate-pulse">
            <span className="text-sm font-semibold text-yellow-400">🏆 New High Score!</span>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
          <StatCard label="Score" value={stats.score.toLocaleString()} />
          <StatCard label="Distance" value={`${Math.round(stats.distance)}m`} />
          <StatCard label="Coins" value={`${stats.coins}`} />
          <StatCard label="Biome" value={stats.biome} />
        </div>

        <div className="flex flex-col items-center gap-2.5 w-full max-w-xs mt-2">
          <button
            onClick={onRestart}
            className="w-full py-3 px-8 rounded-2xl font-semibold text-white
                       bg-gradient-to-r from-blue-500 to-indigo-600
                       hover:from-blue-400 hover:to-indigo-500
                       shadow-lg shadow-blue-500/20 active:scale-[0.97] transition-all"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;

const StatCard: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3 text-center">
    <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
    <div className="text-lg font-semibold text-white/80 mt-0.5">{value}</div>
  </div>
);
