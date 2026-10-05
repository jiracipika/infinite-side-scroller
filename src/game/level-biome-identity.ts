/**
 * Authored biome identity for menu preview surfaces (level-select cards,
 * continue banner, results). Pure derivation only — the AUTHORED palette
 * lives in the biome registry (src/game/world/biomes.ts, the same source the
 * engine announces via `dashverse-biome` events). This module deliberately
 * imports nothing from that registry (TS enums are not importable under the
 * test runner's type stripping) so node:test can exercise the derivation
 * directly; the registry maps its configs through `deriveBiomeIdentity` /
 * `deriveMixedIdentity` via `getLevelBiomeIdentity`.
 */

/** Finite-level biome ids as authored on LevelConfig. */
export type LevelBiomeId = 'forest' | 'desert' | 'ice' | 'volcano' | 'mixed';

/** Minimal structural view of an authored BiomeConfig. */
export interface BiomeIdentityInput {
  name: string;
  colors: { ground: string; groundDark: string; platform: string };
}

export interface LevelBiomeIdentity {
  id: LevelBiomeId;
  /** Authored registry display name ("Forest", "Sky Islands", "Volcanic"). */
  name: string;
  /** Primary card accent — the authored ground color. */
  accent: string;
  ground: string;
  groundDark: string;
  platform: string;
  /** Preview stripe gradient: authored dark → ground → platform. */
  stripe: string;
}

/** Derive a preview identity from one authored biome config. */
export function deriveBiomeIdentity(
  id: LevelBiomeId,
  input: BiomeIdentityInput,
): LevelBiomeIdentity {
  const { ground, groundDark, platform } = input.colors;
  return {
    id,
    name: input.name,
    accent: ground,
    ground,
    groundDark,
    platform,
    stripe: `linear-gradient(90deg, ${groundDark}, ${ground} 55%, ${platform})`,
  };
}

/**
 * `mixed` levels run the endless shifting biome sequence (the registry
 * intentionally returns no single config for them), so their preview is the
 * authored sequence itself: one gradient stop per unique authored ground
 * color, closing on the sequence's platform color.
 */
export function deriveMixedIdentity(inputs: BiomeIdentityInput[]): LevelBiomeIdentity {
  const grounds: string[] = [];
  for (const input of inputs) {
    if (!grounds.includes(input.colors.ground)) grounds.push(input.colors.ground);
  }
  const ground = grounds[0] ?? '#c7ff4d';
  const groundDark = inputs[inputs.length - 1]?.colors.groundDark ?? '#0a0a0f';
  const platform = inputs[inputs.length - 1]?.colors.platform ?? '#c7ff4d';
  return {
    id: 'mixed',
    name: 'Shifting Worlds',
    accent: ground,
    ground,
    groundDark,
    platform,
    stripe: `linear-gradient(90deg, ${grounds.join(', ')}, ${platform})`,
  };
}
