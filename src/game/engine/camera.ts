/**
 * Camera system — smoothly follows the player with a configurable dead zone and lerp.
 */

export interface CameraConfig {
  /** How much to offset the camera (fraction of screen) */
  lookAheadX: number; // 0 = centered, 0.3 = look 30% ahead
  /** Dead zone width in pixels — camera won't move if player is within this zone */
  deadZoneX: number;
  deadZoneY: number;
  /** Smoothing factor (0 = no movement, 1 = instant snap) */
  lerpSpeed: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  lookAheadX: 0.3,
  deadZoneX: 50,
  deadZoneY: 30,
  lerpSpeed: 0.08,
};

export class Camera {
  /** Camera position (top-left corner in world coords) */
  x = 0;
  y = 0;

  /** Target position (where camera wants to be) */
  private targetX = 0;
  private targetY = 0;

  private config: CameraConfig;
  private screenWidth = 800;
  private screenHeight = 600;

  constructor(config: CameraConfig = DEFAULT_CAMERA_CONFIG) {
    this.config = config;
  }

  /** Set screen dimensions (call on resize) */
  setScreenSize(width: number, height: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
  }

  /**
   * Update camera position to follow the player.
   * @param playerX - Player center X in world coords
   * @param playerY - Player center Y in world coords
   */
  update(playerX: number, playerY: number): void {
    // Calculate desired camera position (player offset by look-ahead)
    const desiredX = playerX - this.screenWidth * (0.5 + this.config.lookAheadX);
    const desiredY = playerY - this.screenHeight * 0.5;

    // Apply dead zone — only move if player is outside the dead zone
    const dx = Math.abs(playerX - (this.x + this.screenWidth * (0.5 + this.config.lookAheadX)));
    const dy = Math.abs(playerY - (this.y + this.screenHeight * 0.5));

    if (dx > this.config.deadZoneX) {
      this.targetX = desiredX;
    }
    if (dy > this.config.deadZoneY) {
      this.targetY = desiredY;
    }

    // Smooth lerp towards target
    this.x += (this.targetX - this.x) * this.config.lerpSpeed;
    this.y += (this.targetY - this.y) * this.config.lerpSpeed;

    // Don't let camera go above the sky
    if (this.y < -200) this.y = -200;
  }

  /**
   * Convert world coordinates to screen coordinates.
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: worldX - this.x,
      y: worldY - this.y,
    };
  }

  /**
   * Convert screen coordinates to world coordinates.
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: screenX + this.x,
      y: screenY + this.y,
    };
  }

  /** Check if a world-space rectangle is visible on screen */
  isVisible(
    worldX: number,
    worldY: number,
    width: number,
    height: number
  ): boolean {
    return (
      worldX + width > this.x &&
      worldX < this.x + this.screenWidth &&
      worldY + height > this.y &&
      worldY < this.y + this.screenHeight
    );
  }
}
