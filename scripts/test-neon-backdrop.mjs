import {test,describe} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const background=read('../src/game/rendering/background.ts');
const city=read('../src/game/rendering/ink-city.ts');
const renderer=read('../src/game/rendering/renderer.ts');
// Replaces the superseded hill/cloud implementation contract. Runtime geometry
// invariants (opacity, anchoring, fidelity, collision tops) live in ink-city.test.ts.
describe('industrial graphic-novel integration',()=>{
 test('real background calls the three-plate city, not duplicate legacy scenery',()=>{assert.match(background,/paintIndustrialCity\(ctx, width, height, cameraX, cameraY, detail === "high"\)/);assert.doesNotMatch(background,/drawInkSkyline|drawChromaticStreams|drawCloudShape/);assert.match(city,/layer\s*<\s*3/);});
 test('all procedural marks stay deterministic',()=>{assert.doesNotMatch(background+city,/Math\.random/);assert.match(city,/textureHash/);});
 test('environment emphasis is violet rather than lime window spam',()=>{assert.match(city,/ctx\.strokeStyle\s*=\s*INK\.lavender/);assert.doesNotMatch(city,/shadowBlur|createRadialGradient/);});
 test('cached terrain facade and accurate slab are wired to live renderer',()=>{assert.match(renderer,/paintRooftopFacade\(ctx, chunk\.heights/);assert.match(renderer,/paintInkSlab\(ctx, screen\.x, screen\.y, platform\.width/);assert.match(renderer,/paintRoofProp\(this\.ctx/);});
 test('dash brush respects reduced motion',()=>{assert.match(renderer,/player\.dashing && !camera\.isReducedMotion\(\)/);assert.match(renderer,/paintDashBrush\(ctx/);});
 test('sky paints only the dominant celestial body during crossfade',()=>{assert.match(background,/moonAlpha >= sunAlpha/);assert.match(background,/sunAlpha > moonAlpha/);});
});
