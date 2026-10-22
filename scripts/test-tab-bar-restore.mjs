import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const screen = fs.readFileSync(
  path.join(root, 'apps/mobile/app/(tabs)/index.tsx'),
  'utf8',
);

// The tab bar hides during a run and must come back after Quit to Menu.
// React Navigation keeps the last-registered <Tabs.Screen> options after the
// element unmounts, so the hide must be a conditional style on an
// always-mounted Screen — not a conditional mount.
assert.match(
  screen,
  /tabBarStyle:\s*gameState === ['"]menu['"]\s*\?\s*undefined\s*:\s*\{\s*display:\s*'none'\s*\}/,
  'The Game tab must restore the default tab bar style in the menu state by passing undefined, not by unmounting Tabs.Screen.',
);
assert.doesNotMatch(
  screen,
  /\{gameState !== ['"]menu['"] && \(\s*<Tabs\.Screen/,
  'Tabs.Screen must stay mounted for every game state; unmounting it leaves the hidden tab bar stranded after Quit to Menu.',
);

console.log('Tab bar restore contract verified.');
