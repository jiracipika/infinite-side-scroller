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
  private fpsElapsedMs = 0;
  private totalFrames = 0;
  private frameWorkStart = 0;
  private lastRafTime: number | null = null;

  // Frame time history for percentiles
  private frameTimeHistory: number[] = [];
  private readonly historySize = 60; // Keep last 60 frames

  // System timing breakdown
  private updateTimes: number[] = [];
  private renderTimes: number[] = [];

  startFrame(rafTime: number = performance.now()): void {
    this.frameWorkStart = performance.now();

    if (this.lastRafTime !== null) {
      const frameInterval = Math.max(0, rafTime - this.lastRafTime);
      this.frameTime = frameInterval;

      // FPS must be based on requestAnimationFrame cadence, not how long the
      // update/render work took. Using work duration can report impossible FPS
      // values on fast devices and prevent adaptive quality from engaging.
      this.frameCount++;
      this.fpsElapsedMs += frameInterval;

      if (this.fpsElapsedMs >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / this.fpsElapsedMs);
        this.frameCount = 0;
        this.fpsElapsedMs = 0;
      }

      this.frameTimeHistory.push(frameInterval);
      if (this.frameTimeHistory.length > this.historySize) {
        this.frameTimeHistory.shift();
      }
    }

    this.lastRafTime = rafTime;
  }

  endFrame(): ProfilerMetrics {
    this.totalFrames++;
    const workDuration = performance.now() - this.frameWorkStart;

    if (this.frameTimeHistory.length > 0) {
      const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
      this.avgFrameTime = sum / this.frameTimeHistory.length;
      this.worstFrameTime = Math.max(...this.frameTimeHistory);
    } else {
      this.frameTime = workDuration;
      this.avgFrameTime = workDuration;
      this.worstFrameTime = workDuration;
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
    this.fpsElapsedMs = 0;
    this.totalFrames = 0;
    this.frameWorkStart = 0;
    this.lastRafTime = null;
    this.avgFrameTime = 16.67;
    this.worstFrameTime = 16.67;
    this.frameTimeHistory = [];
    this.updateTimes = [];
    this.renderTimes = [];
  }
}
