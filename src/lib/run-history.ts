export interface RunRecord {
  id: string;
  playedAt: number;
  score: number;
  distance: number;
  coins: number;
  maxCombo: number;
  enemiesDefeated: number;
  characterId: string;
}

export interface RunSummary {
  runs: number;
  averageScore: number;
  bestScore: number;
  averageDistance: number;
  scoreTrend: number;
}

const STORAGE_KEY = 'dashverse-run-history-v1';
const MAX_RUNS = 20;

const metric = (value: unknown) => Number.isFinite(value) ? Math.max(0, Math.floor(value as number)) : 0;

function normalize(value: unknown): RunRecord | null {
  if (!value || typeof value !== 'object') return null;
  const run = value as Partial<RunRecord>;
  if (typeof run.id !== 'string' || !run.id || typeof run.characterId !== 'string' || !run.characterId) return null;
  return {
    id: run.id.slice(0, 80),
    playedAt: metric(run.playedAt),
    score: metric(run.score),
    distance: metric(run.distance),
    coins: metric(run.coins),
    maxCombo: metric(run.maxCombo),
    enemiesDefeated: metric(run.enemiesDefeated),
    characterId: run.characterId.slice(0, 32),
  };
}

export function loadRunHistory(): RunRecord[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed
      .map(normalize)
      .filter((run): run is RunRecord => run !== null)
      .sort((a, b) => b.playedAt - a.playedAt)
      .filter((run) => {
        if (seen.has(run.id)) return false;
        seen.add(run.id);
        return true;
      })
      .slice(0, MAX_RUNS);
  } catch {
    return [];
  }
}

export function recordRun(input: Omit<RunRecord, 'id' | 'playedAt'>, playedAt = Date.now()): RunRecord[] {
  const run = normalize({ ...input, id: `${playedAt}-${metric(input.score)}`, playedAt });
  if (!run || (run.score === 0 && run.distance === 0 && run.coins === 0)) return loadRunHistory();
  const history = [run, ...loadRunHistory().filter((entry) => entry.id !== run.id)].slice(0, MAX_RUNS);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch {}
  return history;
}

export function clearRunHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

export function summarizeRunHistory(history: RunRecord[]): RunSummary {
  if (!history.length) return { runs: 0, averageScore: 0, bestScore: 0, averageDistance: 0, scoreTrend: 0 };
  const totalScore = history.reduce((sum, run) => sum + run.score, 0);
  const recent = history.slice(0, Math.min(3, history.length));
  const previous = history.slice(recent.length, recent.length * 2);
  const average = (runs: RunRecord[]) => runs.length ? runs.reduce((sum, run) => sum + run.score, 0) / runs.length : 0;
  return {
    runs: history.length,
    averageScore: Math.round(totalScore / history.length),
    bestScore: Math.max(...history.map((run) => run.score)),
    averageDistance: Math.round(history.reduce((sum, run) => sum + run.distance, 0) / history.length),
    scoreTrend: previous.length ? Math.round(average(recent) - average(previous)) : 0,
  };
}
