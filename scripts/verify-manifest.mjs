#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const publicManifestPath = path.join(root, 'public/manifest.json')
const appManifestPath = path.join(root, 'src/app/manifest.ts')
const errors = []

function assert(condition, message) {
  if (!condition) errors.push(message)
}

assert(fs.existsSync(publicManifestPath), 'public/manifest.json must exist')
assert(fs.existsSync(appManifestPath), 'src/app/manifest.ts must exist')

if (fs.existsSync(publicManifestPath)) {
  const manifest = JSON.parse(fs.readFileSync(publicManifestPath, 'utf8'))
  assert(manifest.name === 'Dashverse', 'public manifest name must be Dashverse')
  assert(typeof manifest.short_name === 'string' && manifest.short_name.length > 0, 'public manifest short_name is required')
  assert(manifest.start_url === '/', 'public manifest start_url should be /')
  assert(manifest.display === 'standalone', 'public manifest display should be standalone')
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 2, 'public manifest should define at least two icons')
}

if (fs.existsSync(appManifestPath)) {
  const source = fs.readFileSync(appManifestPath, 'utf8')
  for (const marker of ['name:', 'short_name:', 'start_url:', 'display:', 'icons:']) {
    assert(source.includes(marker), `App Router manifest missing marker ${marker}`)
  }
  assert(source.includes('Dashverse'), 'App Router manifest should include Dashverse branding')
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Manifest verified: public manifest + App Router manifest include Dashverse branding, standalone display, start_url, and icons.')
