export interface ShareRunStats {
  score: number;
  distance: number;
  coins: number;
  maxCombo?: number;
  enemiesDefeated?: number;
}

export type ShareRunOutcome = 'shared' | 'copied' | 'cancelled' | 'unavailable';

interface ShareNavigator {
  share?: (data: { title: string; text: string; url?: string }) => Promise<void>;
  clipboard?: {
    writeText: (text: string) => Promise<void>;
  };
}

const safeWholeNumber = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const formatNumber = (value: number | undefined): string =>
  safeWholeNumber(value).toLocaleString('en-US');

export const buildRunShareText = (stats: ShareRunStats): string => {
  const score = formatNumber(stats.score);
  const distance = formatNumber(stats.distance);
  const coins = formatNumber(stats.coins);
  const combo = formatNumber(stats.maxCombo);
  const defeated = formatNumber(stats.enemiesDefeated);

  return [
    'My Dashverse run',
    `Score ${score} · ${distance}m`,
    `${coins} coins · x${combo} combo · ${defeated} defeated`,
    'Can you beat it?',
  ].join('\n');
};

export const shareRunResult = async (
  stats: ShareRunStats,
  navigatorApi: ShareNavigator,
  playUrl?: string,
): Promise<ShareRunOutcome> => {
  const text = buildRunShareText(stats);

  if (typeof navigatorApi.share === 'function') {
    try {
      await navigatorApi.share({ title: 'Dashverse run', text, url: playUrl });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    }
  }

  if (typeof navigatorApi.clipboard?.writeText === 'function') {
    try {
      const clipboardText = playUrl ? `${text}\n${playUrl}` : text;
      await navigatorApi.clipboard.writeText(clipboardText);
      return 'copied';
    } catch {
      return 'unavailable';
    }
  }

  return 'unavailable';
};
