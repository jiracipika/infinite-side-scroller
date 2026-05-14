/**
 * Day/Night Cycle — overlays a time-of-day tint on the game world.
 * Cycle runs continuously during gameplay, affecting sky color and ambient lighting.
 * Affects gameplay slightly: enemies are more aggressive at night.
 */

export interface DayNightState {
  /** 0-1 progress through the full cycle */
  time: number;
  /** Current phase name */
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  /** Darkness overlay alpha (0 = full daylight, ~0.45 = darkest night) */
  overlayAlpha: number;
  /** Tint color for the overlay */
  tintColor: string;
  /** Enemy aggression multiplier (1.0 = normal, higher at night) */
  enemyAggressionMult: number;
  /** Visibility range multiplier (1.0 = normal, lower at night) */
  visibilityMult: number;
}

/** Full cycle duration in seconds (~4 minutes per cycle) */
const CYCLE_DURATION = 240;

/** Phase boundaries (as fractions of the cycle) */
const PHASES = {
  dawn:  { start: 0.0, end: 0.15 },
  day:   { start: 0.15, end: 0.45 },
  dusk:  { start: 0.45, end: 0.6 },
  night: { start: 0.6, end: 1.0 },
};

export class DayNightCycle {
  private time = 0; // 0-1

  /** Update cycle progress */
  update(dt: number): void {
    this.time += dt / CYCLE_DURATION;
    if (this.time >= 1) this.time -= 1;
  }

  /** Get current state */
  getState(): DayNightState {
    const t = this.time;
    const phase = this.getPhase(t);

    let overlayAlpha = 0;
    let tintColor = '#000020';
    let aggressionMult = 1.0;
    let visibilityMult = 1.0;

    switch (phase) {
      case 'dawn': {
        // Transition from night to day
        const progress = (t - PHASES.dawn.start) / (PHASES.dawn.end - PHASES.dawn.start);
        overlayAlpha = 0.3 * (1 - progress);
        tintColor = this.lerpColor('#0a0a30', '#ff9944', progress * 0.3);
        aggressionMult = 1 + 0.2 * (1 - progress);
        visibilityMult = 0.8 + 0.2 * progress;
        break;
      }
      case 'day': {
        overlayAlpha = 0;
        tintColor = '#ffffff';
        aggressionMult = 1.0;
        visibilityMult = 1.0;
        break;
      }
      case 'dusk': {
        const progress = (t - PHASES.dusk.start) / (PHASES.dusk.end - PHASES.dusk.start);
        overlayAlpha = 0.15 + 0.15 * progress;
        tintColor = this.lerpColor('#ff6622', '#1a0a30', progress);
        aggressionMult = 1 + 0.15 * progress;
        visibilityMult = 1 - 0.15 * progress;
        break;
      }
      case 'night': {
        const progress = (t - PHASES.night.start) / (PHASES.night.end - PHASES.night.start);
        overlayAlpha = 0.3 + 0.15 * Math.sin(progress * Math.PI);
        tintColor = '#060818';
        aggressionMult = 1.15 + 0.1 * Math.sin(progress * Math.PI);
        visibilityMult = 0.85 - 0.1 * Math.sin(progress * Math.PI);
        break;
      }
    }

    return {
      time: t,
      phase,
      overlayAlpha,
      tintColor,
      enemyAggressionMult: aggressionMult,
      visibilityMult,
    };
  }

  private getPhase(t: number): DayNightState['phase'] {
    if (t < PHASES.dawn.end) return 'dawn';
    if (t < PHASES.day.end) return 'day';
    if (t < PHASES.dusk.end) return 'dusk';
    return 'night';
  }

  private lerpColor(a: string, b: string, t: number): string {
    const ar = parseInt(a.slice(1, 3), 16);
    const ag = parseInt(a.slice(3, 5), 16);
    const ab = parseInt(a.slice(5, 7), 16);
    const br = parseInt(b.slice(1, 3), 16);
    const bg = parseInt(b.slice(3, 5), 16);
    const bb = parseInt(b.slice(5, 7), 16);
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
  }

  /** Reset to dawn */
  reset(): void {
    this.time = 0;
  }

  /** Get phase name for display */
  getPhaseName(): string {
    const state = this.getState();
    return state.phase.charAt(0).toUpperCase() + state.phase.slice(1);
  }
}
