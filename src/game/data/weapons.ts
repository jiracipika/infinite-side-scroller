/**
 * Weapon definitions — unique weapons for each character.
 */

export type WeaponType = 'melee' | 'ranged' | 'homing';

export interface WeaponDef {
  id: string;
  name: string;
  characterId: string;
  type: WeaponType;
  damage: number;
  cooldown: number;       // seconds between attacks
  range: number;          // pixel range for melee / life for projectiles
  color: string;          // primary color
  glowColor: string;      // secondary / glow color
  // Melee-specific
  attackDuration?: number; // how long the melee swing lasts (seconds)
  arcStart?: number;       // start angle in radians (0 = right)
  arcEnd?: number;         // end angle in radians
  // Ranged-specific
  projectileSpeed?: number;
  projectileCount?: number;
  spreadAngle?: number;    // radians between projectiles in spread
  homingStrength?: number; // for homing projectiles, curve strength
  // Knockback
  knockback?: number;      // knockback force for shield bash etc.
}

export const WEAPONS: WeaponDef[] = [
  {
    id: 'broadsword',
    name: 'Broadsword',
    characterId: 'knight',
    type: 'melee',
    damage: 2,
    cooldown: 0.5,
    range: 40,
    color: '#c0c0c0',
    glowColor: '#ffffff80',
    attackDuration: 0.25,
    arcStart: -Math.PI / 3,
    arcEnd: Math.PI / 3,
  },
  {
    id: 'shuriken',
    name: 'Shuriken',
    characterId: 'ninja',
    type: 'ranged',
    damage: 0.5,
    cooldown: 0.25,
    range: 600,
    color: '#a0a0a0',
    glowColor: '#ffffff60',
    projectileSpeed: 450,
    projectileCount: 3,
    spreadAngle: Math.PI / 12, // 15 degrees between each
  },
  {
    id: 'shield_bash',
    name: 'Shield Bash',
    characterId: 'tank',
    type: 'melee',
    damage: 1.5,
    cooldown: 0.6,
    range: 36,
    color: '#8b4513',
    glowColor: '#daa52060',
    attackDuration: 0.2,
    arcStart: -Math.PI / 4,
    arcEnd: Math.PI / 4,
    knockback: 400,
  },
  {
    id: 'magic_bolt',
    name: 'Magic Bolt',
    characterId: 'mage',
    type: 'homing',
    damage: 1,
    cooldown: 0.35,
    range: 900,
    color: '#bf5fff',
    glowColor: '#e0a0ff80',
    projectileSpeed: 300,
    homingStrength: 4,
  },
];

export const DEFAULT_WEAPON = WEAPONS[0];

export function getWeaponById(id: string): WeaponDef {
  return WEAPONS.find(w => w.id === id) ?? DEFAULT_WEAPON;
}

export function getWeaponForCharacter(characterId: string): WeaponDef {
  return WEAPONS.find(w => w.characterId === characterId) ?? DEFAULT_WEAPON;
}

/** Extended projectile type for player weapons */
export interface PlayerProjectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  damage: number;
  weaponId: string;
  homingStrength?: number;
  trail?: { x: number; y: number }[];
}
