/**
 * Character definitions — stats and visuals for playable characters.
 */

export interface CharacterDef {
  id: string;
  name: string;
  description: string;
  bodyColor: string;
  outlineColor: string;
  eyeColor: string;
  speed: number;        // multiplier (1.0 = default)
  jumpVelocity: number; // multiplier (1.0 = default)
  maxHealth: number;
  width: number;
  height: number;
  unlockCost: number;
  baseUnlocked?: boolean;
  ability: string;
  /** 0 = full knockback, 1 = immune. Cyborg's signature trait. */
  knockbackResistance?: number;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'knight',
    name: 'Knight',
    description: 'Balanced all-rounder',
    ability: 'Base kit with standard double-jump pickup and orb shots',
    unlockCost: 0,
    baseUnlocked: true,
    bodyColor: '#4488cc',
    outlineColor: '#2a5a8a',
    eyeColor: '#fff',
    speed: 1.0,
    jumpVelocity: 1.0,
    maxHealth: 3,
    width: 24,
    height: 32,
  },
  {
    id: 'ninja',
    name: 'Ninja',
    description: 'Fast but fragile',
    ability: 'Starts with a double jump and has quick movement',
    unlockCost: 0,
    baseUnlocked: true,
    bodyColor: '#33aa55',
    outlineColor: '#1a6a3a',
    eyeColor: '#ff0',
    speed: 1.3,
    jumpVelocity: 1.1,
    maxHealth: 2,
    width: 20,
    height: 30,
  },
  {
    id: 'tank',
    name: 'Tank',
    description: 'Slow but tough',
    ability: 'Heavy armor, extra health, and harder landing control',
    unlockCost: 0,
    baseUnlocked: true,
    bodyColor: '#cc4444',
    outlineColor: '#8a2a2a',
    eyeColor: '#fff',
    speed: 0.7,
    jumpVelocity: 0.85,
    maxHealth: 5,
    width: 28,
    height: 36,
  },
  {
    id: 'mage',
    name: 'Mage',
    description: 'Floaty jumper',
    ability: 'Starts with a floaty double jump for aerial routes',
    unlockCost: 180,
    bodyColor: '#8844cc',
    outlineColor: '#5a2a8a',
    eyeColor: '#ddf',
    speed: 0.9,
    jumpVelocity: 1.3,
    maxHealth: 2,
    width: 22,
    height: 34,
  },
  {
    id: 'ranger',
    name: 'Ranger',
    description: 'Quick scout',
    ability: 'Starts with bow shots and fast projectile follow-up',
    unlockCost: 220,
    bodyColor: '#16a34a',
    outlineColor: '#14532d',
    eyeColor: '#dcfce7',
    speed: 1.15,
    jumpVelocity: 1.05,
    maxHealth: 3,
    width: 22,
    height: 32,
  },
  {
    id: 'cyborg',
    name: 'Cyborg',
    description: 'Stable and sturdy',
    ability: 'Resists knockback with a reliable health pool',
    unlockCost: 260,
    bodyColor: '#64748b',
    outlineColor: '#1e293b',
    eyeColor: '#67e8f9',
    speed: 0.95,
    jumpVelocity: 0.95,
    maxHealth: 4,
    width: 24,
    height: 33,
    knockbackResistance: 0.5,
  },
  {
    id: 'spirit',
    name: 'Spirit',
    description: 'Floaty drifter',
    ability: 'Glides longer with an always-ready double jump',
    unlockCost: 320,
    bodyColor: '#8b5cf6',
    outlineColor: '#4c1d95',
    eyeColor: '#f5d0fe',
    speed: 1.0,
    jumpVelocity: 1.22,
    maxHealth: 2,
    width: 21,
    height: 33,
  },
  {
    id: 'healer',
    name: 'Healer',
    description: 'Support with passive regen',
    ability: 'Slow passive regeneration during long runs',
    unlockCost: 380,
    bodyColor: '#14b8a6',
    outlineColor: '#0f766e',
    eyeColor: '#ecfeff',
    speed: 0.96,
    jumpVelocity: 1.08,
    maxHealth: 4,
    width: 23,
    height: 33,
  },
];

export const DEFAULT_CHARACTER = CHARACTERS[0];

export function getCharacterById(id: string): CharacterDef {
  return CHARACTERS.find(c => c.id === id) ?? DEFAULT_CHARACTER;
}

/** Persist selected character ID to localStorage */
export function saveSelectedCharacter(id: string): void {
  try { localStorage.setItem('selectedCharacter', id); } catch {}
}

/** Load persisted character ID, falling back to 'knight' */
export function loadSelectedCharacter(): string {
  try {
    const stored = localStorage.getItem('selectedCharacter');
    if (stored && CHARACTERS.some(c => c.id === stored)) return stored;
  } catch {}
  return DEFAULT_CHARACTER.id;
}

export const BASE_CHARACTER_IDS = CHARACTERS.filter(c => c.baseUnlocked || c.unlockCost <= 0).map(c => c.id);

export function isBaseCharacter(id: string): boolean {
  const character = getCharacterById(id);
  return Boolean(character.baseUnlocked || character.unlockCost <= 0);
}
