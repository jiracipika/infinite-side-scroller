import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const screen = fs.readFileSync('apps/mobile/app/index.tsx', 'utf8');
const html = fs.readFileSync('apps/mobile/assets/game.html', 'utf8');
const script = html.match(/<script>([\s\S]+)<\/script>/)?.[1];
assert.ok(script, 'The bundled HTML must include the offline game script');

const messages = [];
const frames = [];
const drawingContext = new Proxy({
  createLinearGradient: () => ({ addColorStop() {} }),
  createRadialGradient: () => ({ addColorStop() {} }),
  measureText: () => ({ width: 10 }),
}, { get: (target, key) => target[key] ?? (() => {}) });
const canvas = {
  clientWidth: 390,
  clientHeight: 844,
  width: 390,
  height: 844,
  style: {},
  getContext: () => drawingContext,
  getBoundingClientRect: () => ({ width: 390, height: 844 }),
};
const document = Object.assign(new EventTarget(), {
  getElementById: () => canvas,
  createElement: () => ({ ...canvas }),
});
const window = Object.assign(new EventTarget(), {
  devicePixelRatio: 2,
  innerWidth: 390,
  innerHeight: 844,
  ReactNativeWebView: {
    postMessage: (raw) => messages.push(JSON.parse(raw)),
  },
});
let now = 0;
vm.runInNewContext(script, {
  window,
  document,
  Event,
  CustomEvent,
  performance: { now: () => now },
  requestAnimationFrame: (callback) => frames.push(callback),
  cancelAnimationFrame: () => {},
}, { filename: 'offline-game-webview.js' });

const controls = window.__gameControls;
const engine = window.__gameEngine;
const tick = (count) => {
  for (let i = 0; i < count; i++) {
    now += 1000 / 60;
    for (const callback of frames.splice(0)) callback(now);
  }
};
const sendInput = (type, value) => window.dispatchEvent(new CustomEvent('game-input', { detail: { type, value } }));

assert.equal(messages[0]?.type, 'ready');
assert.equal(controls.getState(), 'paused');
const initialX = engine.player.x;
tick(12);
assert.equal(engine.player.x, initialX, 'A document waiting for native Play must stand still');

controls.startRun({
  seed: 2468,
  paused: true,
  settings: { masterVolume: 0.3, sfxVolume: 0.4, musicVolume: 0.2, reducedParticles: true },
});
assert.equal(engine.worldSeed, 2468);
assert.equal(engine.sfx.masterVolume, 0.3);
assert.equal(engine.sfx.sfxVolume, 0.4);
assert.equal(engine.music.musicVolume, 0.2);
assert.equal(engine.userReducedParticles, true);
assert.equal(controls.getState(), 'paused', 'Backgrounded startup must wait for an explicit Resume');
tick(12);
assert.equal(engine.player.x, initialX);
controls.resume();
tick(12);
assert.ok(engine.player.x > initialX, 'The mobile player advances without a movement button');
assert.ok(messages.some(message => message.type === 'stats'));

assert.equal(engine.player.onGround, true);
sendInput('jump-press', true);
controls.pause();
controls.resume();
tick(1);
assert.ok(engine.player.vy >= 0, 'A queued jump must be cleared when a run pauses');
sendInput('jump-press', true);
sendInput('jump-press', false);
tick(1);
assert.ok(engine.player.vy < 0, 'Jump presses must work after manual Resume');
sendInput('dash-press', true);
sendInput('dash-press', false);
tick(2);
assert.equal(engine.player.dashing, true, 'Slide must activate the dash');

engine.player.alive = false;
engine.player.lives = 0;
engine.player.score = 325;
tick(1);
assert.equal(controls.getState(), 'gameover');
assert.equal(messages.find(message => message.type === 'gameover')?.score, 325);

engine.camera.snapTo(1000, 400);
assert.ok(1000 - engine.camera.x < 390 / 3, 'Portrait framing keeps the runner in the left third');

assert.match(screen, /data\.type === 'ready' && phase === 'loading'/);
assert.match(screen, /AppState\.addEventListener\('change'/);
assert.match(screen, /AppState\.addEventListener\('blur', pauseForInterruption\)/);
assert.match(screen, /runRef\.current\.pauseOnReady = true/);
assert.match(screen, /BackHandler\.addEventListener\('hardwareBackPress'/);

console.log('Offline mobile startup, auto-run, pause, jump and slide verified.');
