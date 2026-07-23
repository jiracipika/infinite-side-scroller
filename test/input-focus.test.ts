import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { InputManager } from '@/game/input/input';

class TestDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

let testWindow: EventTarget;
let testDocument: TestDocument;
let originalWindow: PropertyDescriptor | undefined;
let originalDocument: PropertyDescriptor | undefined;

function dispatchWithProperties(
  target: EventTarget,
  type: string,
  properties: Record<string, unknown>,
): void {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries(properties)) {
    Object.defineProperty(event, key, { value });
  }
  target.dispatchEvent(event);
}

beforeEach(() => {
  originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  testWindow = new EventTarget();
  testDocument = new TestDocument();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: testWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: testDocument });
});

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
  if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
  else Reflect.deleteProperty(globalThis, 'document');
});

describe('InputManager focus safety', () => {
  it('keeps simultaneous movement and action keys independently held', () => {
    const input = new InputManager();
    dispatchWithProperties(testWindow, 'keydown', { code: 'ArrowRight' });
    dispatchWithProperties(testWindow, 'keydown', { code: 'Space' });
    dispatchWithProperties(testWindow, 'keydown', { code: 'KeyE' });

    assert.equal(input.getHorizontalAxis(), 1);
    assert.equal(input.isDown('Space'), true);
    assert.equal(input.isAttackDown(), true);

    dispatchWithProperties(testWindow, 'keyup', { code: 'Space' });
    assert.equal(input.getHorizontalAxis(), 1);
    assert.equal(input.isDown('Space'), false);
    assert.equal(input.isAttackDown(), true);
    input.destroy();
  });

  it('uses the newest direction while opposite keys overlap then falls back', () => {
    const input = new InputManager();
    dispatchWithProperties(testWindow, 'keydown', { code: 'KeyA' });
    assert.equal(input.getHorizontalAxis(), -1);

    dispatchWithProperties(testWindow, 'keydown', { code: 'KeyD' });
    assert.equal(input.getHorizontalAxis(), 1);

    dispatchWithProperties(testWindow, 'keyup', { code: 'KeyD' });
    assert.equal(input.getHorizontalAxis(), -1);
    input.destroy();
  });

  it('applies the same rollover rule to sliding touch directions', () => {
    const input = new InputManager();
    dispatchWithProperties(testWindow, 'game-input', {
      detail: { type: 'move-left', value: true },
    });
    dispatchWithProperties(testWindow, 'game-input', {
      detail: { type: 'move-right', value: true },
    });
    assert.equal(input.getHorizontalAxis(), 1);

    dispatchWithProperties(testWindow, 'game-input', {
      detail: { type: 'move-right', value: false },
    });
    assert.equal(input.getHorizontalAxis(), -1);
    input.destroy();
  });

  it('releases keyboard and touch controls when the window loses focus', () => {
    const input = new InputManager();
    dispatchWithProperties(testWindow, 'keydown', { code: 'ArrowRight' });
    dispatchWithProperties(testWindow, 'game-input', {
      detail: { type: 'attack-press', value: true },
    });

    assert.equal(input.isDown('ArrowRight'), true);
    assert.equal(input.isAttackDown(), true);

    testWindow.dispatchEvent(new Event('blur'));

    assert.equal(input.isDown('ArrowRight'), false);
    assert.equal(input.isAttackDown(), false);
    input.destroy();
  });

  it('releases held controls only when document visibility becomes hidden', () => {
    const input = new InputManager();
    dispatchWithProperties(testWindow, 'keydown', { code: 'KeyA' });

    testDocument.dispatchEvent(new Event('visibilitychange'));
    assert.equal(input.isDown('KeyA'), true);

    testDocument.visibilityState = 'hidden';
    testDocument.dispatchEvent(new Event('visibilitychange'));
    assert.equal(input.isDown('KeyA'), false);
    input.destroy();
  });

  it('removes focus listeners when destroyed', () => {
    const input = new InputManager();
    input.destroy();
    dispatchWithProperties(testWindow, 'keydown', { code: 'ArrowLeft' });
    testWindow.dispatchEvent(new Event('blur'));

    assert.equal(input.isDown('ArrowLeft'), false);
  });
});