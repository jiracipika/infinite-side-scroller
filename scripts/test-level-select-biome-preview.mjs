import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Contract test: level-select cards preview THEIR biome using the authored
// registry palette ("authored biome preview with clear visual identity" —
// GLM-NEXT-SLICE). The renderer is not Node-importable (JSX + framer-motion),
// and the biome registry uses a TS enum, so the repo's grep-source pattern
// applies. Value-level derivation is unit-tested in
// test/level-biome-identity.test.ts.

const selectSrc = readFileSync(new URL('../src/components/LevelSelectScreen.tsx', import.meta.url), 'utf8');
const biomesSrc = readFileSync(new URL('../src/game/world/biomes.ts', import.meta.url), 'utf8');
const identitySrc = readFileSync(new URL('../src/game/level-biome-identity.ts', import.meta.url), 'utf8');

describe('LevelCard authored biome preview contract', () => {
  test('card skin is derived from the authored biome registry (dashverse-biome source)', () => {
    assert.match(selectSrc, /import \{ getLevelBiomeIdentity \} from '@\/game\/world\/biomes'/);
    assert.match(selectSrc, /getLevelBiomeIdentity\(/);
  });

  test('registry maps finite level biomes through the identity derivation', () => {
    assert.match(biomesSrc, /export function getLevelBiomeIdentity/);
    assert.match(biomesSrc, /deriveBiomeIdentity\(/);
    assert.match(biomesSrc, /deriveMixedIdentity\(BIOME_ORDER\.map/);
  });

  test('no invented placeholder palette: the old hardcoded accents are gone', () => {
    assert.doesNotMatch(selectSrc, /#30D158|#FF9F0A|#5AC8FA|#FF453A|#BF5AF2/i);
  });

  test('each card previews its biome with an authored stripe', () => {
    assert.match(selectSrc, /background: biome\.stripe/);
    assert.match(selectSrc, /aria-hidden="true"/);
  });

  test('stripe dims on locked cards along with the rest of the card', () => {
    assert.match(selectSrc, /background: biome\.stripe,[\s\S]{0,120}opacity: locked \? 0\.15 : 1/);
  });

  test('card aria-label announces the authored biome name', () => {
    assert.match(selectSrc, /aria-label=\{`\$\{level\.name\}, \$\{biome\.name\} biome\$\{locked/);
  });

  test('identity derivation stays pure (no RNG, no storage, no DOM)', () => {
    assert.doesNotMatch(identitySrc, /Math\.random|localStorage|sessionStorage|window|document/);
  });

  test('authored registry name flows through the identity untouched', () => {
    assert.match(identitySrc, /name: input\.name/);
  });
});
