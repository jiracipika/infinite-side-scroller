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

// 6. Bundle script exists
const bundleScriptPath = path.join(mobileDir, 'scripts/bundle-game-html.js')
assert(fs.existsSync(bundleScriptPath), 'scripts/bundle-game-html.js must exist')

// 7. Native touch bridge must allow simultaneous holds (move + jump/attack) and avoid stale releases.
const mobileGamePath = path.join(mobileDir, 'app/(tabs)/index.tsx')
assert(fs.existsSync(mobileGamePath), 'apps/mobile/app/(tabs)/index.tsx must exist')
const mobileGame = fs.existsSync(mobileGamePath) ? fs.readFileSync(mobileGamePath, 'utf8') : ''
assert(mobileGame.includes('heldInputsRef = useRef<Set<string>>(new Set())'), 'mobile controls must track a Set of held inputs for simultaneous move+jump/attack')
assert(mobileGame.includes('JSON.stringify({ type, value })'), 'mobile WebView input bridge must serialize event detail safely')
assert(mobileGame.includes('onTouchCancel={onRelease}'), 'mobile controls must release held inputs on touch cancel')
assert(mobileGame.includes("AppState.addEventListener('change'"), 'mobile controls must observe native app backgrounding')
assert(mobileGame.includes("nextState !== 'active'"), 'mobile controls must release held inputs whenever the app leaves the active state')
assert(mobileGame.includes('return releaseAll;'), 'mobile controls must release held inputs when the overlay unmounts')

// 8. Native game-over sharing must include the same competitive stats as web.
assert(gameHtml.includes('maxCombo: stats.maxCombo || 0'), 'mobile game bundle must bridge maxCombo to React Native')
assert(gameHtml.includes('enemiesDefeated: stats.enemiesDefeated || 0'), 'mobile game bundle must bridge enemiesDefeated to React Native')
assert(mobileGame.includes('Share.share({'), 'mobile game-over overlay must invoke the native share sheet')
assert(mobileGame.includes('Share this run result'), 'mobile share control must expose an accessibility label')
assert(mobileGame.includes('label="Best Combo"'), 'mobile game-over overlay must display best combo')
assert(mobileGame.includes('label="Defeated"'), 'mobile game-over overlay must display defeated enemies')

if (failures > 0) {
  console.error(`${failures} mobile bundle check(s) failed`)
  process.exit(1)
}

console.log(`Mobile bundle verified: app.json valid (${expo.name} v${expo.version}), entry files present, game.html ${Math.round(gameHtmlSize / 1024)}KB, ${requiredAssets.length} required assets present, simultaneous touch bridge and native run sharing present.`)
