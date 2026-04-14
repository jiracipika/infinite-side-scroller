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
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'knight',
    name: 'Knight',
    description: 'Balanced all-rounder',
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
    bodyColor: '#8844cc',
    outlineColor: '#5a2a8a',
    eyeColor: '#ddf',
    speed: 0.9,
    jumpVelocity: 1.3,
    maxHealth: 2,
    width: 22,
    height: 34,
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
