/**
 * InputManager - Unified input abstraction layer
 * Combines keyboard, touch, and gamepad into a single interface
 * so game logic doesn't care about input source.
 */

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean; // true only on first frame
  sprint: boolean;
}

type Listener = () => void;

export class InputManager {
  private keys = new Set<string>();
  private prevKeys = new Set<string>();
  private listeners: Listener[] = [];
  private touchState: Partial<InputState> = {};

  // Touch element references
  private touchOverlay: HTMLElement | null = null;
  private joystickBase: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;
  private jumpBtn: HTMLElement | null = null;
  private joystickActive = false;
  private joystickOrigin = { x: 0, y: 0 };
  private joystickDelta = { x: 0, y: 0 };

  constructor() {
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
  }

  /** Call once to start listening */
  init() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** Create touch overlay for mobile */
  createTouchOverlay(container: HTMLElement) {
    this.touchOverlay = document.createElement('div');
    this.touchOverlay.className = 'touch-overlay';
    this.touchOverlay.style.cssText = `
      position: fixed; bottom: 0; left: 0; right: 0; height: 180px;
      pointer-events: auto; z-index: 100; touch-action: none;
    `;

    // Virtual joystick (left side)
    this.joystickBase = document.createElement('div');
    this.joystickBase.style.cssText = `
      position: absolute; left: 30px; bottom: 30px; width: 120px; height: 120px;
      border-radius: 50%; background: rgba(255,255,255,0.15);
      border: 2px solid rgba(255,255,255,0.3);
    `;

    this.joystickKnob = document.createElement('div');
    this.joystickKnob.style.cssText = `
      position: absolute; left: 50%; top: 50%; width: 50px; height: 50px;
      margin-left: -25px; margin-top: -25px; border-radius: 50%;
      background: rgba(255,255,255,0.4);
      transition: background 0.1s;
    `;
    this.joystickBase.appendChild(this.joystickKnob);

    // Jump button (right side)
    this.jumpBtn = document.createElement('div');
    this.jumpBtn.style.cssText = `
      position: absolute; right: 30px; bottom: 30px; width: 80px; height: 80px;
      border-radius: 50%; background: rgba(255,255,255,0.15);
      border: 2px solid rgba(255,255,255,0.3);
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.5); font-size: 14px; font-weight: bold;
      user-select: none; -webkit-user-select: none;
    `;
    this.jumpBtn.textContent = 'JUMP';

    this.touchOverlay.appendChild(this.joystickBase);
    this.touchOverlay.appendChild(this.jumpBtn);
    container.appendChild(this.touchOverlay);

    this.setupTouchHandlers();
  }

  private setupTouchHandlers() {
    if (!this.joystickBase || !this.jumpBtn) return;

    // Joystick touch
    this.joystickBase.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.joystickActive = true;
      const t = e.touches[0];
      const rect = this.joystickBase!.getBoundingClientRect();
      this.joystickOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    });

    window.addEventListener('touchmove', (e) => {
      if (!this.joystickActive) return;
      e.preventDefault();
      const t = e.touches[0];
      this.joystickDelta = {
        x: t.clientX - this.joystickOrigin.x,
        y: t.clientY - this.joystickOrigin.y,
      };
      // Clamp
      const dist = Math.sqrt(this.joystickDelta.x ** 2 + this.joystickDelta.y ** 2);
      const maxDist = 50;
      if (dist > maxDist) {
        this.joystickDelta.x = (this.joystickDelta.x / dist) * maxDist;
        this.joystickDelta.y = (this.joystickDelta.y / dist) * maxDist;
      }
      // Update knob position
      if (this.joystickKnob) {
        this.joystickKnob.style.transform = `translate(${this.joystickDelta.x}px, ${this.joystickDelta.y}px)`;
      }
      this.touchState.left = this.joystickDelta.x < -15;
      this.touchState.right = this.joystickDelta.x > 15;
    }, { passive: false });

    const endJoystick = () => {
      this.joystickActive = false;
      this.joystickDelta = { x: 0, y: 0 };
      if (this.joystickKnob) this.joystickKnob.style.transform = '';
      this.touchState.left = false;
      this.touchState.right = false;
    };
    window.addEventListener('touchend', endJoystick);
    window.addEventListener('touchcancel', endJoystick);

    // Jump button
    this.jumpBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.touchState.jump = true;
      this.touchState.jumpPressed = true;
    });
    this.jumpBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.touchState.jump = false;
    });
  }

  /** Get current unified input state */
  getState(): InputState {
    const jump = this.keys.has('Space') || this.keys.has('KeyW') || this.keys.has('ArrowUp') || !!this.touchState.jump;
    const jumpWas = this.prevKeys.has('Space') || this.prevKeys.has('KeyW') || this.prevKeys.has('ArrowUp');
    return {
      left: this.keys.has('KeyA') || this.keys.has('ArrowLeft') || !!this.touchState.left,
      right: this.keys.has('KeyD') || this.keys.has('ArrowRight') || !!this.touchState.right,
      jump,
      jumpPressed: jump && !jumpWas || !!this.touchState.jumpPressed,
      sprint: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
    };
  }

  /** Call at end of each frame to track edge transitions */
  update() {
    this.prevKeys = new Set(this.keys);
    this.touchState.jumpPressed = false;
  }

  /** Clean up */
  destroy() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    if (this.touchOverlay?.parentElement) {
      this.touchOverlay.parentElement.removeChild(this.touchOverlay);
    }
    this.listeners = [];
  }

  private onKeyDown(e: KeyboardEvent) {
    this.keys.add(e.code);
    // Prevent page scroll
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  }

  private onKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }
}
