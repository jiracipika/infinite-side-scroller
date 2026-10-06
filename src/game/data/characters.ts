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
  /**
   * Whether this character has a melee weapon (sword / blade). When true,
   * KeyC / KeyJ triggers a close-range slash arc in front of the player.
   * Knight, ninja, tank, and cyborg carry blades; mage, ranger, spirit, and
   * healer rely on ranged attacks only.
   */
  hasMelee?: boolean;
  /**
   * Melee tuning — character-specific swing cadence. If hasMelee is false,
   * these are ignored.
   */
  meleeCooldown?: number;   // seconds between swings (default 0.4)
  meleeDamage?: number;     // damage per hit (default 2)
  meleeRange?: number;      // reach in pixels in front of the player (default 46)
  meleeDuration?: number;   // how long the hitbox arc is active (default 0.2)
  /**
   * Magic-bolt flag for the Mage. When true, the ranged orb is upgraded to a
   * piercing magic bolt with a trail effect, larger radius, and double damage.
   */
  hasMagicBolt?: boolean;
  /** Character-flavoured super move, activated on a timed cooldown. */
  specialName: string;
  specialCooldown: number;
  specialColor: string;
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
    hasMelee: true,
    meleeCooldown: 0.4,
    meleeDamage: 2,
    meleeRange: 48,
    meleeDuration: 0.2,
    specialName: 'Radiant Cleave', specialCooldown: 12, specialColor: '#f8fafc',
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
    hasMelee: true,
    meleeCooldown: 0.28,
    meleeDamage: 1,
    meleeRange: 40,
    meleeDuration: 0.15,
    specialName: 'Shadow Tempest', specialCooldown: 9, specialColor: '#4ade80',
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
    hasMelee: true,
    meleeCooldown: 0.55,
    meleeDamage: 3,
    meleeRange: 52,
    meleeDuration: 0.26,
    specialName: 'Meteor Slam', specialCooldown: 14, specialColor: '#f97316',
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
    hasMagicBolt: true,
    specialName: 'Arcane Nova', specialCooldown: 11, specialColor: '#c084fc',
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
    specialName: 'Arrow Rain', specialCooldown: 10, specialColor: '#facc15',
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
    specialName: 'Overclock Pulse', specialCooldown: 12, specialColor: '#22d3ee',
    hasMelee: true,
    meleeCooldown: 0.38,
    meleeDamage: 2,
    meleeRange: 46,
    meleeDuration: 0.2,
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
    specialName: 'Astral Wake', specialCooldown: 10, specialColor: '#e879f9',
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
    specialName: 'Verdant Sanctuary', specialCooldown: 15, specialColor: '#2dd4bf',
  },
  {
    id: 'cherry',
    name: 'Cherry',
    description: 'Gothic charmer with a cherry parasol',
    ability: 'Starts with a double jump and quick parasol bonks',
    unlockCost: 450,
    bodyColor: '#2a1f33',
    outlineColor: '#180f20',
    eyeColor: '#ff5d73',
    speed: 1.12,
    jumpVelocity: 1.12,
    maxHealth: 3,
    width: 22,
    height: 32,
    hasMelee: true,
    meleeCooldown: 0.3,
    meleeDamage: 1,
    meleeRange: 42,
    meleeDuration: 0.16,
    specialName: 'Cherry Bomb', specialCooldown: 9, specialColor: '#e5304a',
  },
  // The crimson court — Cherry's red-and-black gothic family, four women
  // and four men, each with bespoke ink anatomy (ink-crimson.ts).
  {
    id: 'velvet',
    name: 'Velvet',
    description: 'Vampiric countess of the crimson court',
    ability: 'Quick lace-fan slashes with a floaty, graceful jump',
    unlockCost: 480,
    bodyColor: '#c2183f',
    outlineColor: '#5c0c1f',
    eyeColor: '#ff8fa3',
    speed: 1.06,
    jumpVelocity: 1.16,
    maxHealth: 3,
    width: 22,
    height: 33,
    hasMelee: true,
    meleeCooldown: 0.32,
    meleeDamage: 1,
    meleeRange: 40,
    meleeDuration: 0.16,
    specialName: 'Crimson Kiss', specialCooldown: 10, specialColor: '#d81e4f',
  },
  {
    id: 'ember',
    name: 'Ember',
    description: 'Fire dancer with twin flame fans',
    ability: 'Fastest crimson blades and a trail of sparks on every dash',
    unlockCost: 520,
    bodyColor: '#ff5a3c',
    outlineColor: '#8a1f10',
    eyeColor: '#ffd7c2',
    speed: 1.2,
    jumpVelocity: 1.06,
    maxHealth: 3,
    width: 22,
    height: 32,
    hasMelee: true,
    meleeCooldown: 0.26,
    meleeDamage: 1,
    meleeRange: 38,
    meleeDuration: 0.14,
    specialName: 'Pyre Waltz', specialCooldown: 9, specialColor: '#ff5a3c',
  },
  {
    id: 'rosalia',
    name: 'Rosalia',
    description: 'Rose princess with a thorn whip',
    ability: 'Long thorn-whip reach that strikes from a safe distance',
    unlockCost: 560,
    bodyColor: '#e63950',
    outlineColor: '#7a1024',
    eyeColor: '#ffc2cf',
    speed: 1.0,
    jumpVelocity: 1.1,
    maxHealth: 3,
    width: 23,
    height: 33,
    hasMelee: true,
    meleeCooldown: 0.38,
    meleeDamage: 2,
    meleeRange: 54,
    meleeDuration: 0.2,
    specialName: 'Bramble Waltz', specialCooldown: 11, specialColor: '#e63950',
  },
  {
    id: 'marionette',
    name: 'Marionette',
    description: 'Gothic ball-jointed doll',
    ability: 'Starts with a double jump and slashing ribbon blades',
    unlockCost: 600,
    bodyColor: '#ff3d6e',
    outlineColor: '#801234',
    eyeColor: '#ffe3ea',
    speed: 1.14,
    jumpVelocity: 1.2,
    maxHealth: 2,
    width: 21,
    height: 32,
    hasMelee: true,
    meleeCooldown: 0.3,
    meleeDamage: 1,
    meleeRange: 42,
    meleeDuration: 0.16,
    specialName: 'String Requiem', specialCooldown: 10, specialColor: '#ff3d6e',
  },
  {
    id: 'dorian',
    name: 'Dorian',
    description: 'Crimson duelist in a feathered hat',
    ability: 'Swift rapier lunges with long, thin reach',
    unlockCost: 500,
    bodyColor: '#d62839',
    outlineColor: '#6b0f1b',
    eyeColor: '#ffd9dd',
    speed: 1.16,
    jumpVelocity: 1.04,
    maxHealth: 3,
    width: 24,
    height: 34,
    hasMelee: true,
    meleeCooldown: 0.3,
    meleeDamage: 2,
    meleeRange: 50,
    meleeDuration: 0.16,
    specialName: 'Feint of Heart', specialCooldown: 8, specialColor: '#d62839',
  },
  {
    id: 'onyx',
    name: 'Onyx',
    description: 'Oni brawler with an iron club',
    ability: 'Heavy kanabo smashes that shrug off knockback',
    unlockCost: 540,
    bodyColor: '#ff2e2e',
    outlineColor: '#7a0e0e',
    eyeColor: '#ffb3a0',
    speed: 0.96,
    jumpVelocity: 1.0,
    maxHealth: 4,
    width: 26,
    height: 35,
    knockbackResistance: 0.3,
    hasMelee: true,
    meleeCooldown: 0.5,
    meleeDamage: 3,
    meleeRange: 50,
    meleeDuration: 0.24,
    specialName: 'Demon Rush', specialCooldown: 12, specialColor: '#ff2e2e',
  },
  {
    id: 'mortimer',
    name: 'Mortimer',
    description: 'Demon butler bearing a candelabra',
    ability: 'Sturdy frame with burning candelabra swipes',
    unlockCost: 580,
    bodyColor: '#cf3348',
    outlineColor: '#57121c',
    eyeColor: '#ffe08a',
    speed: 1.0,
    jumpVelocity: 1.02,
    maxHealth: 4,
    width: 23,
    height: 34,
    hasMelee: true,
    meleeCooldown: 0.42,
    meleeDamage: 2,
    meleeRange: 46,
    meleeDuration: 0.2,
    specialName: 'Grave Service', specialCooldown: 13, specialColor: '#ff6b4a',
  },
  {
    id: 'grimshaw',
    name: 'Grimshaw',
    description: 'Blood-moon reaper with a crescent scythe',
    ability: 'Huge scythe sweeps with the longest reach in the house',
    unlockCost: 650,
    bodyColor: '#dc2626',
    outlineColor: '#450a0a',
    eyeColor: '#ff4d4d',
    speed: 1.08,
    jumpVelocity: 1.12,
    maxHealth: 3,
    width: 25,
    height: 34,
    hasMelee: true,
    meleeCooldown: 0.48,
    meleeDamage: 3,
    meleeRange: 58,
    meleeDuration: 0.22,
    specialName: 'Blood Moon', specialCooldown: 11, specialColor: '#dc2626',
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