/**
 * Game barrel export — convenient access to all game modules.
 */

export { GameEngine } from './engine/game-engine';
export { Camera, DEFAULT_CAMERA_CONFIG, type CameraConfig } from './engine/camera';
export { ChunkManager } from './world/chunk-manager';
export { Chunk, CHUNK_WIDTH } from './world/chunk';
export { createRng } from './world/rng';
export { getTerrainHeight } from './world/terrain';
export { getBiomeAt, getBlendedBiomeColors, BIOMES, BiomeType, type BiomeConfig, type BiomeColors } from './world/biomes';
export { Player, DEFAULT_PLAYER_CONFIG, type PlayerConfig } from './entities/player';
export { ParticleSystem, type Particle } from './entities/particles';
export { InputManager } from './input/input';
export { GameRenderer } from './rendering/renderer';
