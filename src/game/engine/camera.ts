/**
 * Camera system — smoothly follows the player with centered framing and screen shake.
 */

export type CameraMode = 'auto' | 'horizontal' | 'vertical' | 'split';

export interface CameraConfig {
  /** Framing profile. Auto picks horizontal/vertical based on aspect ratio. */
  mode: CameraMode;
  /** Horizontal focus point as a fraction of screen width. 0.5 keeps the player centered. */
  focusX: number;
  /** Vertical focus point for landscape/wide screens. */
  horizontalFocusY: number;
  /** Vertical focus point for portrait screens. */
  verticalFocusY: number;
  /** Vertical focus point for local split-screen square panes. */
  splitFocusY: number;
  /** Smoothing factor (0 = no movement, 1 = instant snap) */
  lerpSpeed: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  mode: 'auto',
  focusX: 0.5,
  horizontalFocusY: 0.52,
  verticalFocusY: 0.54,
  splitFocusY: 0.5,
  lerpSpeed: 0.14,
};

export class Camera {
  /** Camera position (top-left corner in world coords) */
  x = 0;
  y = 0;

  /** Final position after shake (use for rendering) */
  get renderX(): number { return this.x + this.shakeOffsetX; }
  get renderY(): number { return this.y + this.shakeOffsetY; }

  private targetX = 0;
  private targetY = 0;
  private config: CameraConfig;
  private screenWidth = 800;
  private screenHeight = 600;
  get viewportWidth(): number { return this.screenWidth; }
  get viewportHeight(): number { return this.screenHeight; }

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  constructor(config: CameraConfig = DEFAULT_CAMERA_CONFIG) {
    this.config = config;
  }

  setMode(mode: CameraMode): void {
    this.config = { ...this.config, mode };
  }

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  private getFocusY(): number {
    if (this.config.mode === 'split') return this.config.splitFocusY;
    if (this.config.mode === 'vertical') return this.config.verticalFocusY;
    if (this.config.mode === 'horizontal') return this.config.horizontalFocusY;
    return this.screenHeight > this.screenWidth * 1.08
      ? this.config.verticalFocusY
      : this.config.horizontalFocusY;
  }

  private getDesiredPosition(playerX: number, playerY: number): { x: number; y: number } {
    const desiredX = Math.max(0, playerX - this.screenWidth * this.config.focusX);
    const desiredY = playerY - this.screenHeight * this.getFocusY();
    return { x: desiredX, y: desiredY };
  }

  /** Trigger a screen shake */
  shake(intensity: number = 4, duration: number = 0.3): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = this.shakeDuration;
  }

  update(playerX: number, playerY: number): void {
    const desired = this.getDesiredPosition(playerX, playerY);

    // Always update target — lerp provides the smoothing
    this.targetX = desired.x;
    this.targetY = desired.y;

    // Smooth lerp
    this.x += (this.targetX - this.x) * this.config.lerpSpeed;
    this.y += (this.targetY - this.y) * this.config.lerpSpeed;

    // Don't go above sky
    if (this.y < -200) this.y = -200;

    // Update shake
    if (this.shakeTimer > 0) {
      this.shakeTimer -= 1 / 60;
      const decay = this.shakeTimer / this.shakeDuration;
      const intensity = this.shakeIntensity * decay;
      this.shakeOffsetX = (Math.random() * 2 - 1) * intensity;
      this.shakeOffsetY = (Math.random() * 2 - 1) * intensity;
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
      this.shakeIntensity = 0;
      this.shakeDuration = 0;
    }
  }

  /** Place the camera immediately without lerp for clean starts/restarts. */
  snapTo(playerX: number, playerY: number): void {
    const desired = this.getDesiredPosition(playerX, playerY);
    this.targetX = desired.x;
    this.targetY = desired.y;
    this.x = this.targetX;
    this.y = Math.max(-200, this.targetY);
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    this.shakeIntensity = 0;
    this.shakeDuration = 0;
    this.shakeTimer = 0;
  }

  /** Convert world → screen using shake-adjusted position */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.renderX,
      y: worldY - this.renderY,
    };
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.x,
      y: screenY + this.y,
    };
  }

  isVisible(worldX: number, worldY: number, width: number, height: number): boolean {
    return (
      worldX + width > this.x &&
      worldX < this.x + this.screenWidth &&
      worldY + height > this.y &&
      worldY < this.y + this.screenHeight
    );
  }
}
