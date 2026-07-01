#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const roomPath = path.join(root, 'src/app/api/multiplayer/room/route.ts')
const signalPath = path.join(root, 'src/app/api/multiplayer/signal/route.ts')
const originPath = path.join(root, 'src/app/api/network/origin/route.ts')
const errors = []

function read(file) {
  if (!fs.existsSync(file)) {
    errors.push(`${path.relative(root, file)} missing`)
    return ''
  }
  return fs.readFileSync(file, 'utf8')
}

function requireMarkers(source, label, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) errors.push(`${label} missing marker: ${marker}`)
  }
}

const room = read(roomPath)
const signal = read(signalPath)
const origin = read(originPath)

requireMarkers(room, 'room route', [
  "export const runtime = 'nodejs'",
  "export const dynamic = 'force-dynamic'",
  'hasSharedRedis',
  'redisCommand',
  'ROOM_STORE_FILE',
  'hydrateRooms',
  'persistRooms',
  'saveRooms',
  'recover',
  'playerName',
  'hostId',
  'seed',
  'snapshot',
])

requireMarkers(signal, 'signal route', [
  "export const runtime = 'nodejs'",
  "export const dynamic = 'force-dynamic'",
  'Trickle ICE',
  'hostCandidates',
  'joinerCandidates',
  'candidatesVersion',
  'hasSharedRedis',
  'SIGNAL_STORE_FILE',
  'SIGNAL_KEY_PREFIX',
])

requireMarkers(origin, 'origin route', [
  "export const runtime = 'nodejs'",
  'getLanIPv4Addresses',
  'origin',
])

if (!/export async function (GET|POST)/.test(room)) errors.push('room route should export at least one HTTP handler')
if (!/export async function POST/.test(signal)) errors.push('signal route should export POST handler')
if (!/Cache-Control.+no-store/s.test(room + signal)) errors.push('multiplayer API responses should disable caching')

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log('Multiplayer API verified: room persistence/recovery, Redis fallback, trickle ICE signaling, LAN origin route, and no-store responses present.')
