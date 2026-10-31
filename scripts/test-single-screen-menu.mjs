import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const screen = fs.readFileSync(
  path.join(root, 'apps/mobile/app/index.tsx'),
  'utf8',
);

// Single-screen shell contract. There is no tab bar — the menu is rendered
// by the same screen that hosts the run. Quit to Menu must tear the game
// surface down and bring the menu back.
assert.match(
  screen,
  /setGameState\('menu'\);\s*\n\s*setShowMenu\(true\)/,
  'Quit to Menu must restore the menu overlay alongside the menu game state.',
);
assert.match(
  screen,
  /gameState !== 'menu' && \(\s*\n\s*<View style=\{styles\.webviewContainer\}>/,
  'The WebView must unmount in the menu state so the native menu is always the front surface.',
);
assert.doesNotMatch(
  screen,
  /<Tabs\./,
  'The shell is single-screen; no tab navigation may be present.',
);
assert.match(
  screen,
  /<SettingsSheet/,
  'Settings must be reachable as a sheet from the menu.',
);
assert.match(
  screen,
  /<LeaderboardSheet/,
  'Leaderboard must be reachable as a sheet from the menu.',
);

console.log('Single-screen menu contract verified.');
