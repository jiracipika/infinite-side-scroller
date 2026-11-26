import { LUCIDE_PATHS } from './icon-paths';

/* Hand-drawn marks for what Lucide 0.454 has no glyph for: three runner
   avatars, two biomes, and the touch verbs that must read at thumb size. */
const INK_PATHS = {
  alien: [
    ['path', { d: 'M12 3c-4.7 0-8 3.1-8 7.1 0 5.1 4.5 10.9 8 10.9s8-5.8 8-10.9C20 6.1 16.7 3 12 3z' }],
    ['path', { d: 'M6.8 10.8l3.6 1.1-2.8 1.7z' }],
    ['path', { d: 'M17.2 10.8l-3.6 1.1 2.8 1.7z' }],
  ],
  bow: [
    ['path', { d: 'M7 3c9 2.6 9 15.4 0 18' }],
    ['path', { d: 'M7 3v18' }],
    ['path', { d: 'M7 12h14' }],
    ['path', { d: 'M17 8.5 21.5 12 17 15.5' }],
    ['path', { d: 'M7 12l-3.5-2M7 12l-3.5 2' }],
  ],
  dunes: [
    ['circle', { cx: '17.5', cy: '6', r: '2.5' }],
    ['path', { d: 'M2 19c3.2-6 6.8-6 10-1.2' }],
    ['path', { d: 'M11 19c2.6-4.6 6.2-4.6 8.6-.6' }],
    ['path', { d: 'M2 19h20' }],
  ],
  fox: [
    ['path', { d: 'M4 4l4.5 4.2h7L20 4v6.4c0 4.7-3.6 9.6-8 9.6s-8-4.9-8-9.6z' }],
    ['path', { d: 'M8.6 12.2h.01M15.4 12.2h.01' }],
    ['path', { d: 'M12 14.6v2M11 17.2l1 1 1-1' }],
  ],
  owl: [
    ['path', { d: 'M12 4.5c-4.4 0-7.5 3-7.5 7 0 5 3.6 9 7.5 9s7.5-4 7.5-9c0-4-3.1-7-7.5-7z' }],
    ['path', { d: 'M5.6 8 4.2 3.6 8.4 5.4M18.4 8l1.4-4.4-4.2 1.8' }],
    ['circle', { cx: '9', cy: '11.5', r: '2' }],
    ['circle', { cx: '15', cy: '11.5', r: '2' }],
    ['path', { d: 'M12 14l-1.2 1.6L12 17.2l1.2-1.6z' }],
  ],
  volcano: [
    ['path', { d: 'M9 8.5h6l5 11.5H4z' }],
    ['path', { d: 'M10.5 8.5v3.2M13.5 8.5v4.4' }],
    ['circle', { cx: '8.6', cy: '5.6', r: '1.4' }],
    ['circle', { cx: '13.4', cy: '3.4', r: '1.7' }],
    ['circle', { cx: '17.8', cy: '6.8', r: '1.2' }],
  ],
  // Touch verbs: speed lines behind a chevron; a projectile leaving its trail
  // (a round head, so it never reads as another arrow).
  dash: [
    ['path', { d: 'M3 6h6M2 12h7M3 18h6' }],
    ['path', { d: 'M13 5l7 7-7 7' }],
  ],
  shot: [
    ['circle', { cx: '16.5', cy: '12', r: '3.5' }],
    ['path', { d: 'M3 7.5h6M2 12h8M3 16.5h6' }],
  ],
  // Solid marks: the pause bars read cleaner filled than outlined.
  pause: [
    ['rect', { x: '6', y: '4', width: '4.5', height: '16', rx: '1.4', fill: 'currentColor', stroke: 'none' }],
    ['rect', { x: '13.5', y: '4', width: '4.5', height: '16', rx: '1.4', fill: 'currentColor', stroke: 'none' }],
  ],
  close: [
    ['path', { d: 'M18 6 6 18M6 6l12 12' }],
  ],
} as const;

/** Every mark the interface can draw: `[svg tag, attributes]` on a 24×24 grid. */
export const ICON_PATHS = { ...LUCIDE_PATHS, ...INK_PATHS };

export type IconName = keyof typeof ICON_PATHS;
