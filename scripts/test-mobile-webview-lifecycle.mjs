import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const screen = fs.readFileSync(
  path.join(root, 'apps/mobile/app/(tabs)/index.tsx'),
  'utf8',
);
const bundler = fs.readFileSync(
  path.join(root, 'apps/mobile/scripts/bundle-game-html.js'),
  'utf8',
);

assert.match(
  bundler,
  /type:\s*['"]ready['"]/,
  'The bundled game must announce readiness after installing the WebView control bridge.',
);
assert.match(
  screen,
  /data\.type === ['"]ready['"]/,
  'The native game shell must receive the game document readiness message.',
);
assert.match(
  screen,
  /pendingRunRef/,
  'The native game shell must retain a selected run until the WebView is ready.',
);
assert.doesNotMatch(
  screen,
  /setTimeout\(\(\) =>\s*\{\s*callEngine\(`setSeed/,
  'Run startup must not rely on a fixed timer to race the WebView document.',
);
assert.match(
  screen,
  /onLoadStart=\{\(\) => setWebViewReady\(false\)\}/,
  'Every fresh WebView document must clear stale readiness before it loads.',
);
assert.match(
  screen,
  /AppState\.addEventListener\(['"]change['"]/, 
  'The game owner must observe native app lifecycle changes.',
);
assert.match(
  screen,
  /nextState !== ['"]active['"][\s\S]{0,500}callEngine\(['"]pause['"]\)/,
  'Backgrounding the app must pause an active game through the WebView bridge.',
);

console.log('Mobile WebView readiness and lifecycle contract verified.');
