import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizePlayerBest, type PlayerBest } from './player-best';

const RUN_HISTORY_KEY = '@dashverse/run-history/v1';
const MAX_HISTORY = 20;

export type RunEntry = PlayerBest & {
  timestamp: number;
};

/**
 * Load the recent run history (newest first).
 * Returns an empty array when no runs have been recorded yet.
 */
export async function loadRunHistory(): Promise<RunEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(RUN_HISTORY_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry: unknown) => {
        if (!entry || typeof entry !== 'object') return null;
        const obj = entry as Record<string, unknown>;
        const base = normalizePlayerBest(obj);
        const timestamp = typeof obj.timestamp === 'number' && Number.isFinite(obj.timestamp)
          ? Math.floor(obj.timestamp)
          : Date.now();
        return { ...base, timestamp } as RunEntry;
      })
      .filter((entry: RunEntry | null): entry is RunEntry => entry !== null)
      .slice(0, MAX_HISTORY);
  } catch {
    return [];
  }
}

/**
 * Append a completed run to the history. Automatically caps at MAX_HISTORY.
 */
export async function appendRunHistory(stats: PlayerBest): Promise<void> {
  try {
    const current = await loadRunHistory();
    const entry: RunEntry = { ...normalizePlayerBest(stats), timestamp: Date.now() };
    const next = [entry, ...current].slice(0, MAX_HISTORY);
    await AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Run history should never block gameplay.
  }
}

/**
 * Clear all run history (used by reset).
 */
export async function clearRunHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RUN_HISTORY_KEY);
  } catch {
    // noop
  }
}

/**
 * Format a timestamp for display in the run list.
 */
export function formatRunDate(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
