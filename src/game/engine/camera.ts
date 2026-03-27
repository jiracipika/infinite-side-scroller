/**
 * Camera system — smoothly follows the player with look-ahead, dead zone, and screen shake.
 */

export interface CameraConfig {
  /** How much to offset the camera (fraction of screen) */
  lookAheadX: number;
  /** Dead zone width in pixels */
  deadZoneX: number;
  deadZoneY: number;
  /** Smoothing factor (0 = no movement, 1 = instant snap) */
  lerpSpeed: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  lookAheadX: 0.15,
  deadZoneX: 50,
  deadZoneY: 30,
  lerpSpeed: 0.12,
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

  // Screen shake
  private shakeIntensity = 0;
  private shakeDuration = 0;
  private shakeTimer = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;

  constructor(config: CameraConfig = DEFAULT_CAMERA_CONFIG) {
    this.config = config;
  }

  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /** Trigger a screen shake */
  shake(intensity: number = 4, duration: number = 0.3): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeDuration = Math.max(this.shakeDuration, duration);
    this.shakeTimer = this.shakeDuration;
  }

  update(playerX: number, playerY: number): void {
    // Desired camera position with look-ahead
    const desiredX = playerX - this.screenWidth * (0.5 + this.config.lookAheadX);
    const desiredY = playerY - this.screenHeight * 0.5;

    // Always update target — lerp provides the smoothing
    this.targetX = desiredX;
    this.targetY = desiredY;

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
