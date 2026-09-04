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

  /**
   * Press latch — latches "this action was pressed at some point since the
   * last endFrame()" so brief presses can never be lost. A keydown+keyup that
   * completes between two frames, a press on a rendered-but-not-simulated
   * frame (120Hz displays), or a press while the engine is paused would all
   * be invisible to the prevKeys edge-diff; the latch makes them survive
   * until the next simulation step consumes them.
   */
  private pressedLatch = new Set<string>();

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
  private touchMelee = false;
  private touchMeleePressed = false;
  private touchSpecial = false;
  private touchSpecialPressed = false;

  // Latched counterparts of the *Pressed flags above. The plain flags are
  // cleared every endFrame(); the latches only clear when a simulation step
  // actually ran (see endFrame), so presses on no-update frames survive.
  private touchJumpPressedLatch = false;
  private touchAttackPressedLatch = false;
  private touchDashPressedLatch = false;
  private touchCarryPressedLatch = false;
  private touchMeleePressedLatch = false;
  private touchSpecialPressedLatch = false;

  // Gamepad edge latches, set in beginFrame() when a button transitions
  // up→down relative to the last *simulated* frame. Same survival rule as the
  // touch latches.
  private gamepadPressedLatch = {
    jump: false,
    dash: false,
    attack: false,
    carry: false,
    melee: false,
    special: false,
  };

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
              if (!this.touchJump) {
                this.touchJumpPressed = true;
                this.touchJumpPressedLatch = true;
              }
              this.touchJump = true;
            } else {
              this.touchJump = false;
            }
            break;
          case 'attack-press':
            if (value) {
              if (!this.touchAttack) {
                this.touchAttackPressed = true;
                this.touchAttackPressedLatch = true;
              }
              this.touchAttack = true;
            } else {
              this.touchAttack = false;
            }
            break;
          case 'dash-press':
            if (value) {
              if (!this.touchDash) {
                this.touchDashPressed = true;
                this.touchDashPressedLatch = true;
              }
              this.touchDash = true;
            } else {
              this.touchDash = false;
            }
            break;
          case 'carry-press':
            if (value) {
              if (!this.touchCarry) {
                this.touchCarryPressed = true;
                this.touchCarryPressedLatch = true;
              }
              this.touchCarry = true;
            } else {
              this.touchCarry = false;
            }
            break;
          case 'melee-press':
            if (value) {
              if (!this.touchMelee) {
                this.touchMeleePressed = true;
                this.touchMeleePressedLatch = true;
              }
              this.touchMelee = true;
            } else {
              this.touchMelee = false;
            }
            break;
          case 'special-press':
            if (value) {
              if (!this.touchSpecial) {
                this.touchSpecialPressed = true;
                this.touchSpecialPressedLatch = true;
              }
              this.touchSpecial = true;
            } else this.touchSpecial = false;
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
      // Latch the press immediately. If the key is released before the next
      // simulation step (sub-frame tap, 120Hz no-update frame), the prevKeys
      // diff would never see it — the latch is the only witness.
      this.pressedLatch.add(e.code);
    }
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
    this.keyPressOrder.delete(e.code);
    // Note: intentionally NOT clearing the press latch here — the whole point
    // is for a press-and-release that happens between frames to survive until
    // the next endFrame() snapshot.
  };

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'hidden') this.releaseAll();
  };

  private releaseAll = (): void => {
    this.keys.clear();
    this.prevKeys.clear();
    this.keyPressOrder.clear();
    this.pressedLatch.clear();
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
    this.touchMelee = false;
    this.touchMeleePressed = false;
    this.touchSpecial = false;
    this.touchSpecialPressed = false;
    this.gamepad = { ...EMPTY_GAMEPAD_INPUT };
    this.prevGamepad = { ...EMPTY_GAMEPAD_INPUT };
    this.touchJumpPressedLatch = false;
    this.touchAttackPressedLatch = false;
    this.touchDashPressedLatch = false;
    this.touchCarryPressedLatch = false;
    this.touchMeleePressedLatch = false;
    this.touchSpecialPressedLatch = false;
    this.gamepadPressedLatch.jump = false;
    this.gamepadPressedLatch.dash = false;
    this.gamepadPressedLatch.attack = false;
    this.gamepadPressedLatch.carry = false;
    this.gamepadPressedLatch.melee = false;
    this.gamepadPressedLatch.special = false;
  };

  /** Poll connected controllers once before each rendered frame. */
  beginFrame(): void {
    this.gamepad = this.gamepadEnabled
      ? readGamepadInput(this.gamepadIndex)
      : { ...EMPTY_GAMEPAD_INPUT };
    // Latch controller rising edges against the last *simulated* frame's
    // snapshot. prevGamepad only advances in endUpdate(), so a press on a
    // rendered-but-not-simulated frame is caught here and survives until a
    // simulation step consumes it.
    if (this.gamepad.jump && !this.prevGamepad.jump) this.gamepadPressedLatch.jump = true;
    if (this.gamepad.dash && !this.prevGamepad.dash) this.gamepadPressedLatch.dash = true;
    if (this.gamepad.attack && !this.prevGamepad.attack) this.gamepadPressedLatch.attack = true;
    if (this.gamepad.carry && !this.prevGamepad.carry) this.gamepadPressedLatch.carry = true;
    if (this.gamepad.melee && !this.prevGamepad.melee) this.gamepadPressedLatch.melee = true;
    if (this.gamepad.special && !this.prevGamepad.special) this.gamepadPressedLatch.special = true;
  }

  private getGamepad(): GamepadInputState {
    return this.gamepad;
  }

  private acceptsKey(code: string): boolean {
    // Melee keys are always accepted regardless of keyboard scheme.
    if (code === 'KeyC' || code === 'KeyN' || code === 'KeyV') return true;
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
    if (code === 'KeyC') return this.touchMelee || gamepad.melee;
    if (code === 'KeyV') return this.touchSpecial || gamepad.special;
    if (code === 'KeyF') return this.touchCarry || gamepad.carry;
    return false;
  }

  /** Check if a key or virtual button was just pressed this frame */
  isPressed(code: string): boolean {
    if (this.acceptsKey(code) && this.keys.has(code) && !this.prevKeys.has(code)) return true;
    // Press latch: survives sub-frame taps (down+up between frames) and
    // presses that happened on frames where no simulation step ran (120Hz
    // displays, hit-stop) — the prevKeys diff alone misses both.
    if (this.acceptsKey(code) && this.pressedLatch.has(code)) return true;
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
    // Melee attack — KeyC is the primary melee key. KeyJ is an alternate when
    // the scheme is 'arrows' (where KeyJ already maps to attack). KeyN is a
    // secondary alternate for layouts that prefer it.
    if (code === 'KeyC') {
      if (this.acceptsKey('KeyC') && this.keys.has('KeyC') && !this.prevKeys.has('KeyC')) return true;
      if (this.acceptsKey('KeyN') && this.keys.has('KeyN') && !this.prevKeys.has('KeyN')) return true;
      if (this.touchMeleePressed || this.touchMeleePressedLatch) return true;
      if (gamepad.melee && !this.prevGamepad.melee) return true;
      if (this.gamepadPressedLatch.melee) return true;
    }
    if (code === 'KeyV' && (this.touchSpecialPressed || this.touchSpecialPressedLatch)) return true;
    if (code === 'KeyV' && (gamepad.special && !this.prevGamepad.special)) return true;
    if (code === 'KeyV' && this.gamepadPressedLatch.special) return true;
    if (code === 'KeyF') {
      if (this.acceptsKey('ArrowDown') && this.keys.has('ArrowDown') && !this.prevKeys.has('ArrowDown')) return true;
      if (this.acceptsKey('KeyL') && this.keys.has('KeyL') && !this.prevKeys.has('KeyL')) return true;
      if (this.touchCarryPressed || this.touchCarryPressedLatch) return true;
      if (gamepad.carry && !this.prevGamepad.carry) return true;
      if (this.gamepadPressedLatch.carry) return true;
    }
    if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW')
      && (this.touchJumpPressed || this.touchJumpPressedLatch)) {
      return true;
    }
    if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW')
      && ((gamepad.jump && !this.prevGamepad.jump) || this.gamepadPressedLatch.jump)) {
      return true;
    }
    if ((code === 'KeyX' || code === 'ShiftLeft')
      && (this.touchDashPressed || this.touchDashPressedLatch)) {
      return true;
    }
    if ((code === 'KeyX' || code === 'ShiftLeft')
      && ((gamepad.dash && !this.prevGamepad.dash) || this.gamepadPressedLatch.dash)) {
      return true;
    }
    if ((code === 'KeyE' || code === 'KeyJ' || code === 'KeyZ')
      && (this.touchAttackPressed || this.touchAttackPressedLatch)) {
      return true;
    }
    if ((code === 'KeyE' || code === 'KeyJ' || code === 'KeyZ')
      && ((gamepad.attack && !this.prevGamepad.attack) || this.gamepadPressedLatch.attack)) {
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

  /**
   * Called by the engine after EACH simulation update step (not each rendered
   * frame). Advances the edge snapshots and clears the press latches so a
   * press is consumed by exactly one simulation step — never zero (drops:
   * sub-frame taps, no-update frames) and never two (catch-up frames running
   * multiple updates per rAF would otherwise fire the same press twice,
   * e.g. a ground jump instantly burning the double jump).
   */
  endUpdate(): void {
    this.prevKeys = new Set(this.keys);
    this.prevGamepad = { ...this.gamepad };
    this.pressedLatch.clear();
    this.touchJumpPressed = false;
    this.touchAttackPressed = false;
    this.touchDashPressed = false;
    this.touchCarryPressed = false;
    this.touchMeleePressed = false;
    this.touchSpecialPressed = false;
    this.touchJumpPressedLatch = false;
    this.touchAttackPressedLatch = false;
    this.touchDashPressedLatch = false;
    this.touchCarryPressedLatch = false;
    this.touchMeleePressedLatch = false;
    this.touchSpecialPressedLatch = false;
    this.gamepadPressedLatch.jump = false;
    this.gamepadPressedLatch.dash = false;
    this.gamepadPressedLatch.attack = false;
    this.gamepadPressedLatch.carry = false;
    this.gamepadPressedLatch.melee = false;
    this.gamepadPressedLatch.special = false;
  }

  /**
   * Called at the end of each rendered frame. Edge snapshots now advance in
   * endUpdate(); this only exists so presses that arrived after the last
   * simulation step of the frame stay latched for the next frame when no
   * step ran (paused, hit-stop, 120Hz cadence).
   */
  endFrame(): void {
    // No-op when a simulation step ran — endUpdate already consumed the
    // latches. When no step ran, everything intentionally survives.
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