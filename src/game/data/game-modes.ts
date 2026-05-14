// Game Modes Configuration
export interface GameMode {
  id: string;
  name: string;
  description: string;
  icon: string; // Could be an emoji or icon name for UI
  isEndless: boolean;
}

export const GAME_MODES: GameMode[] = [
  {
    id: 'adventure',
    name: 'Adventure',
    description: 'Progress through 20 handcrafted levels with increasing difficulty',
    icon: '🏰',
    isEndless: false,
  },
  {
    id: 'endless',
    name: 'Endless',
    description: 'Survive as long as you can in procedurally generated worlds',
    icon: '♾️',
    isEndless: true,
  },
  {
    id: 'time-attack',
    name: 'Time Attack',
    description: 'Race against the clock to reach target distances',
    icon: '⏱️',
    isEndless: false,
  },
];

// Default configuration for each mode
export const MODE_CONFIGS = {
  adventure: {
    // Levels will be loaded from levels.ts
    unlockCondition: 'sequential', // Complete previous level to unlock next
    starSystem: true,
    progressKey: 'iss-adventure-progress',
  },
  endless: {
    milestoneInterval: 1000, // Distance markers every 1000m
    trackPersonalBest: true,
    difficultyScaling: true,
  },
  'time-attack': {
    // Levels will be loaded from levels.ts
    timePowerUpFrequency: 0.3, // Increased frequency of time power-ups
    bonusForSpeed: true,
  },
};