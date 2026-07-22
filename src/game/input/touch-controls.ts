import type { TouchControlLayout, TouchControlSize } from '../state/game-state';

export type TouchButtonSize = 'xs' | 'sm' | 'md' | 'lg';

const BUTTON_BASE_PX: Record<TouchButtonSize, number> = {
  xs: 42,
  sm: 50,
  md: 56,
  lg: 66,
};

export function resolveTouchButtonDimension(
  size: TouchButtonSize,
  controlSize: TouchControlSize,
  compactViewport: boolean,
): number {
  const multiplier = controlSize === 'compact' ? 0.86 : controlSize === 'large' ? 1.16 : 1;
  const scaled = Math.round(BUTTON_BASE_PX[size] * multiplier);
  return compactViewport ? Math.min(62, scaled) : scaled;
}

export function resolveTouchControlPlacement(layout: TouchControlLayout): {
  movement: 'left' | 'right';
  actions: 'left' | 'right';
} {
  return layout === 'mirrored'
    ? { movement: 'right', actions: 'left' }
    : { movement: 'left', actions: 'right' };
}
