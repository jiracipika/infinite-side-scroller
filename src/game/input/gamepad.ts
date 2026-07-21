export interface GamepadInputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  attack: boolean;
  dash: boolean;
  carry: boolean;
}

export const EMPTY_GAMEPAD_INPUT: Readonly<GamepadInputState> = Object.freeze({
  left: false,
  right: false,
  jump: false,
  attack: false,
  dash: false,
  carry: false,
});

export const GAMEPAD_AXIS_DEADZONE = 0.35;

function buttonDown(gamepad: Gamepad, index: number): boolean {
  const button = gamepad.buttons[index];
  return Boolean(button && (button.pressed || button.value > 0.5));
}

/**
 * Convert a standard-layout controller into the game's action vocabulary.
 * A/B/X/Y map to jump/dash/attack/carry; the right bumper also attacks.
 */
export function mapGamepadInput(gamepad: Gamepad): GamepadInputState {
  const horizontalAxis = Number.isFinite(gamepad.axes[0]) ? gamepad.axes[0]! : 0;

  return {
    left: horizontalAxis <= -GAMEPAD_AXIS_DEADZONE || buttonDown(gamepad, 14),
    right: horizontalAxis >= GAMEPAD_AXIS_DEADZONE || buttonDown(gamepad, 15),
    jump: buttonDown(gamepad, 0),
    dash: buttonDown(gamepad, 1),
    attack: buttonDown(gamepad, 2) || buttonDown(gamepad, 5),
    carry: buttonDown(gamepad, 3),
  };
}

/** Read the first connected controller without assuming Gamepad API support. */
export function readGamepadInput(): GamepadInputState {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return { ...EMPTY_GAMEPAD_INPUT };
  }

  try {
    const gamepads = navigator.getGamepads();
    for (const gamepad of gamepads) {
      if (gamepad?.connected) return mapGamepadInput(gamepad);
    }
  } catch {
    // Some embedded webviews expose getGamepads but reject access.
  }

  return { ...EMPTY_GAMEPAD_INPUT };
}
