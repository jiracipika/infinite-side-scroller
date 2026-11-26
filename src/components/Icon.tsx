'use client';

import { createElement, type CSSProperties } from 'react';
import { ICON_PATHS, type IconName } from './ink-paths';

export type { IconName } from './ink-paths';

interface IconProps {
  name: IconName;
  /** Edge length in px. */
  size?: number;
  strokeWidth?: number;
  /** Paint closed outlines solid in the current colour (stars, the play wedge). */
  filled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * One stroke family for every interface mark: a 24-unit grid, round caps,
 * `currentColor`. System emoji used to do this job — they differ per OS and
 * sit outside the ink palette. Decorative by default; callers carry the
 * meaning in text or aria-labels.
 */
export function Icon({ name, size = 18, strokeWidth = 2.25, filled = false, className, style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0, verticalAlign: 'middle', ...style }}
    >
      {ICON_PATHS[name].map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
