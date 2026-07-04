export interface LeaderboardEntry {
  id: string;
  name: string;
  avatarId: string;
  score: number;
  distance: number;
  coins: number;
  characterId: string;
  createdAt: number;
  maxCombo?: number;
  enemiesDefeated?: number;
}

const STORAGE_KEY = 'iss-leaderboard-v1';
const NAME_KEY = 'iss-leaderboard-name';
const AVATAR_KEY = 'iss-leaderboard-avatar-v1';
const MAX_ENTRIES = 60;

export interface AvatarPreset {
  id: string;
  label: string;
  icon: string;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'robot_blue', label: 'Blue Bot', icon: '🤖' },
  { id: 'knight', label: 'Knight', icon: '🛡️' },
  { id: 'alien', label: 'Alien', icon: '👽' },
  { id: 'archer', label: 'Archer', icon: '🏹' },
  { id: 'healer', label: 'Healer', icon: '💚' },
  { id: 'fox', label: 'Fox', icon: '🦊' },
  { id: 'owl', label: 'Owl', icon: '🦉' },
  { id: 'star', label: 'Star', icon: '⭐' },
];

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function sanitizeLeaderboardName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').slice(0, 20) || 'Player';
}

export function loadLeaderboardName(): string {
  if (typeof window === 'undefined') return 'Player';
  try {
    const raw = localStorage.getItem(NAME_KEY);
    return isValidName(raw) ? sanitizeLeaderboardName(raw) : 'Player';
  } catch {
    return 'Player';
  }
}

export function saveLeaderboardName(name: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(NAME_KEY, sanitizeLeaderboardName(name));
  } catch {
    // ignore storage errors
  }
}

export function getAvatarPreset(avatarId: string): AvatarPreset {
  return AVATAR_PRESETS.find((preset) => preset.id === avatarId) ?? AVATAR_PRESETS[0];
}

export function sanitizeAvatarId(avatarId: unknown): string {
  if (typeof avatarId !== 'string') return AVATAR_PRESETS[0].id;
  return getAvatarPreset(avatarId).id;
}

export function loadLeaderboardAvatarId(): string {
  if (typeof window === 'undefined') return AVATAR_PRESETS[0].id;
  try {
    return sanitizeAvatarId(localStorage.getItem(AVATAR_KEY));
  } catch {
    return AVATAR_PRESETS[0].id;
  }
}

export function saveLeaderboardAvatarId(avatarId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(AVATAR_KEY, sanitizeAvatarId(avatarId));
  } catch {
    // ignore storage errors
  }
}

function sanitizeOptionalNumber(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.distance !== a.distance) return b.distance - a.distance;
    if (b.coins !== a.coins) return b.coins - a.coins;
    return a.createdAt - b.createdAt;
  });
}

export function loadLeaderboard(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const normalized: LeaderboardEntry[] = parsed
      .map((entry) => {
        const e = (entry ?? {}) as Partial<LeaderboardEntry>;
        if (!isValidName(e.name)) return null;
        if (!Number.isFinite(e.score) || !Number.isFinite(e.distance) || !Number.isFinite(e.coins)) return null;
        const createdAt = Number.isFinite(e.createdAt) ? Number(e.createdAt) : Date.now();
        const id = typeof e.id === 'string' && e.id ? e.id : `${createdAt}-${Math.random().toString(36).slice(2, 8)}`;
        const maxCombo = sanitizeOptionalNumber(e.maxCombo);
        const enemiesDefeated = sanitizeOptionalNumber(e.enemiesDefeated);
        const base: LeaderboardEntry = {
          id,
          name: sanitizeLeaderboardName(e.name),
          avatarId: sanitizeAvatarId(e.avatarId),
          score: Math.max(0, Math.floor(Number(e.score))),
          distance: Math.max(0, Math.floor(Number(e.distance))),
          coins: Math.max(0, Math.floor(Number(e.coins))),
          characterId: typeof e.characterId === 'string' ? e.characterId : 'knight',
          createdAt,
        };
        if (maxCombo !== undefined) base.maxCombo = maxCombo;
        if (enemiesDefeated !== undefined) base.enemiesDefeated = enemiesDefeated;
        return base;
      })
      .filter((entry): entry is LeaderboardEntry => !!entry);

    return rankEntries(normalized).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function saveLeaderboard(entries: LeaderboardEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rankEntries(entries).slice(0, MAX_ENTRIES)));
  } catch {
    // ignore storage errors
  }
}

export function addLeaderboardEntry(input: Omit<LeaderboardEntry, 'id' | 'createdAt'>): LeaderboardEntry {
  const next: LeaderboardEntry = {
    ...input,
    name: sanitizeLeaderboardName(input.name),
    avatarId: sanitizeAvatarId(input.avatarId),
    score: Math.max(0, Math.floor(input.score)),
    distance: Math.max(0, Math.floor(input.distance)),
    coins: Math.max(0, Math.floor(input.coins)),
    maxCombo: sanitizeOptionalNumber(input.maxCombo),
    enemiesDefeated: sanitizeOptionalNumber(input.enemiesDefeated),
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  const entries = loadLeaderboard();
  entries.push(next);
  saveLeaderboard(entries);
  return next;
}

export function clearLeaderboard(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}
