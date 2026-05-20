/**
 * Input manager — tracks keyboard and touch state for game controls.
 */

import type { NetInputCommand } from '../multiplayer/types';

export type KeyState = 'up' | 'down' | 'pressed';

export interface InputOptions {
  channel?: string;
  enableKeyboard?: boolean;
  keyboardScheme?: 'all' | 'wasd' | 'arrows';
}

export class InputManager {
  private keys = new Set<string>();
  private prevKeys = new Set<string>();

  // Touch virtual button state
  private touchLeft = false;
  private touchRight = false;
  private touchJump = false;
  private touchJumpPressed = false;
  private touchAttack = false;
  private touchAttackPressed = false;
  private touchDash = false;
  private touchDashPressed = false;

  private handleGameInput: ((e: CustomEvent) => void) | null = null;
  private readonly inputChannel: string;
  private readonly keyboardEnabled: boolean;
  private readonly keyboardScheme: 'all' | 'wasd' | 'arrows';

  constructor(options: InputOptions = {}) {
    this.inputChannel = options.channel ?? 'game-input';
    this.keyboardEnabled = options.enableKeyboard ?? true;
    this.keyboardScheme = options.keyboardScheme ?? 'all';

    if (typeof window !== 'undefined') {
      if (this.keyboardEnabled) {
        window.addEventListener('keydown', this.onKeyDown);
        window.addEventListener('keyup', this.onKeyUp);
      }

      // Listen for touch control events from React overlay
      this.handleGameInput = (e: CustomEvent) => {
        const { type, value } = e.detail;
        switch (type) {
          case 'move-left':
            this.touchLeft = !!value;
            break;
          case 'move-right':
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
        }
      };
      window.addEventListener(this.inputChannel, this.handleGameInput as EventListener);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.acceptsKey(e.code)) return;
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private acceptsKey(code: string): boolean {
    if (this.keyboardScheme === 'all') return true;
    if (this.keyboardScheme === 'wasd') {
      return ['KeyA', 'KeyD', 'KeyW', 'KeyE', 'KeyQ', 'KeyF'].includes(code);
    }
    return ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyJ', 'KeyK', 'KeyL', 'ShiftRight'].includes(code);
  }

  /** Check if a key or virtual button is currently held down */
  isDown(code: string): boolean {
    if (this.acceptsKey(code) && this.keys.has(code)) return true;
    // Map touch controls to key codes
    if (code === 'ArrowLeft' || code === 'KeyA') return this.touchLeft;
    if (code === 'ArrowRight' || code === 'KeyD') return this.touchRight;
    return false;
  }

  /** Check if a key or virtual button was just pressed this frame */
  isPressed(code: string): boolean {
    if (this.acceptsKey(code) && this.keys.has(code) && !this.prevKeys.has(code)) return true;
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
    }
    if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW') && this.touchJumpPressed) {
      return true;
    }
    if ((code === 'KeyX' || code === 'ShiftLeft') && this.touchDashPressed) {
      return true;
    }
    if ((code === 'KeyE' || code === 'KeyJ') && this.touchAttackPressed) {
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
    );
  }

  /** Call at end of frame to snapshot current key state for next-frame press detection */
  endFrame(): void {
    this.prevKeys = new Set(this.keys);
    this.touchJumpPressed = false;
    this.touchAttackPressed = false;
    this.touchDashPressed = false;
  }

  /** Clean up event listeners */
  destroy(): void {
    if (typeof window !== 'undefined') {
      if (this.keyboardEnabled) {
        window.removeEventListener('keydown', this.onKeyDown);
        window.removeEventListener('keyup', this.onKeyUp);
      }
      if (this.handleGameInput) {
        window.removeEventListener(this.inputChannel, this.handleGameInput as EventListener);
      }
    }
  }

  /** Build a compact input command for multiplayer sequencing/reconciliation. */
  buildNetInputCommand(seq: number, clientTime: number, dtMs: number): NetInputCommand {
    const moveX: -1 | 0 | 1 = (this.isDown('ArrowLeft') || this.isDown('KeyA'))
      ? -1
      : (this.isDown('ArrowRight') || this.isDown('KeyD'))
        ? 1
        : 0;

    const jumpPressed = this.isDown('Space') || this.isDown('ArrowUp') || this.isDown('KeyW') || this.touchJump;
    const attackPressed = this.isAttackDown();
    const dashPressed = (
      (this.acceptsKey('KeyQ') && this.keys.has('KeyQ'))
      || (this.acceptsKey('KeyK') && this.keys.has('KeyK'))
      || (this.acceptsKey('ShiftRight') && this.keys.has('ShiftRight'))
      || this.touchDash
    );
    const carryPressed = this.acceptsKey('KeyF') && this.keys.has('KeyF');
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
