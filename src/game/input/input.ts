/**
 * Input manager — tracks keyboard and touch state for game controls.
 */

export type KeyState = 'up' | 'down' | 'pressed';

export class InputManager {
  private keys = new Map<string, boolean>();
  private justPressed = new Set<string>();

  // Touch virtual button state
  private touchLeft = false;
  private touchRight = false;
  private touchJump = false;
  private touchJumpPressed = false;

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
        }
      };
      window.addEventListener('game-input', this.handleGameInput as EventListener);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keys.set(e.code, true);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.set(e.code, false);
  };

  /** Check if a key or virtual button is currently held down */
  isDown(code: string): boolean {
    if (this.keys.get(code)) return true;
    // Map touch controls to key codes
    if (code === 'ArrowLeft' || code === 'KeyA') return this.touchLeft;
    if (code === 'ArrowRight' || code === 'KeyD') return this.touchRight;
    return false;
  }

  /** Check if a key or virtual button was just pressed this frame */
  isPressed(code: string): boolean {
    if (this.justPressed.has(code)) return true;
    if ((code === 'Space' || code === 'ArrowUp' || code === 'KeyW') && this.touchJumpPressed) {
      return true;
    }
    return false;
  }

  /** Call at end of frame to clear just-pressed state */
  endFrame(): void {
    this.justPressed.clear();
    this.touchJumpPressed = false;
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
