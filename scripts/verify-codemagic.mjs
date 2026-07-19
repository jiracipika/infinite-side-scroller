#!/usr/bin/env node
// Static guard for Codemagic mobile release workflows. Keeps CI/CD drift visible
// without requiring Android/iOS toolchains on this machine.
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const codemagicPath = path.join(root, 'codemagic.yaml')
const packagePath = path.join(root, 'package.json')
const appJsonPath = path.join(root, 'apps/mobile/app.json')
const bundleScriptPath = path.join(root, 'apps/mobile/scripts/bundle-game-html.js')

const failures = []

function fail(message) {
  failures.push(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function readRequired(file, label) {
  if (!fs.existsSync(file)) {
    fail(`${label} missing at ${path.relative(root, file)}`)
    return ''
  }
  return fs.readFileSync(file, 'utf8')
}

function parseJsonRequired(file, label) {
  const source = readRequired(file, label)
  if (!source) return null
  try {
    return JSON.parse(source)
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`)
    return null
  }
}

function workflowBlock(source, name) {
  const match = source.match(new RegExp(`\\n  ${name}:\\n([\\s\\S]*?)(?=\\n  [a-z0-9-]+:|\\n?$)`))
  if (!match) fail(`workflow ${name} missing`)
  return match?.[1] ?? ''
}

function requireInBlock(block, workflow, marker) {
  assert(block.includes(marker), `${workflow} missing ${marker}`)
}

const codemagic = readRequired(codemagicPath, 'codemagic.yaml')
const pkg = parseJsonRequired(packagePath, 'root package.json')
const appJson = parseJsonRequired(appJsonPath, 'apps/mobile/app.json')
readRequired(bundleScriptPath, 'mobile bundle script')

assert(codemagic.includes('workflows:'), 'codemagic.yaml must define workflows')
assert(pkg?.scripts?.['verify:codemagic'] === 'node scripts/verify-codemagic.mjs', 'package.json must expose verify:codemagic')
assert(pkg?.scripts?.verify?.includes('verify:codemagic'), 'npm run verify must include verify:codemagic')

// Guard against stray/duplicate Codemagic configs accumulating in the repo
// root (e.g. accidental copies with corrupt filenames or leftover Capacitor
// configs from a different project). Only the canonical codemagic.yaml is
// allowed at the top level.
const rootEntries = fs.readdirSync(root, { withFileTypes: true })
  .filter((entry) => {
    const lower = entry.name.toLowerCase()
    return lower.startsWith('codemagic') && lower !== 'codemagic.yaml'
  })
assert(
  rootEntries.length === 0,
  `stray Codemagic config file(s) in repo root (only codemagic.yaml is allowed): ${rootEntries.map((e) => JSON.stringify(e.name)).join(', ')}`,
)
// Reject any tracked file whose name contains control chars or backticks,
// which historically indicate a botched copy (e.g. "codemagic.yaml`\n").
const badNames = rootEntries
  .map((e) => e.name)
  .filter((name) => /[\x00-\x1f`]/.test(name))
assert(
  badNames.length === 0,
  `repo root contains file(s) with control characters or backticks in their name: ${badNames.map((n) => JSON.stringify(n)).join(', ')}`,
)

const expo = appJson?.expo
const iosBundleId = expo?.ios?.bundleIdentifier
const androidPackage = expo?.android?.package
assert(typeof iosBundleId === 'string' && iosBundleId.length > 0, 'apps/mobile/app.json must define expo.ios.bundleIdentifier')
assert(typeof androidPackage === 'string' && androidPackage.length > 0, 'apps/mobile/app.json must define expo.android.package')

const workflows = {
  'android-debug': workflowBlock(codemagic, 'android-debug'),
  'android-release': workflowBlock(codemagic, 'android-release'),
  'ios-release': workflowBlock(codemagic, 'ios-release'),
  'release-both': workflowBlock(codemagic, 'release-both'),
}

for (const [name, block] of Object.entries(workflows)) {
  if (!block) continue
  requireInBlock(block, name, 'node: 20')
  requireInBlock(block, name, 'npm ci || npm install')
  requireInBlock(block, name, 'node apps/mobile/scripts/bundle-game-html.js')
  requireInBlock(block, name, 'npx expo prebuild')
  requireInBlock(block, name, 'artifacts:')
}

for (const name of ['android-debug', 'android-release', 'release-both']) {
  const block = workflows[name]
  if (!block) continue
  requireInBlock(block, name, 'cd apps/mobile/android')
  requireInBlock(block, name, './gradlew')
}

for (const name of ['ios-release', 'release-both']) {
  const block = workflows[name]
  if (!block) continue
  requireInBlock(block, name, 'xcode: latest')
  requireInBlock(block, name, 'ios_signing:')
  requireInBlock(block, name, `bundle_identifier: ${iosBundleId}`)
  requireInBlock(block, name, 'pod install')
  requireInBlock(block, name, 'xcode-project build-ipa')
  requireInBlock(block, name, 'build/ios/ipa/*.ipa')
}

const releaseBlock = workflows['android-release']
if (releaseBlock) {
  requireInBlock(releaseBlock, 'android-release', 'android_keystore_credentials')
  requireInBlock(releaseBlock, 'android-release', 'CM_KEYSTORE_PATH')
  requireInBlock(releaseBlock, 'android-release', 'bundleRelease')
  requireInBlock(releaseBlock, 'android-release', 'outputs/bundle/release/*.aab')
}

const debugBlock = workflows['android-debug']
if (debugBlock) {
  requireInBlock(debugBlock, 'android-debug', 'assembleRelease')
  requireInBlock(debugBlock, 'android-debug', 'outputs/apk/release/*.apk')
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `FAIL: ${failure}`).join('\n'))
  process.exit(1)
}

console.log(
  `Codemagic verified: ${Object.keys(workflows).length} workflows cover mobile bundle generation, Expo prebuild, Android APK/AAB artifacts, iOS signing for ${iosBundleId}, and package verify wiring.`,
)
