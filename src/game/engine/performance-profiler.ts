/**
 * Performance profiler for monitoring game performance.
 * Tracks FPS, frame times, and system metrics.
 */

export interface ProfilerMetrics {
  fps: number;
  frameTime: number;
  avgFrameTime: number;
  frameTime95th: number;
  worstFrameTime: number;
  totalFrames: number;
}

export class PerformanceProfiler {
  private fps = 60;
  private frameTime = 0;
  private avgFrameTime = 16.67;
  private worstFrameTime = 16.67;

  private frameCount = 0;
  private fpsTimer = 0;
  private totalFrames = 0;

  // Frame time history for percentiles
  private frameTimeHistory: number[] = [];
  private readonly historySize = 60; // Keep last 60 frames

  // System timing breakdown
  private updateTimes: number[] = [];
  private renderTimes: number[] = [];

  startFrame(): void {
    this.frameTime = performance.now();
  }

  endFrame(): ProfilerMetrics {
    const now = performance.now();
    const delta = now - this.frameTime;

    // Update FPS
    this.frameCount++;
    this.fpsTimer += delta / 1000;

    if (this.fpsTimer >= 1.0) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.fpsTimer = 0;
    }

    // Track frame time
    this.frameTimeHistory.push(delta);
    if (this.frameTimeHistory.length > this.historySize) {
      this.frameTimeHistory.shift();
    }

    // Update average and worst
    this.totalFrames++;
    this.avgFrameTime = (this.avgFrameTime * (this.totalFrames - 1) + delta) / this.totalFrames;
    if (delta > this.worstFrameTime) {
      this.worstFrameTime = delta;
    }

    // Decay worst frame time slowly
    if (this.totalFrames % 60 === 0 && this.worstFrameTime > 100) {
      this.worstFrameTime *= 0.95;
    }

    return this.getMetrics();
  }

  recordUpdateTime(time: number): void {
    this.updateTimes.push(time);
    if (this.updateTimes.length > 30) this.updateTimes.shift();
  }

  recordRenderTime(time: number): void {
    this.renderTimes.push(time);
    if (this.renderTimes.length > 30) this.renderTimes.shift();
  }

  getMetrics(): ProfilerMetrics {
    // Calculate 95th percentile
    const sorted = [...this.frameTimeHistory].sort((a, b) => a - b);
    const idx95 = Math.floor(sorted.length * 0.95);
    const frameTime95th = sorted[idx95] || this.avgFrameTime;

    return {
      fps: this.fps,
      frameTime: this.frameTimeHistory[this.frameTimeHistory.length - 1] || 0,
      avgFrameTime: this.avgFrameTime,
      frameTime95th,
      worstFrameTime: this.worstFrameTime,
      totalFrames: this.totalFrames,
    };
  }

  getAverageUpdateMs(): number {
    if (this.updateTimes.length === 0) return 0;
    return this.updateTimes.reduce((a, b) => a + b, 0) / this.updateTimes.length;
  }

  getAverageRenderMs(): number {
    if (this.renderTimes.length === 0) return 0;
    return this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
  }

  reset(): void {
    this.fps = 60;
    this.frameCount = 0;
    this.fpsTimer = 0;
    this.totalFrames = 0;
    this.avgFrameTime = 16.67;
    this.worstFrameTime = 16.67;
    this.frameTimeHistory = [];
    this.updateTimes = [];
    this.renderTimes = [];
  }
}
