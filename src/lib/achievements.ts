/* ── Achievement definitions ── */

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  secret?: boolean;
  condition: (stats: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalGames: number;
  highScore: number;
  totalDistance: number;
  totalCoins: number;
  bestDistance: number;
  bestCoins: number;
}

const ACHIEVEMENTS: Achievement[] = [
  // Score milestones
  { id: 'first-flight',  title: 'First Flight',   desc: 'Play your first game',                icon: '🛫',   condition: (s) => s.totalGames >= 1 },
  { id: 'centurion',     title: 'Centurion',       desc: 'Score 100 points',                    icon: '💯',   condition: (s) => s.highScore >= 100 },
  { id: 'high-roller',   title: 'High Roller',     desc: 'Score 500 points',                    icon: '🎯',   condition: (s) => s.highScore >= 500 },
  { id: 'thousandaire',  title: 'Thousandaire',    desc: 'Score 1,000 points',                  icon: '👑',   condition: (s) => s.highScore >= 1000 },
  { id: 'legend',        title: 'Legend',           desc: 'Score 5,000 points',                  icon: '🏆',   condition: (s) => s.highScore >= 5000 },

  // Distance milestones
  { id: 'explorer',      title: 'Explorer',         desc: 'Travel 500m in one run',              icon: '🧭',   condition: (s) => s.bestDistance >= 500 },
  { id: 'marathon',      title: 'Marathon',          desc: 'Travel 2,000m in one run',            icon: '🏃',   condition: (s) => s.bestDistance >= 2000 },
  { id: 'odyssey',       title: 'Odyssey',           desc: 'Travel 10,000m in one run',           icon: '🗺️',   condition: (s) => s.bestDistance >= 10000 },
  { id: 'globe-trotter', title: 'Globe Trotter',     desc: 'Travel 100km total',                  icon: '🌍',   condition: (s) => s.totalDistance >= 100000 },

  // Coin milestones
  { id: 'penny',         title: 'First Coin',        desc: 'Collect your first coin',             icon: '🪙',   condition: (s) => s.totalCoins >= 1 },
  { id: 'rich',          title: 'Money Bags',         desc: 'Collect 500 coins total',             icon: '💰',   condition: (s) => s.totalCoins >= 500 },
  { id: 'tycoon',        title: 'Tycoon',             desc: 'Collect 50 coins in one run',         icon: '💎',   condition: (s) => s.bestCoins >= 50 },

  // Games played
  { id: 'regular',       title: 'Regular',            desc: 'Play 10 games',                       icon: '🎮',   condition: (s) => s.totalGames >= 10 },
  { id: 'devoted',       title: 'Devoted',            desc: 'Play 50 games',                       icon: '⭐',   condition: (s) => s.totalGames >= 50 },
  { id: 'obsessed',      title: 'Obsessed',           desc: 'Play 100 games',                      icon: '🌀',   condition: (s) => s.totalGames >= 100 },

  // Secrets
  { id: 'speed-demon',   title: 'Speed Demon',        desc: 'Score 200 in under 30s',              icon: '⚡',   secret: true, condition: () => false },
  { id: 'untouchable',   title: 'Untouchable',        desc: 'Reach 1000 without getting hit',      icon: '🛡️',   secret: true, condition: () => false },
];

export default ACHIEVEMENTS;

/* ── Persistence ── */

const STORAGE_KEY = 'iss-achievements';
const STATS_KEY = 'iss-lifetime-stats';

export function loadUnlockedAchievements(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function saveUnlockedAchievements(ids: string[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch {}
}

export function loadLifetimeStats(): AchievementStats {
  if (typeof window === 'undefined') {
    return { totalGames: 0, highScore: 0, totalDistance: 0, totalCoins: 0, bestDistance: 0, bestCoins: 0 };
  }
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY) || 'null') || {
      totalGames: 0, highScore: 0, totalDistance: 0, totalCoins: 0, bestDistance: 0, bestCoins: 0,
    };
  } catch {
    return { totalGames: 0, highScore: 0, totalDistance: 0, totalCoins: 0, bestDistance: 0, bestCoins: 0 };
  }
}

export function saveLifetimeStats(stats: AchievementStats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

export function checkNewAchievements(prev: string[], current: AchievementStats): string[] {
  const newIds: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (!prev.includes(a.id) && a.condition(current)) {
      newIds.push(a.id);
    }
  }
  return newIds;
}
