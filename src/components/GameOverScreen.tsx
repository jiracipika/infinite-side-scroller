'use client';

import { type FC } from 'react';
import { type GameStats } from '@/game/state/game-state';

interface Props {
  stats: GameStats;
  onRestart: () => void;
  onQuit: () => void;
}

const GameOverScreen: FC<Props> = ({ stats, onRestart, onQuit }) => {
  const isNewHighScore = stats.score >= stats.highScore && stats.score > 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center animate-[fadeIn_0.5s_ease-out]">
      {/* Frosted glass backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 animate-[fadeSlideUp_0.5s_ease-out_0.1s_both]">
        <h2 className="text-4xl font-bold text-white/90 tracking-tight">Game Over</h2>

        {isNewHighScore && (
          <div
            className="px-4 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30"
            style={{ animation: 'newHighScore 0.6s ease-out' }}
          >
            <span className="text-sm font-semibold text-yellow-400">New High Score!</span>
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
          <StatCard label="Score" value={stats.score.toLocaleString()} highlight={isNewHighScore} />
          <StatCard label="Best" value={stats.highScore.toLocaleString()} />
          <StatCard label="Distance" value={`${Math.round(stats.distance)}m`} />
          <StatCard label="Coins" value={`${stats.coins}`} />
        </div>

        {/* Buttons */}
        <div className="flex flex-col items-center gap-2.5 w-full max-w-xs mt-1">
          <button
            onClick={onRestart}
            className="w-full py-3 px-8 rounded-2xl font-semibold text-white
                       bg-gradient-to-r from-blue-500 to-indigo-600
                       hover:from-blue-400 hover:to-indigo-500
                       shadow-lg shadow-blue-500/20 active:scale-[0.97] transition-all"
          >
            Play Again
          </button>

          <button
            onClick={onQuit}
            className="w-full py-2.5 px-8 rounded-xl font-medium text-white/50 text-sm
                       bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white/70
                       active:scale-[0.97] transition-all"
          >
            Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameOverScreen;

const StatCard: FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div className={`rounded-xl px-4 py-3 text-center transition-all ${
    highlight
      ? 'bg-yellow-500/10 border border-yellow-500/20'
      : 'bg-white/5 border border-white/5'
  }`}>
    <div className="text-xs text-white/40 uppercase tracking-wider">{label}</div>
    <div className={`text-lg font-semibold mt-0.5 ${highlight ? 'text-yellow-400' : 'text-white/80'}`}>
      {value}
    </div>
  </div>
);
