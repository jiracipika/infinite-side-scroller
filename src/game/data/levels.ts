// Level Data for Adventure and Time Attack Modes
export interface LevelConfig {
  id: number;
  name: string;
  mode: 'adventure' | 'time-attack';
  seed: number;
  targetDistance: number;
  timeLimit: number | null; // seconds, null for adventure
  biome: 'forest' | 'desert' | 'ice' | 'volcano' | 'mixed';
  enemies: string[]; // which enemy types can spawn
  enemyDensity: number; // 0.1 - 1.0
  hazardDensity: number; // 0.1 - 1.0
  boss: boolean;
  powerUpFrequency: number; // 0.1 - 1.0
  description: string;
  starThresholds: { one: number; two: number; three: number }; // based on score
}

// Helper function to generate deterministic seeds based on level id
const generateSeed = (id: number): number => {
  // Simple hash function to get a decent seed
  let seed = 0;
  for (let i = 0; i < id.toString().length; i++) {
    seed = seed * 31 + id.toString().charCodeAt(i);
  }
  return Math.abs(seed);
};

// Adventure Levels (20 levels)
export const ADVENTURE_LEVELS: LevelConfig[] = [
  // Levels 1-5: Forest biome, basic enemies (slimes), few hazards, short distances (500-1500)
  {
    id: 1,
    name: "Forest Trail",
    mode: 'adventure',
    seed: generateSeed(1),
    targetDistance: 500,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.2,
    hazardDensity: 0.1,
    boss: false,
    powerUpFrequency: 0.3,
    description: "A peaceful forest path with few obstacles. Perfect for beginners.",
    starThresholds: { one: 500, two: 1000, three: 1500 }
  },
  {
    id: 2,
    name: "Whispering Woods",
    mode: 'adventure',
    seed: generateSeed(2),
    targetDistance: 700,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.25,
    hazardDensity: 0.15,
    boss: false,
    powerUpFrequency: 0.3,
    description: "The forest grows denser with more slimes to overcome.",
    starThresholds: { one: 700, two: 1200, three: 1800 }
  },
  {
    id: 3,
    name: "Glimmer Glen",
    mode: 'adventure',
    seed: generateSeed(3),
    targetDistance: 900,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.3,
    hazardDensity: 0.2,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Sunlight filters through the trees as you navigate winding paths.",
    starThresholds: { one: 900, two: 1400, three: 2100 }
  },
  {
    id: 4,
    name: "Old Oak Passage",
    mode: 'adventure',
    seed: generateSeed(4),
    targetDistance: 1100,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.35,
    hazardDensity: 0.25,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Ancient oaks line the path, their roots creating natural barriers.",
    starThresholds: { one: 1100, two: 1600, three: 2400 }
  },
  {
    id: 5,
    name: "Forest Fortress",
    mode: 'adventure',
    seed: generateSeed(5),
    targetDistance: 1500,
    timeLimit: null,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.4,
    hazardDensity: 0.3,
    boss: false,
    powerUpFrequency: 0.4,
    description: "The forest thickens, preparing you for the challenges ahead.",
    starThresholds: { one: 1500, two: 2000, three: 2500 }
  },

  // Levels 6-10: Desert biome, adds bats and jumpers, more hazards, medium distances (1500-2500)
  {
    id: 6,
    name: "Desert Dawn",
    mode: 'adventure',
    seed: generateSeed(6),
    targetDistance: 1600,
    timeLimit: null,
    biome: 'desert',
    enemies: ['Slime', 'Bat', 'Jumper'],
    enemyDensity: 0.3,
    hazardDensity: 0.2,
    boss: false,
    powerUpFrequency: 0.3,
    description: "The scorching desert sun rises as you traverse sandy dunes.",
    starThresholds: { one: 1600, two: 2100, three: 2600 }
  },
  {
    id: 7,
    name: "Dune Runner",
    mode: 'adventure',
    seed: generateSeed(7),
    targetDistance: 1800,
    timeLimit: null,
    biome: 'desert',
    enemies: ['Slime', 'Bat', 'Jumper'],
    enemyDensity: 0.35,
    hazardDensity: 0.25,
    boss: false,
    powerUpFrequency: 0.3,
    description: "Rolling dunes and sporadic rocks test your agility.",
    starThresholds: { one: 1800, two: 2300, three: 2800 }
  },
  {
    id: 8,
    name: "Sun-Scorched Sands",
    mode: 'adventure',
    seed: generateSeed(8),
    targetDistance: 2000,
    timeLimit: null,
    biome: 'desert',
    enemies: ['Slime', 'Bat', 'Jumper'],
    enemyDensity: 0.4,
    hazardDensity: 0.3,
    boss: false,
    powerUpFrequency: 0.35,
    description: "The heat intensifies, mirages appearing on the horizon.",
    starThresholds: { one: 2000, two: 2500, three: 3000 }
  },
  {
    id: 9,
    name: "Canyon Crossing",
    mode: 'adventure',
    seed: generateSeed(9),
    targetDistance: 2200,
    timeLimit: null,
    biome: 'desert',
    enemies: ['Slime', 'Bat', 'Jumper'],
    enemyDensity: 0.45,
    hazardDensity: 0.35,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Narrow canyon paths require precise jumps over gaping chasms.",
    starThresholds: { one: 2200, two: 2700, three: 3200 }
  },
  {
    id: 10,
    name: "Oasis Refuge",
    mode: 'adventure',
    seed: generateSeed(10),
    targetDistance: 2500,
    timeLimit: null,
    biome: 'desert',
    enemies: ['Slime', 'Bat', 'Jumper'],
    enemyDensity: 0.5,
    hazardDensity: 0.4,
    boss: false,
    powerUpFrequency: 0.4,
    description: "A rare oasis provides temporary respite before the final desert trial.",
    starThresholds: { one: 2500, two: 3000, three: 3500 }
  },

  // Levels 11-15: Ice biome, adds skeletons, ice hazards (slippery), longer distances (2500-4000)
  {
    id: 11,
    name: "Frosty Foothills",
    mode: 'adventure',
    seed: generateSeed(11),
    targetDistance: 2600,
    timeLimit: null,
    biome: 'ice',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.3,
    hazardDensity: 0.2,
    boss: false,
    powerUpFrequency: 0.3,
    description: "The temperature drops as you enter the icy foothills.",
    starThresholds: { one: 2600, two: 3100, three: 3600 }
  },
  {
    id: 12,
    name: "Glacial Path",
    mode: 'adventure',
    seed: generateSeed(12),
    targetDistance: 2800,
    timeLimit: null,
    biome: 'ice',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.35,
    hazardDensity: 0.25,
    boss: false,
    powerUpFrequency: 0.3,
    description: "Slippery ice surfaces make every step a challenge.",
    starThresholds: { one: 2800, two: 3300, three: 3800 }
  },
  {
    id: 13,
    name: "Frozen Tundra",
    mode: 'adventure',
    seed: generateSeed(13),
    targetDistance: 3200,
    timeLimit: null,
    biome: 'ice',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.4,
    hazardDensity: 0.3,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Blizzards reduce visibility as you push through the tundra.",
    starThresholds: { one: 3200, two: 3700, three: 4200 }
  },
  {
    id: 14,
    name: "Ice Cavern",
    mode: 'adventure',
    seed: generateSeed(14),
    targetDistance: 3600,
    timeLimit: null,
    biome: 'ice',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.45,
    hazardDensity: 0.35,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Echoing caverns of ice hide dangerous pitfalls.",
    starThresholds: { one: 3600, two: 4100, three: 4600 }
  },
  {
    id: 15,
    name: "Summit Ascent",
    mode: 'adventure',
    seed: generateSeed(15),
    targetDistance: 4000,
    timeLimit: null,
    biome: 'ice',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.5,
    hazardDensity: 0.4,
    boss: false,
    powerUpFrequency: 0.4,
    description: "The peak of the ice biome offers breathtaking views and fierce winds.",
    starThresholds: { one: 4000, two: 4500, three: 5000 }
  },

  // Levels 16-19: Volcano biome, all enemy types, lava hazards, long distances (4000-6000)
  {
    id: 16,
    name: "Volcanic Foothills",
    mode: 'adventure',
    seed: generateSeed(16),
    targetDistance: 4200,
    timeLimit: null,
    biome: 'volcano',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.4,
    hazardDensity: 0.3,
    boss: false,
    powerUpFrequency: 0.3,
    description: "Ash fills the air as you approach the volatile volcano.",
    starThresholds: { one: 4200, two: 4700, three: 5200 }
  },
  {
    id: 17,
    name: "Lava Fields",
    mode: 'adventure',
    seed: generateSeed(17),
    targetDistance: 4600,
    timeLimit: null,
    biome: 'volcano',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.45,
    hazardDensity: 0.35,
    boss: false,
    powerUpFrequency: 0.3,
    description: "Rivers of lava force you to navigate narrow safe paths.",
    starThresholds: { one: 4600, two: 5100, three: 5600 }
  },
  {
    id: 18,
    name: "Ashen Plains",
    mode: 'adventure',
    seed: generateSeed(18),
    targetDistance: 5000,
    timeLimit: null,
    biome: 'volcano',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.5,
    hazardDensity: 0.4,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Constant ashfall makes visibility poor and footing uncertain.",
    starThresholds: { one: 5000, two: 5500, three: 6000 }
  },
  {
    id: 19,
    name: "Magma Chambers",
    mode: 'adventure',
    seed: generateSeed(19),
    targetDistance: 5500,
    timeLimit: null,
    biome: 'volcano',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.55,
    hazardDensity: 0.45,
    boss: false,
    powerUpFrequency: 0.35,
    description: "Deep within the volcano, magma flows threaten to engulf you.",
    starThresholds: { one: 5500, two: 6000, three: 6500 }
  },

  // Level 20: Boss rush - multiple bosses, extreme difficulty
  {
    id: 20,
    name: "Boss Rush",
    mode: 'adventure',
    seed: generateSeed(20),
    targetDistance: 6000,
    timeLimit: null,
    biome: 'mixed',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton', 'Boss'],
    enemyDensity: 0.6,
    hazardDensity: 0.5,
    boss: true,
    powerUpFrequency: 0.4,
    description: "Face off against multiple bosses in the ultimate test of skill.",
    starThresholds: { one: 6000, two: 6500, three: 7000 }
  },
];

// Time Attack Levels (10 levels)
export const TIME_ATTACK_LEVELS: LevelConfig[] = [
  // Level 1: 60s to reach 800 distance, forest, slimes only
  {
    id: 21,
    name: "Sprint Start",
    mode: 'time-attack',
    seed: generateSeed(21),
    targetDistance: 800,
    timeLimit: 60,
    biome: 'forest',
    enemies: ['Slime'],
    enemyDensity: 0.2,
    hazardDensity: 0.1,
    boss: false,
    powerUpFrequency: 0.4, // Increased for time power-ups
    description: "A quick dash through the forest. Can you make it in under a minute?",
    starThresholds: { one: 800, two: 1000, three: 1200 } // Note: starThresholds in time attack might be based on score or time remaining
  },
  // Level 2: 55s to reach 1000, forest, slimes + bats
  {
    id: 22,
    name: "Winged Sprint",
    mode: 'time-attack',
    seed: generateSeed(22),
    targetDistance: 1000,
    timeLimit: 55,
    biome: 'forest',
    enemies: ['Slime', 'Bat'],
    enemyDensity: 0.25,
    hazardDensity: 0.15,
    boss: false,
    powerUpFrequency: 0.4,
    description: "Bats take to the sky as you rush through the woods.",
    starThresholds: { one: 1000, two: 1200, three: 1400 }
  },
  // Level 3: 50s to reach 1200, desert, bats + jumpers
  {
    id: 23,
    name: "Desert Dash",
    mode: 'time-attack',
    seed: generateSeed(23),
    targetDistance: 1200,
    timeLimit: 50,
    biome: 'desert',
    enemies: ['Bat', 'Jumper'],
    enemyDensity: 0.3,
    hazardDensity: 0.2,
    boss: false,
    powerUpFrequency: 0.4,
    description: "The desert heat is on as you dodge bats and leap over obstacles.",
    starThresholds: { one: 1200, two: 1400, three: 1600 }
  },
  // Level 4: 45s to reach 1400, desert, mixed enemies
  {
    id: 24,
    name: "Scorched Sprint",
    mode: 'time-attack',
    seed: generateSeed(24),
    targetDistance: 1400,
    timeLimit: 45,
    biome: 'desert',
    enemies: ['Slime', 'Bat', 'Jumper'],
    enemyDensity: 0.35,
    hazardDensity: 0.25,
    boss: false,
    powerUpFrequency: 0.4,
    description: "Mixed enemy types appear as you race across the dunes.",
    starThresholds: { one: 1400, two: 1600, three: 1800 }
  },
  // Level 5: 50s to reach 1800, ice, skeletons + slimes
  {
    id: 25,
    name: "Ice Blitz",
    mode: 'time-attack',
    seed: generateSeed(25),
    targetDistance: 1800,
    timeLimit: 50,
    biome: 'ice',
    enemies: ['Skeleton', 'Slime'],
    enemyDensity: 0.3,
    hazardDensity: 0.2,
    boss: false,
    powerUpFrequency: 0.4,
    description: "Slippery ice and bony skeletons challenge your speed.",
    starThresholds: { one: 1800, two: 2000, three: 2200 }
  },
  // Level 6: 45s to reach 2000, ice, all enemy types
  {
    id: 26,
    name: "Frozen Fury",
    mode: 'time-attack',
    seed: generateSeed(26),
    targetDistance: 2000,
    timeLimit: 45,
    biome: 'ice',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.4,
    hazardDensity: 0.3,
    boss: false,
    powerUpFrequency: 0.4,
    description: "All enemy types converge in this icy time trial.",
    starThresholds: { one: 2000, two: 2200, three: 2400 }
  },
  // Level 7: 40s to reach 2200, volcano, mixed enemies
  {
    id: 27,
    name: "Volcanic Velocity",
    mode: 'time-attack',
    seed: generateSeed(27),
    targetDistance: 2200,
    timeLimit: 40,
    biome: 'volcano',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.45,
    hazardDensity: 0.35,
    boss: false,
    powerUpFrequency: 0.4,
    description: "Lava hazards increase as you speed through the volcano's outskirts.",
    starThresholds: { one: 2200, two: 2400, three: 2600 }
  },
  // Level 8: 35s to reach 2500, volcano, dense enemies
  {
    id: 28,
    name: "Magma Rush",
    mode: 'time-attack',
    seed: generateSeed(28),
    targetDistance: 2500,
    timeLimit: 35,
    biome: 'volcano',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.5,
    hazardDensity: 0.4,
    boss: false,
    powerUpFrequency: 0.4,
    description: "Enemy density peaks as you race toward the volcano's core.",
    starThresholds: { one: 2500, two: 2700, three: 2900 }
  },
  // Level 9: 30s to reach 2800, mixed biomes, extreme density
  {
    id: 29,
    name: "Biome Blender",
    mode: 'time-attack',
    seed: generateSeed(29),
    targetDistance: 2800,
    timeLimit: 30,
    biome: 'mixed',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton'],
    enemyDensity: 0.6,
    hazardDensity: 0.5,
    boss: false,
    powerUpFrequency: 0.4,
    description: "Rapidly changing biomes test your adaptability at extreme speeds.",
    starThresholds: { one: 2800, two: 3000, three: 3200 }
  },
  // Level 10: 25s to reach 3000, boss arena, final challenge
  {
    id: 30,
    name: "Boss Blitz",
    mode: 'time-attack',
    seed: generateSeed(30),
    targetDistance: 3000,
    timeLimit: 25,
    biome: 'mixed',
    enemies: ['Slime', 'Bat', 'Jumper', 'Skeleton', 'Boss'],
    enemyDensity: 0.6,
    hazardDensity: 0.5,
    boss: true,
    powerUpFrequency: 0.4,
    description: "The ultimate time attack: defeat the boss before time runs out!",
    starThresholds: { one: 3000, two: 3200, three: 3400 }
  },
];

// Combined export for easy access
export const ALL_LEVELS = [...ADVENTURE_LEVELS, ...TIME_ATTACK_LEVELS];