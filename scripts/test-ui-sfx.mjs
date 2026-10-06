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
//   7. Second-row surfaces click too: roster chips (select AND buy),
//      shop Buy, multiplayer Host/Join, save-slot grid (pick, continue,
//      rename, reset), leaderboard scope tabs + Clear + ghost Race,
//      Run Lab Clear, avatar presets, Achievements opener + modal Close
//   8. Screen stragglers: LevelCompleteScreen Levels/Retry/Next,
//      SplitScreenMode exit/restart rows, ControlsHint dismiss
//   9. The bank pill's 5-tap secret stays SILENT — no click sound may
//      telegraph the hidden gesture
//  10. Real buys ring the register: handleBuyCharacter and handleBuyUpgrade
//      SUCCESS branches play the purchase chime (never the plain click),
//      while failure / can't-afford branches keep the plain click

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
const achievementsModal = read('src/components/AchievementsModal.tsx');
const levelComplete = read('src/components/LevelCompleteScreen.tsx');
const splitScreen = read('src/components/SplitScreenMode.tsx');
const controlsHint = read('src/components/ControlsHint.tsx');

// 1. Shared UI helpers exist in the audio barrel
for (const helper of ['playUiClick', 'playRedeemSuccess', 'playRedeemReject', 'playPurchase', 'playUiClickOnAdjustKey']) {
  assert(
    new RegExp(`export function ${helper}\\(`).test(audioBarrel),
    `audio barrel must export ${helper}`,
  );
}
assert(
  audioBarrel.includes('getSfxEngine().play("click")') &&
    audioBarrel.includes('getSfxEngine().play("redeemSuccess")') &&
    audioBarrel.includes('getSfxEngine().play("redeemReject")') &&
    audioBarrel.includes('getSfxEngine().play("purchase")'),
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
for (const [name, src] of [['StartScreen', startScreen], ['GameOverScreen', gameOver], ['LevelSelectScreen', levelSelect], ['PauseMenu', pauseMenu], ['TouchControlSettings', touchSettings], ['AchievementsModal', achievementsModal], ['LevelCompleteScreen', levelComplete], ['SplitScreenMode', splitScreen], ['ControlsHint', controlsHint]]) {
  assert(!src.includes('getSfxEngine'), `${name} must use the shared UI helpers, not the engine singleton directly`);
}

// 7. Second-row surfaces click through the shared helper
assert(
  /const handleHostMultiplayer = \(\) => \{\s*\n\s*if \(!onPlayMultiplayer\) return;\s*\n\s*playUiClick\(\);/.test(startScreen),
  'Host Room must answer with a click (after its bail-out guard)',
);
assert(
  /const handleJoinMultiplayer = \(\) => \{\s*\n\s*if \(!onPlayMultiplayer\) return;\s*\n\s*playUiClick\(\);/.test(startScreen),
  'Join Room must answer with a click (after its bail-out guard)',
);
for (const handler of ['handleSelectSaveSlot', 'handleContinueFromSlot', 'handleRenameSlot', 'handleResetSlot']) {
  assert(
    new RegExp(`const ${handler} = \\(slotId: SaveSlotId\\) => \\{\\s*\\n\\s*playUiClick\\(\\);`).test(startScreen),
    `${handler} must answer with a click`,
  );
}
// 10. Real buys ring the register — success plays the purchase chime INSTEAD
//     of the plain click; failure keeps the click. (Disabled buttons above
//     already keep can't-afford/owned taps silent.)
assert(
  /const handleBuyUpgrade = \(upgradeId: string\) => \{\s*\n\s*const result = purchaseUpgrade\(activeSlotId, upgradeId\);/.test(startScreen),
  'shop Buy must route through purchaseUpgrade in handleBuyUpgrade',
);
assert(
  /disabled=\{owned \|\| !canAfford\}/.test(startScreen),
  'shop Buy must stay disabled when owned/unaffordable (no click, no sound)',
);
const buyUpgradeBlock = startScreen.match(/const handleBuyUpgrade = \(upgradeId: string\) => \{[\s\S]*?\n  \};/);
assert(buyUpgradeBlock !== null, 'StartScreen must keep the handleBuyUpgrade boundary');
if (buyUpgradeBlock) {
  const block = buyUpgradeBlock[0];
  const okBranch = block.slice(0, block.indexOf('} else {'));
  const failBranch = block.slice(block.indexOf('} else {'));
  assert(okBranch.includes('playPurchase'), 'shop Buy success must ring the register (playPurchase)');
  assert(!okBranch.includes('playUiClick'), 'shop Buy success must NOT answer with the plain click');
  assert(failBranch.includes('playUiClick'), 'shop Buy failure keeps the plain click');
  assert(!failBranch.includes('playPurchase'), 'shop Buy failure must NOT ring the register');
}
assert(
  /const handleBuyCharacter = \(characterId: string\) => \{\s*\n\s*const result = purchaseCharacter\(activeSlotId, characterId\);/.test(startScreen),
  'roster buys must route through purchaseCharacter in handleBuyCharacter',
);
const buyCharBlock = startScreen.match(/const handleBuyCharacter = \(characterId: string\) => \{[\s\S]*?\n  \};/);
assert(buyCharBlock !== null, 'StartScreen must keep the handleBuyCharacter boundary');
if (buyCharBlock) {
  const block = buyCharBlock[0];
  const okBranch = block.slice(0, block.indexOf('} else {'));
  const failBranch = block.slice(block.indexOf('} else {'));
  assert(okBranch.includes('playPurchase'), 'character buy success must ring the register (playPurchase)');
  assert(!okBranch.includes('playUiClick'), 'character buy success must NOT answer with the plain click');
  assert(failBranch.includes('playUiClick'), 'character buy failure keeps the plain click');
  assert(!failBranch.includes('playPurchase'), 'character buy failure must NOT ring the register');
}
// Roster chips: unlocked taps stay a plain select click; locked taps route to
// the buy handler with NO pre-click — the handler alone decides the sound
// (register on success, click on failure), so a buy never double-fires.
assert(
  /onClick=\{\(\) => \{\s*\n\s*if \(!unlocked\) \{[\s\S]{0,200}?handleBuyCharacter\(c\.id\);/.test(startScreen),
  'character roster chips must route locked taps straight to the buy handler (no pre-click)',
);
assert(
  /playUiClick\(\);\s*\n\s*setAvatarId\(preset\.id\);/.test(startScreen),
  'avatar preset picks must answer with a click',
);
assert(
  /playUiClick\(\);\s*\n\s*setShowAchievements\(true\);/.test(startScreen),
  'the Achievements opener must answer with a click',
);
assert(
  /playUiClick\(\);\s*\n\s*setOnlineScope\(scope\);/.test(startScreen),
  'leaderboard scope tabs (global/weekly/daily) must answer with a click',
);
assert(
  /playUiClick\(\);\s*\n\s*clearLeaderboard\(\);/.test(startScreen),
  'leaderboard Clear must answer with a click',
);
assert(
  /playUiClick\(\);\s*\n\s*clearRunHistory\(\);/.test(startScreen),
  'Run Lab Clear must answer with a click',
);
assert(
  /playUiClick\(\);\s*\n\s*void handlePlayOnlineGhost\(entry\.id\);/.test(startScreen),
  'ghost Race buttons must answer with a click',
);
assert(
  /disabled=\{loadingReplayId === entry\.id\}/.test(startScreen),
  'ghost Race stays disabled while its replay loads (no double click)',
);
assert(
  achievementsModal.includes('playUiClick') &&
    /onClick=\{\(\) => \{\s*\n\s*playUiClick\(\);\s*\n\s*onClose\(\);/.test(achievementsModal),
  'AchievementsModal Close must answer with a click',
);

// 8. Screen stragglers: LevelCompleteScreen, SplitScreenMode, ControlsHint
for (const action of ['onBack', 'onRetry', 'onNext']) {
  assert(
    new RegExp(`playUiClick\\(\\);\\s*\\n\\s*${action}\\(\\);`).test(levelComplete),
    `LevelCompleteScreen ${action} button must answer with a click`,
  );
}
for (const action of ['onExit', 'restartBoth', 'onRestart']) {
  const hits = (splitScreen.match(new RegExp(`playUiClick\\(\\);\\s*\\n\\s*${action}\\(\\);`, 'g')) || []).length;
  const expected = action === 'onExit' || action === 'restartBoth' ? 2 : 1;
  assert(
    hits >= expected,
    `SplitScreenMode ${action} must answer with a click on every row (found ${hits}, need ${expected})`,
  );
}
assert(
  /const dismiss = \(\) => \{\s*\n\s*playUiClick\(\);/.test(controlsHint),
  'ControlsHint dismiss must answer with a click',
);

// 9. The bank pill's 5-tap secret stays SILENT — a click here would
//    telegraph the hidden gesture to anyone watching/listening.
const bankPillBlock = startScreen.match(/const handleBankPillTap = \(\) => \{[\s\S]*?\n  \};/);
assert(bankPillBlock !== null, 'StartScreen must keep the handleBankPillTap boundary');
if (bankPillBlock) {
  const block = bankPillBlock[0];
  assert(
    !block.includes('playUiClick') && !block.includes('playRedeemSuccess') && !block.includes('playRedeemReject'),
    'bank pill 5-tap counter must never sound — the gesture stays secret',
  );
}
assert(
  startScreen.includes('onClick={handleBankPillTap}'),
  'bank pill keeps its tap counter wired (silently)',
);

// The engine itself still owns the synth voices for the boundary helpers
for (const sound of ['redeemSuccess', 'redeemReject', 'purchase']) {
  assert(sfxSource.includes(`case "${sound}":`), `sfx.ts must dispatch ${sound}`);
}

if (failures > 0) {
  console.error(`${failures} UI SFX wiring test(s) failed`);
  process.exit(1);
}

const clickSites = [
  startScreen, gameOver, levelSelect, pauseMenu, touchSettings,
  achievementsModal, levelComplete, splitScreen, controlsHint,
]
  .map((src) => (src.match(/playUiClick/g) || []).length)
  .reduce((a, b) => a + b, 0);
console.log(
  `UI SFX wiring verified: shared helpers gated through SfxEngine, ${clickSites} playUiClick references across ` +
  'start/game-over/level-select/pause/touch-settings surfaces plus roster chips, shop buy, multiplayer host/join, ' +
  'save slots, board tabs + clear + ghost race, run lab, avatar presets, achievements modal, level-complete and ' +
  'split-screen rows; redeem success+reject chimes wired at the React boundary; real buys (character unlock, shop ' +
  'upgrade) ring the purchase chime on success while failures keep the plain click; disabled buy/race/redeem inputs ' +
  'stay silent; the bank-pill 5-tap secret stays silent; sliders click discretely on release.',
);
