#!/usr/bin/env node
// Haptics-on-consequence-moments wiring test (source audit).
//
// Companion to test-ui-sfx.mjs. The UI components are not Node-importable
// (TSX/React), so — same as the SFX audit — this walks the source text and
// pins the wiring:
//
//   1. haptics.ts carries the UI consequence vocabulary: success (light
//      double-tick), error (single heavier buzz), milestone (rising triple)
//      in BOTH the phone pattern table and the gamepad rumble magnitudes
//   2. Purchase outcomes buzz: handleBuyCharacter + handleBuyUpgrade play the
//      chime AND fire 'success' on the ok branch, keep the click and fire
//      'error' on the fail branch
//   3. Redeem outcomes buzz: handleRedeemCode fires 'success' on ok and
//      'error' on reject, next to their existing chime/buzz SFX
//   4. Achievement unlocks fire 'milestone' in the GameStore GAMEOVER branch
//   5. Level complete fires 'milestone' in page.tsx's onLevelComplete —
//      gated through hapticsEnabledRef so a mid-session toggle is honored
//   6. Game over keeps its death buzz and adds the record-broken milestone
//      after a delay (navigator.vibrate replaces a running pattern, so the
//      celebration must wait its turn)
//   7. The out-of-scope rule holds: NO haptics on plain UI clicks — the bank
//      pill secret, save-slot rows (select/continue/rename/reset), Play
//      buttons and sliders stay silent
//   8. Boundaries: lib/ (storage) and game-engine.ts stay haptics-free —
//      UI moments buzz at the React boundary via the shared fireHaptic gate

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

const haptics = read('src/game/input/haptics.ts');
const startScreen = read('src/components/StartScreen.tsx');
const gameStore = read('src/components/GameStore.tsx');
const page = read('src/app/page.tsx');
const gameOver = read('src/components/GameOverScreen.tsx');
const progression = read('src/lib/progression.ts');
const engine = read('src/game/engine/game-engine.ts');

// 1. The consequence vocabulary exists in both feedback channels
for (const event of ['success', 'error', 'milestone']) {
  assert(
    haptics.includes(`| '${event}'`),
    `HapticEvent union must declare '${event}'`,
  );
}
assert(
  /success: \[\d+, \d+, \d+\]/.test(haptics),
  'success must be a segmented double-tick pattern',
);
assert(
  /error: \d+[,;]/.test(haptics) || /error: \d+ \//.test(haptics),
  'error must be a single plain-number buzz',
);
assert(
  /milestone: \[\d+, \d+, \d+, \d+, \d+\]/.test(haptics),
  'milestone must be a five-segment rising triple',
);
assert(
  /success: \{ strong: [\d.]+, weak: [\d.]+ \}/.test(haptics) &&
    /error: \{ strong: [\d.]+, weak: [\d.]+ \}/.test(haptics) &&
    /milestone: \{ strong: [\d.]+, weak: [\d.]+ \}/.test(haptics),
  'RUMBLE_MAGNITUDES must cover success/error/milestone (gamepad parity)',
);

// 2. Purchase outcomes buzz — success rides with the register, failure thuds
const extractHandler = (src, name) => {
  const m = src.match(new RegExp(`const ${name} = \\([\\w: ]*\\) => \\{[\\s\\S]*?\\n  \\};`));
  return m ? m[0] : null;
};
for (const handler of ['handleBuyCharacter', 'handleBuyUpgrade']) {
  const block = extractHandler(startScreen, handler);
  assert(block !== null, `StartScreen must keep the ${handler} boundary`);
  if (block) {
    const okBranch = block.slice(0, block.indexOf('} else {'));
    const failBranch = block.slice(block.indexOf('} else {'));
    assert(
      okBranch.includes('fireHaptic("success"'),
      `${handler} ok branch must buzz 'success' with the purchase chime`,
    );
    assert(
      okBranch.includes('playPurchase'),
      `${handler} ok branch must still ring the register`,
    );
    assert(
      failBranch.includes('fireHaptic("error"'),
      `${handler} fail branch must buzz 'error'`,
    );
  }
}
assert(
  /fireHaptic\("success", settings\.hapticsEnabled\)/.test(startScreen),
  'StartScreen consequence buzzes must gate through settings.hapticsEnabled',
);

// 3. Redeem outcomes buzz — success chime + tick, reject buzz + thud
const redeemBlock = extractHandler(startScreen, 'handleRedeemCode');
assert(redeemBlock !== null, 'StartScreen must keep the handleRedeemCode boundary');
if (redeemBlock) {
  const okBranch = redeemBlock.slice(0, redeemBlock.indexOf('} else {'));
  const rejectBranch = redeemBlock.slice(redeemBlock.indexOf('} else {'));
  assert(
    okBranch.includes('playRedeemSuccess') && okBranch.includes('fireHaptic("success"'),
    'redeem ok branch must chime AND buzz success',
  );
  assert(
    rejectBranch.includes('playRedeemReject') && rejectBranch.includes('fireHaptic("error"'),
    'redeem reject branch must buzz SFX AND buzz error',
  );
}

// 4. Achievement unlocks fire the milestone triple (GameStore GAMEOVER branch)
const achievementsBlock = gameStore.match(
  /const newIds = checkNewAchievements\([\s\S]*?saveUnlockedAchievements\(\[\.\.\.prevUnlocked, \.\.\.newIds\]\);[\s\S]*?\}/,
);
assert(achievementsBlock !== null, 'GameStore must keep the achievement unlock branch');
if (achievementsBlock) {
  assert(
    achievementsBlock[0].includes("fireHaptic('milestone'"),
    "achievement unlock must buzz 'milestone'",
  );
  assert(
    achievementsBlock[0].includes('state.settings.hapticsEnabled'),
    'achievement buzz must gate through state.settings.hapticsEnabled',
  );
}

// 5. Level complete fires milestone through the ref (fresh after toggles)
assert(
  /fireHaptic\('milestone', hapticsEnabledRef\.current\)/.test(page),
  "page.tsx onLevelComplete must buzz 'milestone' through hapticsEnabledRef",
);
assert(
  /hapticsEnabledRef\.current = settings\.hapticsEnabled;/.test(page),
  'page.tsx must keep hapticsEnabledRef synced to the live setting',
);

// 6. Game over: death buzz stays; record runs add the delayed milestone
assert(
  /fireHaptic\('death', hapticsEnabled\);/.test(gameOver),
  'GameOverScreen must keep the death buzz',
);
const deathEffect = gameOver.match(/useEffect\(\(\) => \{\s*\n\s*fireHaptic\('death'[\s\S]*?\n  \}, \[hapticsEnabled, recordCount\]\);/);
assert(deathEffect !== null, 'GameOverScreen death effect must cover the record milestone');
if (deathEffect) {
  assert(
    deathEffect[0].includes("fireHaptic('milestone'"),
    "a record-breaking run must follow death with the 'milestone' buzz",
  );
  assert(
    deathEffect[0].includes('window.setTimeout'),
    'milestone must be delayed — navigator.vibrate would cut the death pattern short',
  );
  assert(
    deathEffect[0].includes('clearTimeout'),
    'the delayed milestone must clean up its timer on unmount',
  );
}

// 7. Plain UI clicks stay SILENT — haptics are for consequences, not taps
for (const handler of ['handleBankPillTap', 'handleSelectSaveSlot', 'handleContinueFromSlot', 'handleRenameSlot', 'handleResetSlot', 'handlePlay']) {
  const block = handler === 'handlePlay'
    ? (startScreen.match(/const handlePlay = \(\) => \{[\s\S]*?\n  \};/) || [null])[0]
    : extractHandler(startScreen, handler);
  assert(block !== null, `StartScreen must keep the ${handler} boundary`);
  if (block) {
    assert(
      !block.includes('fireHaptic'),
      `${handler} is a plain UI interaction — it must NOT buzz`,
    );
  }
}

// 8. Boundaries: storage stays pure, the engine stays haptics-free
assert(
  !progression.includes('fireHaptic') && !progression.includes('navigator.vibrate'),
  'lib/progression.ts stays storage-only — haptics belong to the UI boundary',
);
assert(
  !engine.includes('fireHaptic'),
  'game-engine stays haptics-free — page.tsx fires the level-complete buzz',
);

if (failures > 0) {
  console.error(`${failures} haptics wiring test(s) failed`);
  process.exit(1);
}

const buzzes = [startScreen, gameStore, page, gameOver]
  .map((src) => (src.match(/fireHaptic\(/g) || []).length)
  .reduce((a, b) => a + b, 0);
console.log(
  `Haptics moments verified: success/error/milestone vocabulary in pattern table + rumble bridge, ` +
  `${buzzes} fireHaptic call sites — purchase ok/fail and redeem ok/reject buzz at the StartScreen ` +
  'boundary, achievement unlocks triple in GameStore, level complete triples via hapticsEnabledRef in ' +
  'page.tsx, game-over adds the delayed record milestone after the death pattern; plain UI clicks ' +
  '(bank pill secret, save-slot rows, Play) stay silent; lib/ and game-engine stay haptics-free.',
);
