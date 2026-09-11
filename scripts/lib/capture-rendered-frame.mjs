/**
 * Render-bound capture: resolves with the canvas + engine state only at the
 * moment a frame matching the requested action is actually painted. A plain
 * flag read + toDataURL can pair current flags with a stale painted frame;
 * this wraps engine.render so the evidence belongs to a real frame. Also
 * usable outside Playwright (unit-tested with a fake engine in Node).
 *
 * Export-stripped copy is injected into the browser page by
 * scripts/test-fidelity-browser.mjs.
 */
export async function captureRenderedFrame({ action, timeoutMs = 4000 }) {
  const engine = globalThis.__engine;
  if (!engine || !engine.player) throw new Error('engine handle missing');
  const canvas = globalThis.document && typeof globalThis.document.querySelector === 'function'
    ? globalThis.document.querySelector('canvas') : null;
  const matches = () => {
    const p = engine.player;
    switch (action) {
      case 'idle': return true;
      case 'run': return Math.abs(p.vx) > 10;
      case 'jump': return p.vy < 0;
      case 'combat': return !!p.meleeActive;
      case 'dash': return !!p.dashing;
      default: return false;
    }
  };
  return await new Promise((resolve, reject) => {
    const original = engine.render;
    let seq = 0;
    let done = false;
    const finish = (settle, value) => {
      if (done) return;
      done = true;
      engine.render = original;
      clearTimeout(timer);
      settle(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`No rendered ${action} frame within ${timeoutMs}ms`)),
      timeoutMs);
    engine.render = function renderProbe(...args) {
      const out = original.apply(this, args);
      seq += 1;
      if (matches()) {
        const p = engine.player;
        finish(resolve, {
          snapshot: typeof engine.getLocalPlayerSnapshot === 'function'
            ? engine.getLocalPlayerSnapshot() : null,
          vx: p.vx, vy: p.vy,
          dashing: !!p.dashing, meleeActive: !!p.meleeActive,
          canvas: canvas && typeof canvas.toDataURL === 'function' ? canvas.toDataURL() : null,
          renderSequence: seq,
        });
      }
      return out;
    };
  });
}
