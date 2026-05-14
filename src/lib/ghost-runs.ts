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

export function loadGhostRun(slotId: SaveSlotId): GhostRun | null {
  const all = loadAll();
  const run = all[key(slotId)];
  if (!run) return null;
  if (!Array.isArray(run.points) || run.points.length === 0) return null;
  return run;
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
