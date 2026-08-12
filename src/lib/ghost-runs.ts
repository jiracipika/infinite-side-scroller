import type { SaveSlotId } from './progression';

export interface GhostRun {
  slotId: SaveSlotId;
  seed: number;
  bestScore: number;
  bestDistance: number;
  points: Array<{ distance: number; x: number; y: number }>;
  updatedAt: number;
}

const STORAGE_KEY = 'iss-ghost-runs-v1';
const MAX_SEEDS_PER_SLOT = 12;

function loadAll(): Record<string, GhostRun> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, GhostRun> | null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map: Record<string, GhostRun>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

function key(slotId: SaveSlotId, seed: number): string {
  return `${slotId}:${seed}`;
}

function isBetterRun(candidate: GhostRun, previous: GhostRun): boolean {
  return candidate.bestScore > previous.bestScore
    || (candidate.bestScore === previous.bestScore && candidate.bestDistance > previous.bestDistance);
}

function pruneSlotRuns(map: Record<string, GhostRun>, slotId: SaveSlotId): void {
  const runs = Object.entries(map)
    .filter(([, run]) => run?.slotId === slotId)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt);
  for (const [storageKey] of runs.slice(MAX_SEEDS_PER_SLOT)) delete map[storageKey];
}

/**
 * Returns this slot's personal-best path only when it was recorded against the
 * requested world seed. Replaying a path from a different procedural world
 * makes the ghost appear to run through platforms and hazards that do not
 * exist in the current run.
 */
export function loadGhostRun(slotId: SaveSlotId, seed: number): GhostRun | null {
  if (!Number.isFinite(seed)) return null;
  const normalizedSeed = Math.floor(seed);
  const all = loadAll();
  // The slot-only key is a migration fallback for existing saves.
  const run = all[key(slotId, normalizedSeed)] ?? all[slotId];
  if (!run) return null;
  if (!Number.isFinite(run.seed) || run.seed !== normalizedSeed) return null;
  if (!Array.isArray(run.points) || run.points.length === 0) return null;

  const points = run.points
    .filter((point) =>
      point &&
      Number.isFinite(point.distance) &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
    )
    .slice(0, 8000)
    .map((point) => ({
      distance: Number(point.distance),
      x: Number(point.x),
      y: Number(point.y),
    }));

  return points.length > 0 ? { ...run, points } : null;
}

export function upsertGhostRun(input: GhostRun): void {
  if (
    !Number.isFinite(input.seed)
    || !Number.isFinite(input.bestScore)
    || !Number.isFinite(input.bestDistance)
    || !Number.isFinite(input.updatedAt)
    || !Array.isArray(input.points)
  ) return;

  const normalizedSeed = Math.floor(input.seed);
  const all = loadAll();
  const storageKey = key(input.slotId, normalizedSeed);
  const legacy = all[input.slotId];
  const prev = all[storageKey] ?? (legacy?.seed === normalizedSeed ? legacy : undefined);
  if (prev && !isBetterRun(input, prev)) return;

  const points = input.points
    .filter((p) => p && Number.isFinite(p.distance) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .slice(0, 8000)
    .map((p) => ({ distance: Number(p.distance), x: Number(p.x), y: Number(p.y) }));
  if (points.length === 0) return;

  all[storageKey] = {
    ...input,
    seed: normalizedSeed,
    bestScore: Math.max(0, Math.floor(input.bestScore)),
    bestDistance: Math.max(0, Math.floor(input.bestDistance)),
    points,
  };
  if (legacy?.slotId === input.slotId) delete all[input.slotId];
  pruneSlotRuns(all, input.slotId);
  saveAll(all);
}
