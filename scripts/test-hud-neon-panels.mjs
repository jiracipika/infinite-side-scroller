#!/usr/bin/env node
// Neon comic-panel HUD refinement test.
// Verifies HUD.tsx + HUD.module.css keep the approved art direction WITHOUT
// dropping any pre-existing metric, conditional, or a11y affordance.
//
// Structural checks (source-level, mirroring the other verify-*.mjs scripts):
//   1. HUD.tsx consumes the CSS module (opaque panels, not global pills)
//   2. The frosted-glass `ios-hud-pill` is gone from the HUD (blur removal)
//   3. Approved palette present: lime / violet / coral / offwhite / panel
//   4. Every pre-existing metric + conditional render path is preserved
//   5. A11y affordances preserved (role=status, progressbar, aria-labels)
//   6. Reduced-motion contract intact (no new constant JS animation; infinite
//      pulses stay matched by the global reduced-motion guard selectors)
//   7. Touch play area stays clear (pointer-events-none on the HUD overlay)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const hudPath = path.join(ROOT, 'src', 'components', 'HUD.tsx');
const cssPath = path.join(ROOT, 'src', 'components', 'HUD.module.css');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  }
}

const tsx = fs.readFileSync(hudPath, 'utf8');
const css = fs.readFileSync(cssPath, 'utf8');

// 1. CSS module consumed
assert(
  /import styles from '\.\/HUD\.module\.css'/.test(tsx),
  'HUD.tsx must import the HUD.module.css module',
);
assert(css.includes('.panel {'), 'HUD.module.css must define the opaque .panel body');

// 2. Frosted glass removed from the HUD
assert(
  !tsx.includes('ios-hud-pill'),
  'HUD.tsx must no longer use the blurred .ios-hud-pill class',
);
assert(
  !/backdrop-filter/.test(css),
  'HUD.module.css must not use backdrop-filter (no per-frame blur cost)',
);

// 3. Approved palette
for (const [name, hex] of [
  ['lime', '#c7ff4d'],
  ['violet', '#9570ff'],
  ['coral', '#ff7166'],
  ['offwhite', '#f4f2ed'],
  ['panel body', '#1c1c2e'],
]) {
  assert(css.includes(hex), `HUD.module.css must use the approved ${name} token ${hex}`);
}

// 4. Every pre-existing metric / conditional is preserved
const requiredMetrics = [
  // hearts
  'Math.min(Math.max(stats.maxHealth, 1), 5)',
  'filledHearts === 1',
  'filledHearts === 0',
  'ios-low-health-vignette',
  // score + distance
  'stats.score.toLocaleString()',
  'Math.round(stats.distance)',
  // coins + lives
  'stats.coins',
  'stats.lives > 2',
  'stats.lives - 2',
  // level progress (conditional)
  'stats.levelTarget && stats.levelTarget > 0',
  "stats.levelObjective === 'coins'",
  "stats.levelObjective === 'kills'",
  'stats.levelTimeRemaining < 10',
  // special meter (conditional)
  'stats.specialName && stats.specialCooldownTotal',
  'stats.specialActiveRemaining',
  'stats.specialCooldownRemaining',
  // combo (conditional) + decay urgency
  '(stats.comboCount ?? 0) > 1',
  'stats.comboMultiplier',
  'stats.comboTimeRemaining ?? 0',
  'COMBO_DECAY_SECONDS',
  // power-ups (conditional) + timer matching
  'stats.powerUps.length > 0',
  'stats.powerUpTimers?.find',
  'POWER_UP_EMOJI',
  'POWER_UP_MAX_DURATION',
  'timer.remaining < 2',
  // right cluster
  'stats.biome',
  'stats.dayPhase',
  "dayPhase === 'dawn'",
  "dayPhase === 'dusk'",
  'settings.showFPS',
  'stats.frameTime95Ms',
  'fpsBucket',
  // haptics hook preserved
  'useGameHaptics(stats, settings.hapticsEnabled)',
  // score flash + combo flash behaviours preserved
  'setScoreFlash(true)',
  'setComboFlash(true)',
];
for (const needle of requiredMetrics) {
  assert(tsx.includes(needle), `HUD.tsx lost a pre-existing metric/conditional: ${needle}`);
}

// 5. A11y affordances
for (const needle of [
  'role="status"',
  'aria-live="off"',
  'aria-label="Heads up display"',
  'role="progressbar"',
  'aria-label="Level progress"',
  'aria-label={`Health: ${filledHearts} of ${totalHearts} hearts',
  'aria-label={`Combo of ${stats.comboCount}',
  'aria-label={`Current biome: ${stats.biome}`}',
  'aria-label={`${stats.coins} coins`}',
  'aria-label={`${stats.lives - 2} extra lives`}',
  'seconds until ready',
]) {
  assert(tsx.includes(needle), `HUD.tsx lost an a11y affordance: ${needle}`);
}
// Heart/FPS icons and decorative numbers stay screen-reader silent.
assert(
  (tsx.match(/aria-hidden="true"/g) || []).length >= 10,
  'decorative HUD elements should remain aria-hidden',
);

// 6. Reduced-motion contract: the only infinite animations allowed are the
//    pre-existing pulses, which the global guard targets via
//    [style*="animation"][style*="infinite"] — same contract as before.
const infiniteAnims = tsx.match(/animation: '[^']*infinite[^']*'/g) || [];
assert(
  infiniteAnims.every(a => a.includes('comboUrgencyPulse') || a.includes('heartBeat')),
  `unexpected infinite animation introduced: ${infiniteAnims.join(', ')}`,
);
assert(
  !tsx.includes('requestAnimationFrame'),
  'HUD must not run constant JS animation (no rAF loop)',
);

// 7. Touch play area stays clear
assert(
  tsx.includes('pointer-events-none'),
  'HUD overlay must stay pointer-events-none so the touch play area stays clear',
);
// Compact on short viewports: score must remain a single readable size, and
// panel padding must stay tight (no oversized chrome).
assert(
  /fontSize: 32/.test(tsx),
  'score should stay at the compact 32px display size',
);
assert(
  /padding: 3px 9px/.test(css),
  'panel padding should stay compact for small viewports',
);

if (failures > 0) {
  console.error(`${failures} neon HUD test(s) failed`);
  process.exit(1);
}

console.log(
  `Neon comic-panel HUD verified: ${requiredMetrics.length} metrics/conditionals, ` +
  `${(tsx.match(/aria-hidden="true"/g) || []).length} aria-hidden decoratives, ` +
  'opaque panels (no blur), approved palette, reduced-motion + touch contracts intact.',
);
