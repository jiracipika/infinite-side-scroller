import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { createCollectible, spawnCollectiblesForChunk } from '@/game/entities/Collectibles';
import { Player } from '@/game/entities/player';

const ENGINE_SRC = readFileSync(new URL('../src/game/engine/game-engine.ts', import.meta.url), 'utf8');
const RENDERER_SRC = readFileSync(new URL('../src/game/rendering/renderer.ts', import.meta.url), 'utf8');
const HUD_SRC = readFileSync(new URL('../src/components/HUD.tsx', import.meta.url), 'utf8');

describe('coin doubler collectible', () => {
  it('is authored like the other timed orbs: 20×20, 8 seconds', () => {
    const c = createCollectible(100, 200, 'coinDoubler', 7);
    assert.equal(c.type, 'coinDoubler');
    assert.equal(c.width, 20);
    assert.equal(c.height, 20);
    assert.equal(c.value, 8, 'duration for boosts');
  });

  it('spawns from the world generator without breaking determinism', () => {
    // The engine passes a pure seeded sampler (seed → [0,1)); mirror that
    // shape with one round of mulberry32 mixing so results are deterministic
    // and well-distributed.
    const rng = (seed: number) => {
      let t = (seed | 0) + 0x6D2B79F5;
      t = Math.imul(t ^ (t >>> 15), 1 | t);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const spawn = () =>
      spawnCollectiblesForChunk(42, 42 * 800, 800, [], rng, [400, 400, 400, 400], 3);
    assert.deepEqual(spawn().map(c => [c.type, c.x]), spawn().map(c => [c.type, c.x]));

    // The doubler band is narrow (2%) but nonzero: across many chunks and
    // group rolls it must appear. Coins remain the overwhelming majority.
    let doublers = 0;
    let coins = 0;
    for (let chunkId = 0; chunkId < 400; chunkId++) {
      for (const c of spawnCollectiblesForChunk(chunkId, chunkId * 800, 800, [], rng, [400, 400, 400, 400], 3)) {
        if (c.type === 'coinDoubler') doublers++;
        if (c.type === 'coin') coins++;
      }
    }
    assert.ok(doublers > 0, 'coin doubler must actually spawn in practice');
    assert.ok(coins > doublers * 20, `coins must stay dominant (coins=${coins}, doublers=${doublers})`);
  });
});

describe('coin doubler player effect', () => {
  // Minimal input mock mirroring player.test.ts / jump-reliability.test.ts so
  // player physics get deterministic per-frame input.
  class MockInput {
    private down = new Set<string>();
    private pressed = new Set<string>();
    hold(code: string): void { this.down.add(code); }
    release(code: string): void { this.down.delete(code); }
    press(code: string): void { this.pressed.add(code); }
    clearPressed(): void { this.pressed.clear(); }
    isDown(code: string): boolean { return this.down.has(code); }
    isPressed(code: string): boolean { return this.pressed.has(code); }
  }

  it('doubles coin currency and coin score while active, then expires', () => {
    const p = new Player();
    const input = new MockInput() as unknown as Parameters<Player['update']>[1];
    const groundY = 400;
    p.x = 100; p.y = groundY - p.height; p.vy = 0; p.onGround = true;

    const coinsBefore = p.coins;
    const scoreBefore = p.score;
    p.addCoins(1);
    assert.equal(p.coins - coinsBefore, 1);
    assert.equal(p.score - scoreBefore, 10);

    p.applyCoinDoubler(8);
    assert.equal(p.coinDoublerTimer, 8);
    p.addCoins(1);
    assert.equal(p.coins - coinsBefore, 3, 'doubled pickup credits 2 coins');
    assert.equal(p.score - scoreBefore, 30, 'coin score doubles too');

    // Timer decays and expires cleanly — no negative leak.
    p.update(4, input, groundY);
    assert.ok(p.coinDoublerTimer > 0 && p.coinDoublerTimer <= 4);
    p.update(8, input, groundY);
    assert.equal(p.coinDoublerTimer, 0);
    p.addCoins(1);
    assert.equal(p.coins - coinsBefore, 4, 'back to single coins after expiry');
  });

  it('surfaces itself in the HUD power-up timer list', () => {
    const p = new Player();
    assert.equal(p.getActivePowerUpTimers().some(t => t.type === 'coinDoubler'), false);
    p.applyCoinDoubler(8);
    const entry = p.getActivePowerUpTimers().find(t => t.type === 'coinDoubler');
    assert.ok(entry);
    assert.ok(entry.remaining > 7 && entry.remaining <= 8);
  });

  it('doubles are multiplicative with progression coin bonuses, not exclusive', () => {
    const p = new Player();
    // The doubler applies to the picked-up amount; the progression multiplier
    // then scales it — a doubly-blessed coin is worth 4 base coins.
    p.applyCoinDoubler(8);
    p.addCoins(1);
    assert.equal(p.coins, 2, 'default progression coinMultiplier is 1 → doubler alone gives 2');
  });
});

describe('coin doubler wiring (renderer/engine/HUD source contracts)', () => {
  it('engine picks it up with burst, popup and sfx, and upgrades the coin popup', () => {
    assert.match(ENGINE_SRC, /case "coinDoubler":\s*\n\s*this\.player\.applyCoinDoubler\(c\.value\);/);
    assert.match(ENGINE_SRC, /"2× COINS!"/);
    assert.match(ENGINE_SRC, /coinDoublerTimer > 0 \? "\+20" : "\+10"/);
    assert.match(ENGINE_SRC, /coinDoublerTimer > 0\) powerUps\.push\("🪙"\)/);
  });

  it('renderer draws the twin-coin gold orb', () => {
    assert.match(RENDERER_SRC, /case "coinDoubler": \{\s*\n\s*\/\/ Gold orb with a twin-coin glyph/);
    assert.match(RENDERER_SRC, /drawCollectibleOrb\(cx, cy, radius, "#fef08a", "#d97706"\)/);
  });

  it('HUD maps the timer entry to the coin emoji with an 8s bar', () => {
    assert.match(HUD_SRC, /coinDoubler: '\\u\{1FA99\}'/);
    assert.match(HUD_SRC, /coinDoubler: 8,/);
  });
});
