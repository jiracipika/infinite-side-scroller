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

function key(slotId: SaveSlotId): string {
  return slotId;
}

/**
 * Returns this slot's personal-best path only when it was recorded against the
 * requested world seed. Replaying a path from a different procedural world
 * makes the ghost appear to run through platforms and hazards that do not
 * exist in the current run.
 */
export function loadGhostRun(slotId: SaveSlotId, seed: number): GhostRun | null {
  const all = loadAll();
  const run = all[key(slotId)];
  if (!run) return null;
  if (!Number.isFinite(seed) || !Number.isFinite(run.seed) || run.seed !== seed) return null;
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
  const all = loadAll();
  const prev = all[key(input.slotId)];
  if (prev && prev.bestScore > input.bestScore && prev.bestDistance > input.bestDistance) {
    return;
  }
  all[key(input.slotId)] = {
    ...input,
    points: input.points.slice(0, 8000).map((p) => ({
      distance: Number(p.distance),
      x: Number(p.x),
      y: Number(p.y),
    })),
  };
  saveAll(all);
}
