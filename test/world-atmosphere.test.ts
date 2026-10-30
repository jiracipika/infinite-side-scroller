import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawDistantSanctuary, drawWorldMotes, paintStoneRelief } from '../src/game/rendering/world-atmosphere';
import type { BackgroundRenderOpts } from '../src/game/rendering/background';

function recorder() {
  const calls: unknown[][] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get: (_, name) => (...args: unknown[]) => calls.push([name, ...args]),
    set: (_, name, value) => { calls.push(['set', name, value]); return true; },
  });
  return { calls, ctx };
}
const opts: BackgroundRenderOpts = { width: 1280, height: 720, cameraX: -600, cameraY: 80,
  gameTime: 2, reducedMotion: false, detail: 'high',
  colors: { ground: '#8be65a', groundDark: '#0b2415', sky: '#0a0a0f', skyGradient: '#20203a', platform: '#c7ff4d' } };

describe('painted world atmosphere', () => {
  it('keeps scenery deterministic, finite and bounded at both quality levels', () => {
    for (const detail of ['low', 'high'] as const) {
      const a = recorder(), b = recorder();
      drawDistantSanctuary(a.ctx, { ...opts, detail }); drawDistantSanctuary(b.ctx, { ...opts, detail });
      assert.deepEqual(a.calls, b.calls);
      assert.ok(a.calls.length > 30 && a.calls.length < 600);
      for (const c of a.calls) for (const n of c.slice(1)) if (typeof n === 'number') assert.ok(Number.isFinite(n));
      assert.equal(a.calls.filter(c => c[0] === 'save').length, a.calls.filter(c => c[0] === 'restore').length);
    }
  });
  it('freezes drifting dust when reduced motion is enabled', () => {
    const a = recorder(), b = recorder(), live = recorder();
    drawWorldMotes(a.ctx, { ...opts, gameTime: 1, reducedMotion: true });
    drawWorldMotes(b.ctx, { ...opts, gameTime: 20, reducedMotion: true });
    drawWorldMotes(live.ctx, { ...opts, gameTime: 20 });
    assert.deepEqual(a.calls, b.calls);
    assert.notDeepEqual(a.calls, live.calls);
    assert.ok(!a.calls.some(c => c[0] === 'set' && c[2] === '#c7ff4d'), 'dust never resembles coins or traversable edges');
  });
  it('keeps stone relief below the collision surface without changing terrain', () => {
    const heights = Array(201).fill(120), r = recorder();
    paintStoneRelief(r.ctx, heights, 42, 0, 0, true);
    assert.deepEqual(heights, Array(201).fill(120));
    for (const c of r.calls.filter(c => ['moveTo', 'lineTo', 'fillRect'].includes(String(c[0])))) assert.ok(Number(c[2]) > 120);
    assert.ok(r.calls.length < 800);
  });
});
