import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'apps/mobile/app/(tabs)/index.tsx'),
  'utf8',
);

assert.match(
  source,
  /const \[webViewKey, setWebViewKey\] = useState\(0\);/,
  'The native shell needs a remount key for a terminated Android WebView renderer.',
);
assert.match(
  source,
  /onRenderProcessGone=\{handleRenderProcessGone\}/,
  'The WebView must surface renderer-process termination to the native shell.',
);
assert.match(
  source,
  /setWebViewKey\(previous => previous \+ 1\)/,
  'Renderer recovery must remount the local game document instead of retaining a dead surface.',
);
assert.match(
  source,
  /setGameState\('menu'\)/,
  'Renderer recovery must return the player to a usable native menu.',
);

console.log('Mobile WebView renderer-recovery contract verified.');
