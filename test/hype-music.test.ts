import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { MusicEngine } from '@/game/audio/music';

const MUSIC_SRC = readFileSync(new URL('../src/game/audio/music.ts', import.meta.url), 'utf8');

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
  for (const name of ['pad', 'bass', 'pluck', 'lead', 'kick', 'snare', 'hat']) {
    e[name] = (...args: unknown[]) => {
      events.push(name);
      if (name === 'lead' || name === 'bass') freqs.push(args[0] as number);
    };
  }
  e.scheduleEighth(index, 0);
  return { pos: index % 8, events, freqs };
}

describe('hype chiptune layer — the soundtrack becomes an 8-bit anthem', () => {
  it('stays SSR-safe: no window, no throw, never playing', () => {
    const engine = new MusicEngine();
    assert.doesNotThrow(() => engine.start());
    assert.equal(engine.isPlaying, false);
    engine.dispose();
  });

  it('the tempo ramps 120 → ~158 BPM with intensity', () => {
    const engine = new MusicEngine();
    assert.equal(engine.tempoBpm, 120, 'calm runs start at 120 BPM');
    engine.setIntensity(1);
    const fullHype = engine.tempoBpm;
    assert.ok(fullHype >= 155 && fullHype <= 160, `full hype ≈158 (got ${fullHype})`);
    engine.setIntensity(0.5);
    const mid = engine.tempoBpm;
    assert.ok(mid > 120 && mid < fullHype, 'monotonic between the extremes');
    engine.dispose();
  });

  it('the composed lead hook enters at 0.45 intensity — authored, not random', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.3);
    const calm = slot(engine, 0);
    assert.ok(!calm.events.includes('lead'), 'calm runs: no hook yet');
    engine.setIntensity(0.5);
    const bar0 = slot(engine, 0); // bar 0, eighth 0 → melody[0][0] = A5
    assert.ok(bar0.events.includes('lead'), 'lead rides on top once heated');
    assert.ok(bar0.freqs.some((f) => Math.abs(f - 440) < 0.5), 'first hook note is A5 (440Hz)');
    const rest = slot(engine, 1); // melody[0][1] = 0 → rest
    assert.ok(!rest.events.includes('lead'), 'authored rests stay silent');
    engine.dispose();
  });

  it('the answer phrase jumps the octave for the hype peak', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.6);
    const low = slot(engine, 0); // bar 0: A5
    const high = slot(engine, 32); // bar 4: A6
    const lowMax = Math.max(...low.freqs);
    const highMax = Math.max(...high.freqs);
    assert.ok(highMax > lowMax * 1.9, `answer phrase sits an octave up (${highMax} vs ${lowMax})`);
    engine.dispose();
  });

  it('drums build a backbeat: kick on 0/4, snare on 2/6, hats off-eighth', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.8);
    assert.ok(slot(engine, 2).events.includes('snare'), 'snare on beat 2');
    assert.ok(slot(engine, 6).events.includes('snare'), 'snare on beat 4');
    assert.ok(slot(engine, 4).events.includes('kick'), 'kick on beat 3');
    assert.ok(slot(engine, 1).events.includes('hat'), 'hats on off-eighths');
    engine.setIntensity(0.4);
    assert.ok(!slot(engine, 2).events.includes('snare'), 'no drums before 0.5');
    engine.dispose();
  });

  it('the bass switches to a driving square walk at high intensity', () => {
    const engine = new MusicEngine();
    engine.setIntensity(0.4);
    assert.ok(!slot(engine, 2).events.includes('bass'), 'calm bass only on 0 and 4');
    engine.setIntensity(0.8);
    assert.ok(slot(engine, 2).events.includes('bass'), 'walking eighths at hype');
    const walk = slot(engine, 6);
    assert.ok(walk.events.includes('bass'), 'eighth 6 walks too');
    assert.ok(walk.freqs[0] > 200, 'octave jump on the walk (A3 → A4)');
    engine.dispose();
  });

  it('the hook is authored data: 8 bars × 8 eighths, chord-toned, rest-breathing', () => {
    const bars = MUSIC_SRC.match(/LEAD_MELODY: number\[\]\[\] = \[([\s\S]*?)\];/);
    assert.ok(bars, 'LEAD_MELODY table exists');
    const rows = [...bars![1].matchAll(/\[([\d,\s]+)\]/g)].map((m) =>
      m[1].split(',').map((n) => parseInt(n.trim(), 10)));
    assert.equal(rows.length, 8, 'two four-bar phrases');
    for (const row of rows) {
      assert.equal(row.length, 8, 'eight eighths per bar');
      assert.ok(row.some((n) => n === 0), 'every bar breathes with a rest');
      for (const n of row) assert.ok(n >= 0 && n <= 86, `MIDI in range (${n})`);
    }
    // Every bar opens on a chord-toned hook note (the groove's anchor).
    const roots = [69, 65, 64, 62, 81, 77, 76, 74];
    for (let b = 0; b < 8; b++) {
      assert.ok(rows[b][0] > 0, `bar ${b} opens with a note`);
      assert.equal(rows[b][0], roots[b], `bar ${b} downbeat matches the expected hook`);
    }
  });

  it('the voices speak 8-bit: square leads, square hype bass, noise drums', () => {
    assert.match(MUSIC_SRC, /type = "square"/, 'square-wave voices');
    assert.match(MUSIC_SRC, /square \? "square" : "sine"/, 'bass timbre flips with intensity');
    assert.match(MUSIC_SRC, /exponentialRampToValueAtTime\(45/, 'kick pitch-drop');
    assert.match(MUSIC_SRC, /filter\.type = "bandpass"/, 'snare bandpass');
    assert.match(MUSIC_SRC, /EIGHTH_FAST_SEC = 0\.19/, 'tempo ceiling ~158 BPM');
  });
});
