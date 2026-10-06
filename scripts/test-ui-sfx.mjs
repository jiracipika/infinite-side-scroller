#!/usr/bin/env node
// UI click + redeem feedback wiring test (source audit).
//
// The engine owns gameplay sounds (game-engine.ts calls this.sfx.play
// directly); UI sounds must go through the shared audio-barrel helpers so
// every interactive surface inherits the same gating (SfxEngine.play
// refuses to sound when SFX are disabled, sfxVolume is 0, or there is no
// AudioContext — the SSR guard). This pins:
//
//   1. The audio barrel exports the UI helpers (one shared entry point)
//   2. StartScreen primary actions + mode cards click via playUiClick
//   3. The secret redeem field answers both outcomes:
//      playRedeemSuccess on ok, playRedeemReject on rejection
//   4. The Redeem button is disabled for empty input (disabled buttons
//      must never fire — and cannot, since onClick never runs)
//   5. GameOverScreen / LevelSelectScreen / PauseMenu action rows click
//   6. Sliders click DISCRETELY — on pointer release / adjust-key keyup,
//      never inside onChange (which fires per drag step and would spam)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let failures = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    failures++;
  }
}

const audioBarrel = read('src/game/audio/index.ts');
const sfxSource = read('src/game/audio/sfx.ts');
const startScreen = read('src/components/StartScreen.tsx');
const gameOver = read('src/components/GameOverScreen.tsx');
const levelSelect = read('src/components/LevelSelectScreen.tsx');
const pauseMenu = read('src/components/PauseMenu.tsx');
const touchSettings = read('src/components/TouchControlSettings.tsx');

// 1. Shared UI helpers exist in the audio barrel
for (const helper of ['playUiClick', 'playRedeemSuccess', 'playRedeemReject', 'playUiClickOnAdjustKey']) {
  assert(
    new RegExp(`export function ${helper}\\(`).test(audioBarrel),
    `audio barrel must export ${helper}`,
  );
}
assert(
  audioBarrel.includes('getSfxEngine().play("click")') &&
    audioBarrel.includes('getSfxEngine().play("redeemSuccess")') &&
    audioBarrel.includes('getSfxEngine().play("redeemReject")'),
  'UI helpers must route through the shared SfxEngine singleton',
);

// 2. StartScreen primary actions + mode cards click
assert(startScreen.includes('playUiClick'), 'StartScreen must import/use playUiClick');
assert(
  /const handlePlay = \(\) => \{\s*\n\s*playUiClick\(\);/.test(startScreen),
  'Play Endless (handlePlay) must answer with a click',
);
for (const label of ['setActiveView("character")', 'setActiveView("profile")', 'setShowMultiplayer', 'handleSplitScreen', 'handleDailyChallengeClick', 'handleLeaderboardToggle', 'setShowRunHistory', 'setShowProgression', 'setShowSettings']) {
  assert(startScreen.includes(label), `StartScreen must still define ${label}`);
}

// 3. Redeem outcomes wired at the React boundary (NOT inside lib/progression)
const redeemBlock = startScreen.match(/const handleRedeemCode = \(\) => \{[\s\S]*?\n  \};/);
assert(redeemBlock !== null, 'StartScreen must keep the handleRedeemCode boundary');
if (redeemBlock) {
  const block = redeemBlock[0];
  const okBranch = block.slice(0, block.indexOf('} else {'));
  const rejectBranch = block.slice(block.indexOf('} else {'));
  assert(okBranch.includes('playRedeemSuccess'), 'redeem ok branch must chime (playRedeemSuccess)');
  assert(rejectBranch.includes('playRedeemReject'), 'redeem reject branch must buzz (playRedeemReject)');
  assert(block.includes('redeemCoinCode(activeSlotId, redeemCode)'), 'redeem boundary must call redeemCoinCode');
}
const progressionSource = read('src/lib/progression.ts');
assert(
  !progressionSource.includes('redeemSuccess') && !progressionSource.includes('redeemReject'),
  'lib/progression.ts stays pure storage — sounds belong to the UI boundary',
);

// 4. Disabled buttons cannot fire
assert(
  /disabled=\{!redeemCode\.trim\(\)\}/.test(startScreen),
  'Redeem button must stay disabled for empty input (no click, no sound)',
);

// 5. Every screen's primary actions answer with the shared helper
assert(gameOver.includes('playUiClick'), 'GameOverScreen buttons must answer with a click');
assert(
  gameOver.includes('playUiClick();\n    onRestart();') || /playUiClick\(\);\s*\n\s*onRestart\(\);/.test(gameOver),
  'GameOverScreen Play Again must click on both click and touch paths',
);
assert(levelSelect.includes('playUiClick'), 'LevelSelectScreen cards/tabs must answer with a click');
assert(
  /const handlePickLevel = \(level: LevelConfig\) => \{\s*\n\s*playUiClick\(\);/.test(levelSelect),
  'level card picks must click through handlePickLevel',
);
assert(pauseMenu.includes('playUiClick'), 'PauseMenu action rows must answer with a click');

// 6. Sliders click discretely — never inside onChange
for (const [name, src] of [['StartScreen', startScreen], ['PauseMenu', pauseMenu], ['TouchControlSettings', touchSettings]]) {
  assert(
    /onPointerUp=\{playUiClick\}/.test(src),
    `${name} sliders must click on pointer release, not per drag step`,
  );
  const onChangeBlocks = [...src.matchAll(/onChange=\{\(e\) => \{[\s\S]*?\}\}/g)].map((m) => m[0]);
  assert(
    onChangeBlocks.every((block) => !block.includes('playUiClick') && !block.includes("play('click')")),
    `${name} slider onChange handlers must not play the click (drag spam)`,
  );
}

// Components never bypass the helper with a direct engine call
for (const [name, src] of [['StartScreen', startScreen], ['GameOverScreen', gameOver], ['LevelSelectScreen', levelSelect], ['PauseMenu', pauseMenu], ['TouchControlSettings', touchSettings]]) {
  assert(!src.includes('getSfxEngine'), `${name} must use the shared UI helpers, not the engine singleton directly`);
}

// The engine itself still owns the two new synth voices
for (const sound of ['redeemSuccess', 'redeemReject']) {
  assert(sfxSource.includes(`case "${sound}":`), `sfx.ts must dispatch ${sound}`);
}

if (failures > 0) {
  console.error(`${failures} UI SFX wiring test(s) failed`);
  process.exit(1);
}

const clickSites = [startScreen, gameOver, levelSelect, pauseMenu, touchSettings]
  .map((src) => (src.match(/playUiClick/g) || []).length)
  .reduce((a, b) => a + b, 0);
console.log(
  `UI SFX wiring verified: shared helpers gated through SfxEngine, ${clickSites} playUiClick references across ` +
  'start/game-over/level-select/pause/touch-settings surfaces, redeem success+reject chimes wired at the React boundary, ' +
  'disabled redeem input stays silent, sliders click discretely on release.',
);
