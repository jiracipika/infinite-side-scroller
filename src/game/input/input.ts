/**
 * Input manager — tracks keyboard and touch state for game controls.
 */

import type { NetInputCommand } from '../multiplayer/types';
import {
  EMPTY_GAMEPAD_INPUT,
  readGamepadInput,
  type GamepadInputState,
} from './gamepad';

export type KeyState = 'up' | 'down' | 'pressed';

export interface InputOptions {
  channel?: string;
  enableKeyboard?: boolean;
  enableGamepad?: boolean;
  /** Browser Gamepad API slot to reserve for this engine instance. */
  gamepadIndex?: number;
  keyboardScheme?: 'all' | 'wasd' | 'arrows';
}

export class InputManager {
  private keys = new Set<string>();
  private prevKeys = new Set<string>();
  private keyPressOrder = new Map<string, number>();
  private inputSequence = 0;
  private touchLeftOrder = 0;
  private touchRightOrder = 0;

  // Touch virtual button state
  private touchLeft = false;
  private touchRight = false;
  private touchJump = false;
  private touchJumpPressed = false;
  private touchAttack = false;
  private touchAttackPressed = false;
  private touchDash = false;
  private touchDashPressed = false;
  private touchCarry = false;
  private touchCarryPressed = false;

  private handleGameInput: ((e: CustomEvent) => void) | null = null;
  private readonly inputChannel: string;
  private readonly keyboardEnabled: boolean;
  private readonly gamepadEnabled: boolean;
  private readonly gamepadIndex: number | undefined;
  private readonly keyboardScheme: 'all' | 'wasd' | 'arrows';
  private gamepad: GamepadInputState = { ...EMPTY_GAMEPAD_INPUT };
  private prevGamepad: GamepadInputState = { ...EMPTY_GAMEPAD_INPUT };

  constructor(options: InputOptions = {}) {
    this.inputChannel = options.channel ?? 'game-input';
    this.keyboardEnabled = options.enableKeyboard ?? true;
    this.gamepadEnabled = options.enableGamepad ?? true;
    this.gamepadIndex = options.gamepadIndex;
    this.keyboardScheme = options.keyboardScheme ?? 'all';

    if (typeof window !== 'undefined') {
      if (this.keyboardEnabled) {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
      }

      // Browsers do not emit keyup/pointerup when focus is lost mid-input.
      // Clear every held control so returning from an app switch, alert, or
      // locked screen cannot leave the player running or attacking forever.
      window.addEventListener('blur', this.releaseAll);
      document.addEventListener('visibilitychange', this.onVisibilityChange);

      // Listen for touch control events from React overlay
      this.handleGameInput = (e: CustomEvent) => {
        const { type, value } = e.detail;
        switch (type) {
          case 'move-left':
            if (value && !this.touchLeft) this.touchLeftOrder = ++this.inputSequence;
            this.touchLeft = !!value;
            break;
          case 'move-right':
            if (value && !this.touchRight) this.touchRightOrder = ++this.inputSequence;
            this.touchRight = !!value;
            break;
          case 'jump-press':
            if (value) {
              if (!this.touchJump) this.touchJumpPressed = true;
              this.touchJump = true;
            } else {
              this.touchJump = false;
            }
            break;
          case 'attack-press':
            if (value) {
              if (!this.touchAttack) this.touchAttackPressed = true;
              this.touchAttack = true;
            } else {
              this.touchAttack = false;
            }
            break;
          case 'dash-press':
            if (value) {
              if (!this.touchDash) this.touchDashPressed = true;
              this.touchDash = true;
            } else {
              this.touchDash = false;
            }
            break;
          case 'carry-press':
            if (value) {
              if (!this.touchCarry) this.touchCarryPressed = true;
              this.touchCarry = true;
            } else {
              this.touchCarry = false;
            }
            break;
        }
      };
      window.addEventListener(this.inputChannel, this.handleGameInput as EventListener);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.acceptsKey(e.code)) return;
    if (!this.keys.has(e.code)) {
      this.keyPressOrder.set(e.code, ++this.inputSequence);
    }
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.keyPressOrder.delete(e.code);
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.releaseAll();
  };

  private releaseAll = (): void => {
    this.keys.clear();
    this.prevKeys.clear();
    this.keyPressOrder.clear();
    this.touchLeft = false;
    this.touchRight = false;
    this.touchJump = false;
    this.touchJumpPressed = false;
    this.touchAttack = false;
    this.touchAttackPressed = false;
    this.touchDash = false;
    this.touchDashPressed = false;
    this.touchCarry = false;
    this.touchCarryPressed = false;
    this.gamepad = { ...EMPTY_GAMEPAD_INPUT };
    this.prevGamepad = { ...EMPTY_GAMEPAD_INPUT };
  };

  /** Poll connected controllers once before each rendered frame. */
  beginFrame(): void {
    this.gamepad = this.gamepadEnabled
      ? readGamepadInput(this.gamepadIndex)
      : { ...EMPTY_GAMEPAD_INPUT };
  }

  private getGamepad(): GamepadInputState {
    return this.gamepad;
  }

  private acceptsKey(code: string): boolean {
    if (this.keyboardScheme === 'all') return true;
    if (this.keyboardScheme === 'wasd') {
      return ['KeyA', 'KeyD', 'KeyW', 'KeyE', 'KeyQ', 'KeyF'].includes(code);
    }
    return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyJ', 'KeyK', 'KeyL', 'ShiftRight'].includes(code);
  }

  /** Resolve opposite-direction rollover: newest held direction wins. */
  getHorizontalAxis(): -1 | 0 | 1 {
    const gamepad = this.getGamepad();
    let leftOrder = this.touchLeft ? this.touchLeftOrder : -1;
    let rightOrder = this.touchRight ? this.touchRightOrder : -1;

    for (const code of ['ArrowLeft', 'KeyA']) {
      if (this.acceptsKey(code) && this.keys.has(code)) {
        leftOrder = Math.max(leftOrder, this.keyPressOrder.get(code) ?? 0);
      }
    }
    for (const code of ['ArrowRight', 'KeyD']) {
      if (this.acceptsKey(code) && this.keys.has(code)) {
        rightOrder = Math.max(rightOrder, this.keyPressOrder.get(code) ?? 0);
      }
    }

    if (gamepad.left && !gamepad.right) return -1;
    if (gamepad.right && !gamepad.left) return 1;
    if (leftOrder < 0 && rightOrder < 0) return 0;
    return rightOrder > leftOrder ? 1 : -1;
  }

  /** Check if a key or virtual button is currently held down */
  isDown(code: string): boolean {
    if (this.acceptsKey(code) && this.keys.has(code)) return true;
    const gamepad = this.getGamepad();
    // Map touch and controller actions to their keyboard equivalents.
    if (code === 'ArrowLeft' || code === 'KeyA') return this.touchLeft || gamepad.left;
    if (code === 'ArrowRight' || code === 'KeyD') return this.touchRight || gamepad.right;
    if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') return this.touchJump || gamepad.jump;
    if (code === 'KeyE' || code === 'KeyJ' || code === 'KeyZ') return this.touchAttack || gamepad.attack;
    if (code === 'KeyX' || code === 'ShiftLeft') return this.touchDash || gamepad.dash;
    if (code === 'KeyF') return this.touchCarry || gamepad.carry;
    return false;
  }

  /** Check if a key or virtual button was just pressed this frame */
  isPressed(code: string): boolean {
    if (this.acceptsKey(code) && this.keys.has(code) && !this.prevKeys.has(code)) return true;
    const gamepad = this.getGamepad();
    if (code === 'KeyX') {
      if (this.acceptsKey('KeyQ') && this.keys.has('KeyQ') && !this.prevKeys.has('KeyQ')) return true;
      if (this.acceptsKey('KeyK') && this.keys.has('KeyK') && !this.prevKeys.has('KeyK')) return true;
    }
    if (code === 'ShiftLeft' && this.acceptsKey('ShiftRight') && this.keys.has('ShiftRight') && !this.prevKeys.has('ShiftRight')) {
      return true;
    }
    if (code === 'KeyZ' && this.acceptsKey('KeyJ') && this.keys.has('KeyJ') && !this.prevKeys.has('KeyJ')) {
      return true;
    }
    if (code === 'KeyF') {
      if (this.acceptsKey('ArrowDown') && this.keys.has('ArrowDown') && !this.prevKeys.has('ArrowDown')) return true;
      if (this.acceptsKey('KeyL') && this.keys.has('KeyL') && !this.prevKeys.has('KeyL')) return true;
      if (this.touchCarryPressed || (gamepad.carry && !this.prevGamepad.carry)) return true;
    }
    if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW')
      && (this.touchJumpPressed || (gamepad.jump && !this.prevGamepad.jump))) {
      return true;
    }
    if ((code === 'KeyX' || code === 'ShiftLeft')
      && (this.touchDashPressed || (gamepad.dash && !this.prevGamepad.dash))) {
      return true;
    }
    if ((code === 'KeyE' || code === 'KeyJ' || code === 'KeyZ')
      && (this.touchAttackPressed || (gamepad.attack && !this.prevGamepad.attack))) {
      return true;
    }
    return false;
  }

  /** Check if attack is held */
  isAttackDown(): boolean {
    return (
      (this.acceptsKey('KeyE') && this.keys.has('KeyE'))
      || (this.acceptsKey('KeyJ') && this.keys.has('KeyJ'))
      || this.touchAttack
      || this.getGamepad().attack
    );
  }

  /** Call at end of frame to snapshot current input state for press detection. */
  endFrame(): void {
    this.prevKeys = new Set(this.keys);
    this.prevGamepad = { ...this.gamepad };
    this.touchJumpPressed = false;
    this.touchAttackPressed = false;
    this.touchDashPressed = false;
    this.touchCarryPressed = false;
  }

  /** Clean up event listeners */
  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keyboardEnabled) {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
      }
      window.removeEventListener('blur', this.releaseAll);
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      if (this.handleGameInput) {
        window.removeEventListener(this.inputChannel, this.handleGameInput as EventListener);
      }
    }
  }

  /** Build a compact input command for multiplayer sequencing/reconciliation. */
  buildNetInputCommand(seq: number, clientTime: number, dtMs: number): NetInputCommand {
    const moveX = this.getHorizontalAxis();

    const jumpPressed = this.isDown('Space') || this.isDown('ArrowUp') || this.isDown('KeyW');
    const attackPressed = this.isAttackDown();
    const dashPressed = (
      this.isDown('KeyX')
      || (this.acceptsKey('KeyQ') && this.keys.has('KeyQ'))
      || (this.acceptsKey('KeyK') && this.keys.has('KeyK'))
      || (this.acceptsKey('ShiftRight') && this.keys.has('ShiftRight'))
    );
    const carryPressed = this.isDown('KeyF');
    const carryAltPressed = (
      (this.acceptsKey('ArrowDown') && this.keys.has('ArrowDown'))
      || (this.acceptsKey('KeyL') && this.keys.has('KeyL'))
    );

    return {
      seq,
      clientTime,
      dtMs: Math.max(1, Math.min(150, Math.round(dtMs))),
      moveX,
      jumpPressed,
      attackPressed,
      dashPressed,
      carryPressed: carryPressed || carryAltPressed,
    };
  }
}
