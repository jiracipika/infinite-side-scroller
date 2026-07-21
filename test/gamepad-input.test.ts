import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import {
  GAMEPAD_AXIS_DEADZONE,
  mapGamepadInput,
} from '@/game/input/gamepad';
import { InputManager } from '@/game/input/input';

function makeGamepad({
  axis = 0,
  buttons = [],
}: {
  axis?: number;
  buttons?: number[];
} = {}): Gamepad {
  const pressed = new Set(buttons);
  return {
    axes: [axis, 0, 0, 0],
    buttons: Array.from({ length: 17 }, (_, index) => ({
      pressed: pressed.has(index),
      touched: pressed.has(index),
      value: pressed.has(index) ? 1 : 0,
    })),
    connected: true,
    id: 'Test standard controller',
    index: 0,
    mapping: 'standard',
    timestamp: 1,
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe('gamepad mapping', () => {
  it('applies an analog deadzone and supports D-pad movement', () => {
    assert.equal(mapGamepadInput(makeGamepad({ axis: GAMEPAD_AXIS_DEADZONE - 0.01 })).right, false);
    assert.equal(mapGamepadInput(makeGamepad({ axis: GAMEPAD_AXIS_DEADZONE })).right, true);
    assert.equal(mapGamepadInput(makeGamepad({ axis: -GAMEPAD_AXIS_DEADZONE })).left, true);
    assert.equal(mapGamepadInput(makeGamepad({ buttons: [14] })).left, true);
    assert.equal(mapGamepadInput(makeGamepad({ buttons: [15] })).right, true);
  });

  it('maps standard face buttons and right bumper to gameplay actions', () => {
    const faceButtons = mapGamepadInput(makeGamepad({ buttons: [0, 1, 2, 3] }));
    assert.deepEqual(
      { jump: faceButtons.jump, dash: faceButtons.dash, attack: faceButtons.attack, carry: faceButtons.carry },
      { jump: true, dash: true, attack: true, carry: true },
    );
    assert.equal(mapGamepadInput(makeGamepad({ buttons: [5] })).attack, true);
  });
});

describe('InputManager gamepad support', () => {
  let originalNavigator: PropertyDescriptor | undefined;
  let gamepad: Gamepad | null;

  beforeEach(() => {
    originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    gamepad = makeGamepad();
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { getGamepads: () => [gamepad] },
    });
  });

  afterEach(() => {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
  });

  it('exposes held movement and edge-triggered actions without repeat firing', () => {
    const input = new InputManager({ enableKeyboard: false });
    gamepad = makeGamepad({ axis: 0.8, buttons: [0, 2] });
    input.beginFrame();

    assert.equal(input.isDown('ArrowRight'), true);
    assert.equal(input.isPressed('Space'), true);
    assert.equal(input.isPressed('KeyE'), true);
    assert.equal(input.isAttackDown(), true);

    input.endFrame();
    assert.equal(input.isPressed('Space'), false);
    assert.equal(input.isPressed('KeyE'), false);
    input.destroy();
  });

  it('includes controller actions in multiplayer input commands', () => {
    const input = new InputManager({ enableKeyboard: false });
    gamepad = makeGamepad({ axis: -0.9, buttons: [0, 1, 2, 3] });
    input.beginFrame();

    assert.deepEqual(input.buildNetInputCommand(7, 1234, 16.4), {
      seq: 7,
      clientTime: 1234,
      dtMs: 16,
      moveX: -1,
      jumpPressed: true,
      attackPressed: true,
      dashPressed: true,
      carryPressed: true,
    });
    input.destroy();
  });

  it('can disable controller polling per engine instance', () => {
    gamepad = makeGamepad({ axis: 1, buttons: [0, 1, 2, 3] });
    const input = new InputManager({ enableKeyboard: false, enableGamepad: false });
    input.beginFrame();

    assert.equal(input.isDown('ArrowRight'), false);
    assert.equal(input.isPressed('Space'), false);
    assert.equal(input.isAttackDown(), false);
    input.destroy();
  });
});
