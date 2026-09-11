import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captureRenderedFrame } from './lib/capture-rendered-frame.mjs';

test('capture waits for the matching painted frame, not current flags over an old canvas', async () => {
  let painted = 'idle';
  const player = { dashing: false, meleeActive: true, vx: 0, vy: 0, onGround: true };
  const engine = { player, getLocalPlayerSnapshot: () => ({ ...player, characterId: 'ninja' }),
    render() { painted = player.meleeActive ? 'combat' : 'idle'; } };
  const original = engine.render;
  globalThis.__engine = engine;
  globalThis.document = { querySelector: () => ({ toDataURL: () => painted }) };
  try {
    let settled = false;
    const pending = captureRenderedFrame({ action: 'combat', timeoutMs: 1000 }).then(x => { settled = true; return x; });
    await Promise.resolve();
    assert.equal(settled, false, 'flags changed but no new frame was painted');
    player.meleeActive = false;
    engine.render();
    await Promise.resolve();
    assert.equal(settled, false, 'nonmatching render must not satisfy capture');
    player.meleeActive = true;
    engine.render();
    const result = await pending;
    assert.equal(result.canvas, 'combat');
    assert.equal(result.meleeActive, true);
    assert.equal(result.renderSequence, 2);
    assert.equal(engine.render, original);
  } finally { delete globalThis.__engine; delete globalThis.document; }
});

test('timeout rejects and restores the original renderer', async () => {
  const engine = { player: {}, render() {} };
  const original = engine.render;
  globalThis.__engine = engine;
  try {
    await assert.rejects(captureRenderedFrame({ action: 'dash', timeoutMs: 5 }), /No rendered dash frame/);
    assert.equal(engine.render, original);
  } finally { delete globalThis.__engine; }
});
