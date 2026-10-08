import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MusicEngine, formSlotForBar } from '@/game/audio/music';

interface Slot {
  pos: number;
  events: string[];
  freqs: number[];
}

/** Spy the private voices and replay one scheduled eighth through the conductor. */
function slot(engine: MusicEngine, index: number): Slot {
  const events: string[] = [];
  const freqs: number[] = [];
  const e = engine as unknown as Record<string, (...args: unknown[]) => void> & { eighthIndex: number };
  for (const name of ['pad', 'bass', 'pluck', 'lead', 'kick', 'snare', 'hat', 'crash']) {
    e[name] = (...args: unknown[]) => {
      events.push(name);
      if (name === 'lead' || name === 'bass') freqs.push(args[0] as number);
    };
  }
  e.scheduleEighth(index, 0);
  return { pos: index % 8, events, freqs };
}

describe('song form — the anthem gets a bridge, fills, and crashes', () => {
  it('the form is 16 bars: verse (8) → bridge (4) → verse reprise (4)', () => {
    // Verse opens on Am with the authored hook.
    assert.equal(formSlotForBar(0).chord.bassMidi, 45, 'bar 0 = Am');
    assert.equal(formSlotForBar(0).melodyBar[0], 69, 'bar 0 opens on the A hook');
    assert.equal(formSlotForBar(4).melodyBar[0], 81, 'bar 4 is the octave answer');

    // Bridge lifts through F–G–Am–E with its own melody.
    assert.deepEqual(
      [8, 9, 10, 11].map((b) => formSlotForBar(b).chord.bassMidi),
      [41, 43, 45, 40],
      'bridge = F–G–Am–E',
    );
    assert.equal(formSlotForBar(8).melodyBar[0], 65, 'bridge has its own hook (F)');

    // Reprise returns home to Am with the verse's first phrase.
    assert.equal(formSlotForBar(12).chord.bassMidi, 45, 'reprise returns to Am');
    assert.equal(formSlotForBar(12).melodyBar[0], 69, 'reprise reprises the opening hook');

    // The cycle wraps cleanly.
    assert.equal(formSlotForBar(16).chord.bassMidi, 45, 'bar 16 = bar 0');
    assert.equal(formSlotForBar(24).chord.bassMidi, 41, 'bar 24 = bridge again');
  });

  it('fills roll on the last bar of each section; crashes mark the new one', () => {
    assert.equal(formSlotForBar(6).isFillBar, false, 'mid-verse is calm');
    assert.equal(formSlotForBar(7).isFillBar, true, 'verse rolls into the bridge');
    assert.equal(formSlotForBar(11).isFillBar, true, 'bridge rolls into the reprise');
    assert.equal(formSlotForBar(8).isSectionDownbeat, true, 'bridge opens with a hit');
    assert.equal(formSlotForBar(12).isSectionDownbeat, true, 'reprise opens with a hit');
    assert.equal(formSlotForBar(0).isSectionDownbeat, false, 'cycle wrap breathes');
  });

  it('the schedule actually plays fills and crashes at the seams', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.8);
    // Bar 7 (fill bar): snare rolls on EVERY eighth, e.g. pos 1 and pos 5.
    assert.ok(slot(engine, 7 * 8 + 1).events.includes('snare'), 'fill rolls on pos 1');
    assert.ok(slot(engine, 7 * 8 + 5).events.includes('snare'), 'fill rolls on pos 5');
    // A non-fill bar keeps the plain backbeat.
    assert.ok(!slot(engine, 1).events.includes('snare'), 'bar 0 pos 1 stays quiet');
    // Section downbeats fire the crash.
    assert.ok(slot(engine, 8 * 8).events.includes('crash'), 'bridge opens with a crash');
    assert.ok(slot(engine, 12 * 8).events.includes('crash'), 'reprise opens with a crash');
    assert.ok(!slot(engine, 0).events.includes('crash'), 'no crash mid-verse');
    engine.dispose();
  });

  it('the bridge melody is authored data: 4 bars × 8 eighths, breathing', () => {
    const bridgeBar = formSlotForBar(8).melodyBar;
    assert.equal(bridgeBar.length, 8);
    assert.ok(bridgeBar.some((n) => n === 0), 'the bridge breathes too');
    for (const b of [8, 9, 10, 11]) {
      for (const n of formSlotForBar(b).melodyBar) {
        assert.ok(n >= 0 && n <= 86, `bridge MIDI in range (${n})`);
      }
    }
    // The bridge peak is the high A (81) over the Am bar.
    assert.ok(formSlotForBar(10).melodyBar.includes(81), 'bridge climbs to the high A');
  });

  it('the phrase-end bass walks into the next chord root', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.8);
    // Bar 3 pos 7 (index 31): the verse wraps G → Am, so the walk targets
    // the Am root (45 → 110Hz).
    const walk = slot(engine, 3 * 8 + 7);
    assert.ok(walk.events.includes('bass'), 'approach bass fires');
    assert.ok(
      walk.freqs.some((f) => Math.abs(f - 110) < 0.5),
      'approach targets the next root (A2)',
    );
    // Bar 7 pos 7 (index 63): the verse rolls into the bridge — the walk
    // targets the bridge's F root (41 → ~87.3Hz).
    const bridgeWalk = slot(engine, 7 * 8 + 7);
    assert.ok(
      bridgeWalk.freqs.some((f) => Math.abs(f - 87.31) < 0.5),
      'verse→bridge seam walks into F2',
    );
    engine.dispose();
  });
});

describe('menu scene — the soundtrack idles mellow under the menus', () => {
  it('menu pins the mix low: no hook, no drums, even at full run intensity', () => {
    const engine = new MusicEngine();
    engine.setScene('menu');
    engine.setIntensity(1); // stale run intensity must NOT leak into the menu
    for (const index of [0, 2, 4, 6, 1, 3]) {
      const s = slot(engine, index);
      assert.ok(!s.events.includes('lead'), `no hook in the menu (index ${index})`);
      assert.ok(!s.events.includes('kick'), 'no kick in the menu');
      assert.ok(!s.events.includes('snare'), 'no snare in the menu');
      assert.ok(!s.events.includes('hat'), 'no hats in the menu');
      assert.ok(!s.events.includes('crash'), 'no crashes in the menu');
    }
    // The bed is still alive: pads on the downbeat, bass root under 0.38.
    assert.ok(slot(engine, 0).events.includes('pad'), 'menu keeps the pad bed');
    assert.ok(slot(engine, 0).events.includes('bass'), 'menu keeps the bass pulse');
    engine.dispose();
  });

  it('switching back to the run scene restores the anthem layers', () => {
    const engine = new MusicEngine();
    engine.setScene('menu');
    engine.setIntensity(0.8);
    assert.ok(!slot(engine, 0).events.includes('lead'), 'menu: hook dark');
    engine.setScene('run');
    assert.ok(slot(engine, 0).events.includes('lead'), 'run: hook rides again');
    engine.dispose();
  });
});
