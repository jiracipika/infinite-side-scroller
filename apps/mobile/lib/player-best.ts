import AsyncStorage from '@react-native-async-storage/async-storage';

const PLAYER_BEST_KEY = '@dashverse/player-best/v1';

export type PlayerBest = {
  score: number;
  distance: number;
  coins: number;
  maxCombo: number;
  enemiesDefeated: number;
};

export const EMPTY_PLAYER_BEST: PlayerBest = {
  score: 0,
  distance: 0,
  coins: 0,
  maxCombo: 0,
  enemiesDefeated: 0,
};

const nonNegativeInteger = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

export const normalizePlayerBest = (value: unknown): PlayerBest => {
  if (!value || typeof value !== 'object') return EMPTY_PLAYER_BEST;

  const candidate = value as Partial<PlayerBest>;
  return {
    score: nonNegativeInteger(candidate.score),
    distance: nonNegativeInteger(candidate.distance),
    coins: nonNegativeInteger(candidate.coins),
    maxCombo: nonNegativeInteger(candidate.maxCombo),
    enemiesDefeated: nonNegativeInteger(candidate.enemiesDefeated),
  };
};

export async function loadPlayerBest(): Promise<PlayerBest> {
  try {
    const raw = await AsyncStorage.getItem(PLAYER_BEST_KEY);
    return raw ? normalizePlayerBest(JSON.parse(raw)) : EMPTY_PLAYER_BEST;
  } catch {
    return EMPTY_PLAYER_BEST;
  }
}

export async function savePlayerBest(next: PlayerBest): Promise<PlayerBest> {
  const normalized = normalizePlayerBest(next);
  try {
    await AsyncStorage.setItem(PLAYER_BEST_KEY, JSON.stringify(normalized));
  } catch {
    // A score should never block the player from continuing a run.
  }
  return normalized;
}
