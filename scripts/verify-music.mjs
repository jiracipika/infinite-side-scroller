#!/usr/bin/env node
/**
 * Verifies the procedural music system. Checks:
 *
 *  1. MusicEngine exists with volume/intensity/start-stop/duck API and an
 *     SSR-safe singleton factory (getMusicEngine).
 *  2. The music context is fully guarded behind typeof window checks
 *     (SSR safety) — no top-level AudioContext access.
 *  3. GameEngine bridges: setAudioVolumes forwards the optional music volume,
 *     setMusicPlaying / setMusicIntensity exist, resumeAudio + visibility
 *     change keep the soundtrack consistent.
 *  4. Intensity is fed from run distance inside the engine update loop.
 *  5. Game over ducks/fades the soundtrack so the stinger reads clearly.
 *  6. React layer drives run-lifecycle playback from game state and syncs
 *     musicVolume from settings.
 *  7. PauseMenu exposes a Music volume slider (musicVolume setting is live).
 *  8. Mobile shell pushes musicVolume through the WebView bridge and the
 *     settings screen has a real Music Volume slider (no "Coming soon").
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function mustContain(source, pattern, label) {
  if (!pattern.test(source)) errors.push(`Missing: ${label}`)
}

function mustNotContain(source, pattern, label) {
  if (pattern.test(source)) errors.push(`Forbidden: ${label}`)
}

// ── 1. MusicEngine core ─────────────────────────────────────────
const musicSource = read('src/game/audio/music.ts')
mustContain(musicSource, /export class MusicEngine/, 'MusicEngine class')
mustContain(musicSource, /setVolume\s*\(\s*master:\s*number,\s*music:\s*number\s*\)/, 'setVolume(master, music)')
mustContain(musicSource, /setIntensity\s*\(/, 'setIntensity method')
mustContain(musicSource, /start\s*\(\s*\):\s*void/, 'start method')
mustContain(musicSource, /stop\s*\(/, 'stop method')
mustContain(musicSource, /duck\s*\(\s*\):\s*void/, 'duck method')
mustContain(musicSource, /setEnabled\s*\(/, 'setEnabled method (tab-hidden mute)')
mustContain(musicSource, /resume\s*\(\s*\):\s*boolean/, 'resume method (autoplay policy)')
mustContain(musicSource, /get isPlaying/, 'isPlaying getter')
mustContain(musicSource, /dispose\s*\(\s*\):\s*void/, 'dispose method')

// ── 2. SSR safety ───────────────────────────────────────────────
mustContain(musicSource, /if\s*\(\s*typeof window === "undefined"\s*\)\s*return false/, 'window guard in ensureContext')
mustNotContain(musicSource, /new\s+\w*AudioContext\s*\(\s*\)/, 'top-level AudioContext construction (must be guarded via Ctor)')

// ── 3. Singleton export ─────────────────────────────────────────
const audioIndex = read('src/game/audio/index.ts')
mustContain(audioIndex, /export function getMusicEngine/, 'getMusicEngine singleton factory')
mustContain(audioIndex, /export \{ MusicEngine \} from "\.\/music"/, 'MusicEngine barrel export')

// ── 4. Engine bridges ───────────────────────────────────────────
const engineSource = read('src/game/engine/game-engine.ts')
mustContain(engineSource, /setAudioVolumes\s*\(\s*master:\s*number,\s*sfx:\s*number,\s*music\?:\s*number\s*\)/, 'setAudioVolumes optional music param')
mustContain(engineSource, /setMusicPlaying\s*\(\s*playing:\s*boolean\s*\)/, 'setMusicPlaying bridge')
mustContain(engineSource, /setMusicIntensity\s*\(/, 'setMusicIntensity bridge')
mustContain(engineSource, /private music:\s*MusicEngine = getMusicEngine\(\)/, 'engine holds the music singleton')
mustContain(engineSource, /this\.music\.setEnabled\(!document\.hidden\)/, 'music muted on visibility change')
mustContain(engineSource, /this\.music\.resume\(\)/, 'music resumed on gesture resume')

// ── 5. Intensity from run distance ──────────────────────────────
mustContain(
  engineSource,
  /this\.music\.setIntensity\(Math\.min\(1,\s*this\.player\.distance\s*\/\s*\d+\)\)/,
  'music intensity fed from player distance in the update loop',
)

// ── 6. Game-over duck + fade ────────────────────────────────────
mustContain(engineSource, /this\.music\.duck\(\)/, 'game-over music duck')
mustContain(engineSource, /this\.music\.stop\(1\.2\)/, 'game-over music fade-out')

// ── 7. React run lifecycle + settings sync ──────────────────────
const pageSource = read('src/app/page.tsx')
mustContain(pageSource, /setMusicPlaying\(state === "playing"\)/, 'music playback driven by game state')
mustContain(
  pageSource,
  /settings\.masterVolume,\s*\n\s*settings\.sfxVolume,\s*\n\s*settings\.musicVolume,/,
  'musicVolume synced into the engine alongside master/sfx',
)

// ── 8. PauseMenu slider ─────────────────────────────────────────
const pauseSource = read('src/components/PauseMenu.tsx')
mustContain(pauseSource, /settings\.musicVolume/, 'PauseMenu music volume slider binding')

// ── 9. Mobile shell + settings ──────────────────────────────────
const mobileGamePath = 'apps/mobile/app/(tabs)/index.tsx'
const mobileGame = read(mobileGamePath)
mustContain(mobileGame, /setAudioVolumes\(\$\{settings\.masterVolume\}, \$\{settings\.sfxVolume\}, \$\{settings\.musicVolume\}\)/, 'mobile settings push includes musicVolume')
mustContain(mobileGame, /setAudioVolumes\(\$\{s\.masterVolume\}, \$\{s\.sfxVolume\}, \$\{s\.musicVolume\}\)/, 'mobile run-start push includes musicVolume')

const mobileSettingsPath = 'apps/mobile/app/(tabs)/settings.tsx'
const mobileSettings = read(mobileSettingsPath)
mustContain(mobileSettings, /usePersistedSetting\('musicVolume', 0\.6\)/, 'mobile musicVolume persisted setting')
mustContain(mobileSettings, /label="Music Volume" value=\{\`\$\{Math\.round\(musicVolume \* 100\)\}%\`\}/, 'mobile Music Volume slider row')
mustNotContain(mobileSettings, /No music tracks yet/, 'stale "no music tracks" placeholder')

// ── Report ──────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error('verify:music FAILED')
  for (const error of errors) console.error(`  ✗ ${error}`)
  process.exit(1)
}
console.log('verify:music OK — procedural music system fully wired')
