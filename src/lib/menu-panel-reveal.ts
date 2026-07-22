type FrameScheduler = (callback: FrameRequestCallback) => number;

type PanelRevealDependencies = {
  schedule?: FrameScheduler;
  find?: (id: string) => Element | null;
  reducedMotion?: boolean;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Reveals an expanded menu panel after React has committed it to the DOM.
 * Two animation frames avoid racing state updates on slower mobile devices.
 */
export function schedulePanelReveal(
  panelId: string,
  dependencies: PanelRevealDependencies = {},
): void {
  if (!panelId) return;

  const schedule = dependencies.schedule
    ?? (typeof window !== 'undefined' ? window.requestAnimationFrame.bind(window) : undefined);
  const find = dependencies.find
    ?? (typeof document !== 'undefined' ? document.getElementById.bind(document) : undefined);
  if (!schedule || !find) return;

  const reducedMotion = dependencies.reducedMotion ?? prefersReducedMotion();
  schedule(() => {
    schedule(() => {
      find(panelId)?.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      });
    });
  });
}
