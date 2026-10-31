#!/usr/bin/env node
// Verifies that the mobile app entry, required config fields, and game HTML bundle exist.
import fs from 'node:fs'
import path from 'node:path'

const mobileDir = path.join(process.cwd(), 'apps/mobile')

let failures = 0
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`)
    failures++
  }
}

// 1. app.json exists and has required fields
const appJsonPath = path.join(mobileDir, 'app.json')
assert(fs.existsSync(appJsonPath), 'apps/mobile/app.json must exist')

const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
const expo = appJson.expo
assert(expo, 'app.json must have an expo section')
assert(typeof expo.name === 'string' && expo.name.length > 0, 'expo.name must be a non-empty string')
assert(typeof expo.slug === 'string' && expo.slug.length > 0, 'expo.slug must be a non-empty string')
assert(typeof expo.version === 'string' && /^\d+\.\d+\.\d+$/.test(expo.version), 'expo.version must be semver')
assert(expo.ios && typeof expo.ios.bundleIdentifier === 'string', 'expo.ios.bundleIdentifier must exist')
assert(expo.android && typeof expo.android.package === 'string', 'expo.android.package must exist')
assert(Array.isArray(expo.plugins), 'expo.plugins must be an array')

// 2. Entry files exist
const entryMobile = path.join(mobileDir, 'index.mobile.ts')
const entryStandard = path.join(mobileDir, 'index.ts')
assert(fs.existsSync(entryMobile) || fs.existsSync(entryStandard), 'at least one entry file must exist (index.mobile.ts or index.ts)')

// 3. Game HTML bundle exists and is non-trivial
const gameHtmlPath = path.join(mobileDir, 'assets/game.html')
assert(fs.existsSync(gameHtmlPath), 'assets/game.html must exist')
const gameHtmlSize = fs.statSync(gameHtmlPath).size
const gameHtml = fs.readFileSync(gameHtmlPath, 'utf8')
assert(gameHtmlSize > 10000, `game.html must be at least 10KB (got ${gameHtmlSize} bytes)`)

// 4. Required asset files exist
const requiredAssets = ['icon.png', 'splash-icon.png', 'favicon.png']
for (const asset of requiredAssets) {
  assert(fs.existsSync(path.join(mobileDir, 'assets', asset)), `assets/${asset} must exist`)
}

// 5. package.json exists and has required scripts
const mobilePkgPath = path.join(mobileDir, 'package.json')
assert(fs.existsSync(mobilePkgPath), 'apps/mobile/package.json must exist')
const mobilePkg = JSON.parse(fs.readFileSync(mobilePkgPath, 'utf8'))
assert(mobilePkg.scripts && typeof mobilePkg.scripts.start === 'string', 'mobile package.json must have a start script')

// 6. Bundle script exists and enables the one-thumb auto-runner profile
const bundleScriptPath = path.join(mobileDir, 'scripts/bundle-game-html.js')
assert(fs.existsSync(bundleScriptPath), 'scripts/bundle-game-html.js must exist')
const bundleScript = fs.readFileSync(bundleScriptPath, 'utf8')
assert(bundleScript.includes('autoRun: true'), 'mobile bundle must create the engine with autoRun: true (one-thumb mode)')

// 7. Single-screen shell — no tabs. The menu IS the app screen; settings and
// leaderboard are slide-up sheets. The old (tabs) route group must be gone.
const mobileGamePath = path.join(mobileDir, 'app/index.tsx')
assert(fs.existsSync(mobileGamePath), 'apps/mobile/app/index.tsx must exist')
assert(!fs.existsSync(path.join(mobileDir, 'app/(tabs)')), 'the (tabs) route group must not exist — the shell is single-screen')
const mobileLayoutPath = path.join(mobileDir, 'app/_layout.tsx')
assert(fs.existsSync(mobileLayoutPath), 'apps/mobile/app/_layout.tsx must exist')
const mobileLayout = fs.readFileSync(mobileLayoutPath, 'utf8')
assert(!mobileLayout.includes('(tabs)'), 'the root Stack layout must not reference (tabs)')
const mobileGame = fs.existsSync(mobileGamePath) ? fs.readFileSync(mobileGamePath, 'utf8') : ''

const settingsSheetPath = path.join(mobileDir, 'components/SettingsSheet.tsx')
const leaderboardSheetPath = path.join(mobileDir, 'components/LeaderboardSheet.tsx')
assert(fs.existsSync(settingsSheetPath), 'components/SettingsSheet.tsx must exist (settings is a sheet, not a tab)')
assert(fs.existsSync(leaderboardSheetPath), 'components/LeaderboardSheet.tsx must exist (leaderboard is a sheet, not a tab)')
assert(mobileGame.includes('SettingsSheet'), 'game screen must render the settings sheet')
assert(mobileGame.includes('LeaderboardSheet'), 'game screen must render the leaderboard sheet')

// 8. One-thumb controls: jump + slide(dash) only. No movement pad, no
// attack/special buttons — the engine auto-runs and auto-attacks.
assert(mobileGame.includes("handleTouchStart('dash-press')"), 'mobile controls must expose the slide (dash) button')
assert(mobileGame.includes("'jump-press'"), 'mobile controls must expose the jump button')
assert(!mobileGame.includes('NativeMovementPad'), 'mobile controls must not render a movement pad (auto-run locks direction)')
assert(!mobileGame.includes("'move-left'") && !mobileGame.includes("'move-right'"), 'mobile controls must not send move-left/move-right (auto-run locks direction)')
assert(!mobileGame.includes("'attack-press'") && !mobileGame.includes("'special-press'") && !mobileGame.includes("'melee-press'"), 'mobile controls must not expose manual attack buttons (engine auto-attacks)')
// The bundled document must carry the auto-run engine profile.
assert(gameHtml.includes('autoRun'), 'mobile game bundle must embed the auto-run engine option')
assert(gameHtml.includes('setAutoAttack'), 'mobile game bundle must embed the engine auto-attack bridge')
// Simultaneous holds still matter for jump+slide, and stale releases must be impossible.
assert(mobileGame.includes('heldInputsRef = useRef<Set<string>>(new Set())'), 'mobile controls must track a Set of held inputs for simultaneous jump+slide')
assert(mobileGame.includes('JSON.stringify({ type, value })'), 'mobile WebView input bridge must serialize event detail safely')
assert(mobileGame.includes('onTouchCancel={onRelease}') || mobileGame.includes('onTouchCancel={() => handleTouchEnd'), 'mobile controls must release held inputs on touch cancel')
assert(mobileGame.includes("AppState.addEventListener('change'"), 'mobile controls must observe native app backgrounding')
assert(mobileGame.includes("nextState !== 'active'"), 'mobile controls must release held inputs whenever the app leaves the active state')
assert(mobileGame.includes('return releaseAll;'), 'mobile controls must release held inputs when the overlay unmounts')

// 9. Native game-over sharing must include the same competitive stats as web.
assert(gameHtml.includes('maxCombo: stats.maxCombo || 0'), 'mobile game bundle must bridge maxCombo to React Native')
assert(gameHtml.includes('enemiesDefeated: stats.enemiesDefeated || 0'), 'mobile game bundle must bridge enemiesDefeated to React Native')
assert(mobileGame.includes('Share.share({'), 'mobile game-over overlay must invoke the native share sheet')
assert(mobileGame.includes('Share this run result'), 'mobile share control must expose an accessibility label')
assert(mobileGame.includes('label="Best Combo"'), 'mobile game-over overlay must display best combo')
assert(mobileGame.includes('label="Defeated"'), 'mobile game-over overlay must display defeated enemies')

// 10. Settings bridge — persisted preferences must reach the running engine.
assert(gameHtml.includes('setAudioVolumes'), 'mobile game bundle must expose setAudioVolumes on the engine bridge')
assert(gameHtml.includes('setUserReducedParticles'), 'mobile game bundle must expose setUserReducedParticles on the engine bridge')
assert(gameHtml.includes('resumeAudio'), 'mobile game bundle must expose resumeAudio on the engine bridge')
assert(mobileGame.includes('loadGameSettings'), 'mobile game screen must load persisted game settings on mount')
assert(mobileGame.includes('settingsRef'), 'mobile game screen must hold settings in a ref for the WebView bridge')
assert(mobileGame.includes('setAudioVolumes('), 'mobile game screen must push audio volumes to the engine')
assert(mobileGame.includes('setUserReducedParticles('), 'mobile game screen must push reduced-particles preference to the engine')
assert(
  mobileGame.includes('onChanged={refreshSettings}'),
  'mobile game screen must refresh persisted settings when the settings sheet closes',
)

// 11. Game-over must carry final stats (not rely on a stale HUD snapshot).
assert(gameHtml.includes("type: 'gameover'") && gameHtml.includes('finalStats'), 'mobile game bundle must pass final stats through the gameover message')
assert(
  mobileGame.includes("typeof data.distance === 'number' ? data.distance : stats.distance"),
  'mobile gameover handler must prefer engine final stats over stale snapshot',
)

// 12. Large-controls and showFPS settings must be wired to the UI.
assert(mobileGame.includes('largeControls={largeControls}'), 'mobile touch controls must receive the largeControls setting')
assert(mobileGame.includes('showFPS={showFPS}'), 'mobile HUD must receive the showFPS setting')

// 13. Simplified menu — no onboarding card, no step list.
assert(!mobileGame.includes("Today's route"), 'menu must not contain the Today\'s route onboarding card')
assert(!mobileGame.includes('MENU_STEPS'), 'menu must not contain the menu step list')

if (failures > 0) {
  console.error(`${failures} mobile bundle check(s) failed`)
  process.exit(1)
}

console.log(`Mobile bundle verified: app.json valid (${expo.name} v${expo.version}), entry files present, game.html ${Math.round(gameHtmlSize / 1024)}KB, ${requiredAssets.length} required assets present, single-screen shell with one-thumb auto-runner controls and native run sharing present.`)
