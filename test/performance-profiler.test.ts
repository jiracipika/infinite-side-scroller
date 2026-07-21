import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PerformanceProfiler } from '@/game/engine/performance-profiler';

function recordFrame(profiler: PerformanceProfiler, rafTime: number) {
  profiler.startFrame(rafTime);
  return profiler.endFrame();
}

describe('PerformanceProfiler visibility recovery', () => {
  it('does not count a background RAF gap as a slow frame', () => {
    const profiler = new PerformanceProfiler();
    const frameMs = 1000 / 60;

    for (let frame = 0; frame <= 60; frame += 1) {
      recordFrame(profiler, frame * frameMs);
    }

    const framesBeforeBackground = profiler.getMetrics().totalFrames;
    profiler.resumeFrameClock(30_000);
    const resumed = recordFrame(profiler, 30_000 + frameMs);

    assert.ok(resumed.frameTime > 16 && resumed.frameTime < 17.5);
    assert.ok(resumed.avgFrameTime > 16 && resumed.avgFrameTime < 17.5);
    assert.ok(resumed.frameTime95th > 16 && resumed.frameTime95th < 17.5);
    assert.equal(resumed.fps, 60);
    assert.equal(resumed.totalFrames, framesBeforeBackground + 1);
  });

  it('builds a fresh FPS sample after resuming', () => {
    const profiler = new PerformanceProfiler();
    const frameMs = 1000 / 30;

    recordFrame(profiler, 0);
    profiler.resumeFrameClock(60_000);
    let metrics = profiler.getMetrics();

    for (let frame = 1; frame <= 31; frame += 1) {
      metrics = recordFrame(profiler, 60_000 + frame * frameMs);
    }

    assert.ok(metrics.fps >= 29 && metrics.fps <= 31);
    assert.ok(metrics.worstFrameTime < 35);
  });
});
