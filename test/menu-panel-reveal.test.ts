import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { schedulePanelReveal } from '@/lib/menu-panel-reveal';

describe('schedulePanelReveal', () => {
  it('waits for React to render before revealing the expanded panel', () => {
    const frames: FrameRequestCallback[] = [];
    const calls: ScrollIntoViewOptions[] = [];
    const element = {
      scrollIntoView: (options?: boolean | ScrollIntoViewOptions) => calls.push(options as ScrollIntoViewOptions),
    } as Element;

    schedulePanelReveal('run-lab-panel', {
      schedule: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      find: (id) => id === 'run-lab-panel' ? element : null,
      reducedMotion: false,
    });

    assert.equal(calls.length, 0);
    frames.shift()?.(0);
    assert.equal(calls.length, 0);
    frames.shift()?.(16);
    assert.deepEqual(calls, [{ behavior: 'smooth', block: 'start' }]);
  });

  it('uses instant scrolling for reduced-motion users', () => {
    const frames: FrameRequestCallback[] = [];
    let behavior: ScrollBehavior | undefined;
    const element = {
      scrollIntoView: (options?: boolean | ScrollIntoViewOptions) => {
        behavior = (options as ScrollIntoViewOptions).behavior;
      },
    } as Element;

    schedulePanelReveal('settings-panel', {
      schedule: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      find: () => element,
      reducedMotion: true,
    });
    frames.shift()?.(0);
    frames.shift()?.(16);

    assert.equal(behavior, 'auto');
  });

  it('does nothing when the panel is no longer mounted', () => {
    const frames: FrameRequestCallback[] = [];
    schedulePanelReveal('missing-panel', {
      schedule: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      find: () => null,
      reducedMotion: false,
    });

    assert.doesNotThrow(() => {
      frames.shift()?.(0);
      frames.shift()?.(16);
    });
  });
});
