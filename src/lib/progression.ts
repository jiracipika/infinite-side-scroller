import { BASE_CHARACTER_IDS, CHARACTERS, isBaseCharacter } from '@/game/data/characters';

export type SaveSlotId = 'slot1' | 'slot2' | 'slot3';

export interface PlayerProgressionBonuses {
  speedMultiplier: number;
  jumpMultiplier: number;
  extraMaxHealth: number;
  coinMultiplier: number;
  magnetRadiusBonus: number;
  magnetDurationMultiplier: number;
  shieldDurationMultiplier: number;
  dashCooldownMultiplier: number;
  projectileDamageBonus: number;
  projectileSpeedMultiplier: number;
  autoReviveOnce: boolean;
  healOnCoinChance: number;
}

export interface RunCheckpoint {
  seed: number;
  characterId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  maxHealth: number;
  score: number;
  coins: number;
  distance: number;
  savedAt: number;
}

export interface SaveSlot {
  id: SaveSlotId;
  name: string;
  createdAt: number;
  updatedAt: number;
  bankCoins: number;
  spentCoins: number;
  lifetimeCoinsCollected: number;
  bestScore: number;
  bestDistance: number;
  totalRuns: number;
  unlockedUpgradeIds: string[];
  unlockedCharacterIds: string[];
  checkpoint: RunCheckpoint | null;
}

export interface ShopUpgrade {
  id: string;
  name: string;
  description: string;
  cost: number;
}

const STORAGE_KEY = 'iss-save-slots-v1';
const ACTIVE_SLOT_KEY = 'iss-active-save-slot-v1';
const PENDING_CONTINUE_KEY = 'iss-pending-continue-slot-v1';
const DAILY_RUNS_KEY = 'iss-daily-runs-v1';

const SLOT_IDS: SaveSlotId[] = ['slot1', 'slot2', 'slot3'];

export const SHOP_UPGRADES: ShopUpgrade[] = [
  { id: 'swift_boots', name: 'Swift Boots', description: '+10% move speed', cost: 80 },
  { id: 'spring_anklet', name: 'Spring Anklet', description: '+12% jump height', cost: 120 },
  { id: 'iron_heart', name: 'Iron Heart', description: '+1 max health', cost: 160 },
  { id: 'coin_charm', name: 'Coin Charm', description: '+20% coin gains', cost: 140 },
  { id: 'magnet_core', name: 'Magnet Core', description: 'Wider + longer magnet pickup', cost: 110 },
  { id: 'shield_weave', name: 'Shield Weave', description: 'Longer shield duration', cost: 130 },
  { id: 'dash_servos', name: 'Dash Servos', description: 'Dash cooldown reduced', cost: 150 },
  { id: 'sling_calibrator', name: 'Sling Calibrator', description: '+1 slingshot/bow damage', cost: 100 },
  { id: 'bow_focus', name: 'Bow Focus', description: 'Faster projectile speed', cost: 100 },
  { id: 'phoenix_chip', name: 'Phoenix Chip', description: 'Auto revive once per run', cost: 220 },
];

export const DEFAULT_PROGRESSION_BONUSES: PlayerProgressionBonuses = {
  speedMultiplier: 1,
  jumpMultiplier: 1,
  extraMaxHealth: 0,
  coinMultiplier: 1,
  magnetRadiusBonus: 0,
  magnetDurationMultiplier: 1,
  shieldDurationMultiplier: 1,
  dashCooldownMultiplier: 1,
  projectileDamageBonus: 0,
  projectileSpeedMultiplier: 1,
  autoReviveOnce: false,
  healOnCoinChance: 0,
};

function now(): number {
  return Date.now();
}

function createSlot(id: SaveSlotId, label: string): SaveSlot {
  const t = now();
  return {
    id,
    name: label,
    createdAt: t,
    updatedAt: t,
    bankCoins: 0,
    spentCoins: 0,
    lifetimeCoinsCollected: 0,
    bestScore: 0,
    bestDistance: 0,
    totalRuns: 0,
    unlockedUpgradeIds: [],
    unlockedCharacterIds: [...BASE_CHARACTER_IDS],
    checkpoint: null,
  };
}

function defaultSlots(): SaveSlot[] {
  return [
    createSlot('slot1', 'Save 1'),
    createSlot('slot2', 'Save 2'),
    createSlot('slot3', 'Save 3'),
  ];
}

function normalizeCheckpoint(value: unknown): RunCheckpoint | null {
  if (!value || typeof value !== 'object') return null;
  const c = value as Partial<RunCheckpoint>;
  if (!Number.isFinite(c.seed) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) return null;
  return {
    seed: Math.floor(Number(c.seed)),
    characterId: typeof c.characterId === 'string' && c.characterId ? c.characterId : 'knight',
    x: Number(c.x),
    y: Number(c.y),
    vx: Number.isFinite(c.vx) ? Number(c.vx) : 0,
    vy: Number.isFinite(c.vy) ? Number(c.vy) : 0,
    health: Number.isFinite(c.health) ? Math.max(1, Number(c.health)) : 3,
    maxHealth: Number.isFinite(c.maxHealth) ? Math.max(1, Number(c.maxHealth)) : 3,
    score: Number.isFinite(c.score) ? Math.max(0, Math.floor(Number(c.score))) : 0,
    coins: Number.isFinite(c.coins) ? Math.max(0, Math.floor(Number(c.coins))) : 0,
    distance: Number.isFinite(c.distance) ? Math.max(0, Math.floor(Number(c.distance))) : 0,
    savedAt: Number.isFinite(c.savedAt) ? Number(c.savedAt) : now(),
  };
}

function normalizeSlot(value: unknown, fallback: SaveSlot): SaveSlot {
  const s = (value ?? {}) as Partial<SaveSlot>;
  const unlocked = Array.isArray(s.unlockedUpgradeIds)
    ? s.unlockedUpgradeIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  const unlockedCharacters = Array.from(new Set([
    ...BASE_CHARACTER_IDS,
    ...(Array.isArray(s.unlockedCharacterIds)
      ? s.unlockedCharacterIds.filter((id): id is string => CHARACTERS.some((character) => character.id === id))
      : []),
  ]));
  return {
    ...fallback,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim().slice(0, 18) : fallback.name,
    createdAt: Number.isFinite(s.createdAt) ? Number(s.createdAt) : fallback.createdAt,
    updatedAt: Number.isFinite(s.updatedAt) ? Number(s.updatedAt) : fallback.updatedAt,
    bankCoins: Number.isFinite(s.bankCoins) ? Math.max(0, Math.floor(Number(s.bankCoins))) : fallback.bankCoins,
    spentCoins: Number.isFinite(s.spentCoins) ? Math.max(0, Math.floor(Number(s.spentCoins))) : fallback.spentCoins,
    lifetimeCoinsCollected: Number.isFinite(s.lifetimeCoinsCollected) ? Math.max(0, Math.floor(Number(s.lifetimeCoinsCollected))) : fallback.lifetimeCoinsCollected,
    bestScore: Number.isFinite(s.bestScore) ? Math.max(0, Math.floor(Number(s.bestScore))) : fallback.bestScore,
    bestDistance: Number.isFinite(s.bestDistance) ? Math.max(0, Math.floor(Number(s.bestDistance))) : fallback.bestDistance,
    totalRuns: Number.isFinite(s.totalRuns) ? Math.max(0, Math.floor(Number(s.totalRuns))) : fallback.totalRuns,
    unlockedUpgradeIds: unlocked,
    unlockedCharacterIds: unlockedCharacters,
    checkpoint: normalizeCheckpoint(s.checkpoint),
  };
}

export function loadSaveSlots(): SaveSlot[] {
  if (typeof window === 'undefined') return defaultSlots();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSlots();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return defaultSlots();
    const defaults = defaultSlots();
    return SLOT_IDS.map((slotId, idx) => {
      const fallback = defaults[idx];
      const found = parsed.find((item) => (item as Partial<SaveSlot>)?.id === slotId);
      return normalizeSlot(found, fallback);
    });
  } catch {
    return defaultSlots();
  }
}

export function saveSaveSlots(slots: SaveSlot[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // ignore
  }
}

export function loadActiveSaveSlotId(): SaveSlotId {
  if (typeof window === 'undefined') return 'slot1';
  try {
    const value = localStorage.getItem(ACTIVE_SLOT_KEY);
    return SLOT_IDS.includes(value as SaveSlotId) ? (value as SaveSlotId) : 'slot1';
  } catch {
    return 'slot1';
  }
}

export function setActiveSaveSlotId(slotId: SaveSlotId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
  } catch {
    // ignore
  }
}

export function setPendingContinueSlot(slotId: SaveSlotId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PENDING_CONTINUE_KEY, slotId);
  } catch {
    // ignore
  }
}

export function takePendingContinueSlot(): SaveSlotId | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(PENDING_CONTINUE_KEY);
    localStorage.removeItem(PENDING_CONTINUE_KEY);
    return SLOT_IDS.includes(raw as SaveSlotId) ? (raw as SaveSlotId) : null;
  } catch {
    return null;
  }
}

export function clearPendingContinueSlot(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(PENDING_CONTINUE_KEY);
  } catch {
    // ignore
  }
}

function withUpdatedSlot(slotId: SaveSlotId, updater: (slot: SaveSlot) => SaveSlot): SaveSlot[] {
  const slots = loadSaveSlots();
  const updated = slots.map((slot) => (slot.id === slotId ? updater(slot) : slot));
  saveSaveSlots(updated);
  return updated;
}

export function renameSaveSlot(slotId: SaveSlotId, name: string): SaveSlot[] {
  const safe = name.trim().slice(0, 18) || `Save ${slotId.slice(-1)}`;
  return withUpdatedSlot(slotId, (slot) => ({ ...slot, name: safe, updatedAt: now() }));
}

export function resetSaveSlot(slotId: SaveSlotId): SaveSlot[] {
  const label = `Save ${slotId.slice(-1)}`;
  const fresh = createSlot(slotId, label);
  return withUpdatedSlot(slotId, () => fresh);
}

export function saveSlotCheckpoint(slotId: SaveSlotId, checkpoint: Omit<RunCheckpoint, 'savedAt'>): SaveSlot[] {
  return withUpdatedSlot(slotId, (slot) => ({
    ...slot,
    updatedAt: now(),
    checkpoint: { ...checkpoint, savedAt: now() },
  }));
}

export function clearSlotCheckpoint(slotId: SaveSlotId): SaveSlot[] {
  return withUpdatedSlot(slotId, (slot) => ({ ...slot, updatedAt: now(), checkpoint: null }));
}

export function addRunRewards(slotId: SaveSlotId, run: { coins: number; score: number; distance: number }): SaveSlot[] {
  const earnedCoins = Math.max(0, Math.floor(run.coins));
  return withUpdatedSlot(slotId, (slot) => ({
    ...slot,
    updatedAt: now(),
    bankCoins: slot.bankCoins + earnedCoins,
    lifetimeCoinsCollected: slot.lifetimeCoinsCollected + earnedCoins,
    totalRuns: slot.totalRuns + 1,
    bestScore: Math.max(slot.bestScore, Math.max(0, Math.floor(run.score))),
    bestDistance: Math.max(slot.bestDistance, Math.max(0, Math.floor(run.distance))),
    checkpoint: null,
  }));
}


export function purchaseCharacter(slotId: SaveSlotId, characterId: string): { ok: boolean; reason?: string; slots: SaveSlot[] } {
  const character = CHARACTERS.find((item) => item.id === characterId);
  if (!character) return { ok: false, reason: 'Unknown character', slots: loadSaveSlots() };
  const slots = loadSaveSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: 'Missing slot', slots };
  if (isBaseCharacter(characterId) || slot.unlockedCharacterIds.includes(characterId)) {
    return { ok: false, reason: 'Already unlocked', slots };
  }
  if (slot.bankCoins < character.unlockCost) {
    return { ok: false, reason: 'Not enough coins', slots };
  }
  const next = withUpdatedSlot(slotId, (current) => ({
    ...current,
    updatedAt: now(),
    bankCoins: current.bankCoins - character.unlockCost,
    spentCoins: current.spentCoins + character.unlockCost,
    unlockedCharacterIds: [...current.unlockedCharacterIds, characterId],
  }));
  return { ok: true, slots: next };
}

export function purchaseUpgrade(slotId: SaveSlotId, upgradeId: string): { ok: boolean; reason?: string; slots: SaveSlot[] } {
  const upgrade = SHOP_UPGRADES.find((item) => item.id === upgradeId);
  if (!upgrade) return { ok: false, reason: 'Unknown upgrade', slots: loadSaveSlots() };
  const slots = loadSaveSlots();
  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return { ok: false, reason: 'Missing slot', slots };
  if (slot.unlockedUpgradeIds.includes(upgradeId)) {
    return { ok: false, reason: 'Already purchased', slots };
  }
  if (slot.bankCoins < upgrade.cost) {
    return { ok: false, reason: 'Not enough coins', slots };
  }
  const next = withUpdatedSlot(slotId, (current) => ({
    ...current,
    updatedAt: now(),
    bankCoins: current.bankCoins - upgrade.cost,
    spentCoins: current.spentCoins + upgrade.cost,
    unlockedUpgradeIds: [...current.unlockedUpgradeIds, upgradeId],
  }));
  return { ok: true, slots: next };
}

export function buildProgressionBonuses(upgradeIds: string[]): PlayerProgressionBonuses {
  const bonuses: PlayerProgressionBonuses = { ...DEFAULT_PROGRESSION_BONUSES };
  const has = (id: string) => upgradeIds.includes(id);

  if (has('swift_boots')) bonuses.speedMultiplier += 0.1;
  if (has('spring_anklet')) bonuses.jumpMultiplier += 0.12;
  if (has('iron_heart')) bonuses.extraMaxHealth += 1;
  if (has('coin_charm')) bonuses.coinMultiplier += 0.2;
  if (has('magnet_core')) {
    bonuses.magnetRadiusBonus += 65;
    bonuses.magnetDurationMultiplier += 0.45;
  }
  if (has('shield_weave')) bonuses.shieldDurationMultiplier += 0.5;
  if (has('dash_servos')) bonuses.dashCooldownMultiplier *= 0.78;
  if (has('sling_calibrator')) bonuses.projectileDamageBonus += 1;
  if (has('bow_focus')) bonuses.projectileSpeedMultiplier += 0.15;
  if (has('phoenix_chip')) bonuses.autoReviveOnce = true;

  return bonuses;
}

function toIsoDay(ts: number = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function hasPlayedDailyChallenge(slotId: SaveSlotId, day: string = toIsoDay()): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(DAILY_RUNS_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as Record<string, string[]> | null;
    if (!parsed || typeof parsed !== 'object') return false;
    const list = parsed[day];
    return Array.isArray(list) && list.includes(slotId);
  } catch {
    return false;
  }
}

export function markDailyChallengePlayed(slotId: SaveSlotId, day: string = toIsoDay()): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(DAILY_RUNS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    const next: Record<string, string[]> = {};
    const keepDays = [day];
    for (const key of Object.keys(parsed)) {
      if (keepDays.includes(key)) {
        next[key] = Array.isArray(parsed[key]) ? parsed[key].filter((v): v is string => typeof v === 'string') : [];
      }
    }
    const existing = next[day] ?? [];
    if (!existing.includes(slotId)) existing.push(slotId);
    next[day] = existing;
    localStorage.setItem(DAILY_RUNS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getTodayIsoDay(): string {
  return toIsoDay();
}
