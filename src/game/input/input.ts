/**
 * Input manager — tracks keyboard state for game controls.
 */

export type KeyState = 'up' | 'down' | 'pressed'; // pressed = just pressed this frame

export class InputManager {
  private keys = new Map<string, boolean>();
  private justPressed = new Set<string>();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.keys.has(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keys.set(e.code, true);
    // Prevent scrolling with game keys
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.set(e.code, false);
  };

  /** Check if a key is currently held down */
  isDown(code: string): boolean {
    return this.keys.get(code) ?? false;
  }

  /** Check if a key was just pressed this frame */
  isPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  /** Call at end of frame to clear just-pressed state */
  endFrame(): void {
    this.justPressed.clear();
  }

  /** Clean up event listeners */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
    }
  }
}
