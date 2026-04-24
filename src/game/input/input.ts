/**
 * Input manager — tracks keyboard and touch state for game controls.
 */

export type KeyState = 'up' | 'down' | 'pressed';

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

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);

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
      window.addEventListener('game-input', this.handleGameInput as EventListener);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  /** Check if a key or virtual button is currently held down */
  isDown(code: string): boolean {
    if (this.keys.has(code)) return true;
    // Map touch controls to key codes
    if (code === 'ArrowLeft' || code === 'KeyA') return this.touchLeft;
    if (code === 'ArrowRight' || code === 'KeyD') return this.touchRight;
    return false;
  }

  /** Check if a key or virtual button was just pressed this frame */
  isPressed(code: string): boolean {
    if (this.keys.has(code) && !this.prevKeys.has(code)) return true;
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
    return this.keys.has('KeyE') || this.keys.has('KeyJ') || this.touchAttack;
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
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      if (this.handleGameInput) {
        window.removeEventListener('game-input', this.handleGameInput as EventListener);
      }
    }
  }
}
