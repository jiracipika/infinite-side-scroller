import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Render-path contract tests for the gameplay FX added in the feel pass.
 *
 * renderer.ts can't be imported by the Node test runner (strip-only mode
 * can't parse the enum in its import graph — same reason polish-zoom.test.ts
 * greps source), so these assert the draw contracts textually. The spawns
 * themselves are covered by game-feel-feedback.test.ts, and the visuals were
 * verified in-browser (dash ghosts / landing dust screenshots).
 */

const root = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const rendererSrc = fs.readFileSync(
  path.join(root, 'src/game/rendering/renderer.ts'),
  'utf8',
);

function caseBody(type: string): string {
  const start = rendererSrc.indexOf(`case "${type}":`);
  assert.ok(start >= 0, `renderer has a case for ${type}`);
  // crude slice to the next case/default — enough for contract greps
  const next = rendererSrc.slice(start + 1).search(/case "|default:/);
  return rendererSrc.slice(start, start + 1 + next);
}

describe('renderer FX draw contracts', () => {
  it('air_jump: lead ring (size > 10) strokes an expanding arc', () => {
    const body = caseBody('air_jump');
    assert.match(body, /p\.size > 10/, 'lead-ring branch keyed on size > 10');
    assert.match(body, /strokeStyle = p\.color/, 'stroke uses particle color');
    assert.match(body, /\.arc\(/, 'ring drawn as an arc');
    assert.match(body, /progress \* 1\.3/, 'radius expands as it fades');
    assert.match(body, /fillRect/, 'chips drawn as flat dashes');
  });

  it('stomp_ring: lead ring strokes a flat, wide ellipse', () => {
    const body = caseBody('stomp_ring');
    assert.match(body, /p\.size > 10/, 'lead-ring branch keyed on size > 10');
    assert.match(body, /\.ellipse\(/, 'stomp shockwave drawn as an ellipse');
    assert.match(body, /progress \* 1\.5/, 'ellipse widens as it fades');
  });

  it('dash_ghost: afterimages draw at particle w×h with ghostly alpha', () => {
    const body = caseBody('dash_ghost');
    assert.match(body, /p\.w \?\? p\.size/, 'width falls back from w to size');
    assert.match(body, /p\.h \?\? p\.size/, 'height falls back from h to size');
    assert.match(body, /alpha \* 0\.55/, 'ghostly alpha');
    assert.match(body, /fillRect/, 'drawn as a rect');
  });

  it('powerup_ring: lead ring strokes; chips are round', () => {
    const body = caseBody('powerup_ring');
    assert.match(body, /p\.size > 10/, 'lead-ring branch keyed on size > 10');
    assert.match(body, /strokeStyle = p\.color/, 'stroke uses the power-up color');
    assert.match(body, /\.arc\(/, 'ring drawn as an arc');
  });

  it('landing accepts an intensity argument from the engine', () => {
    const engineSrc = fs.readFileSync(
      path.join(root, 'src/game/engine/game-engine.ts'),
      'utf8',
    );
    assert.match(
      engineSrc,
      /const landingIntensity = landingIntensityFor\(this\.player\.lastLandingVy\);[\s\S]*?spawnLanding\([\s\S]*?landingIntensity,/,
      'engine passes fall-speed intensity into spawnLanding',
    );
    assert.match(
      engineSrc,
      /this\.sfx\.play\("land", landingGainScale\(landingIntensity\)\)/,
      'engine scales land sfx with the same intensity',
    );
  });
});
