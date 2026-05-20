import { NextRequest, NextResponse } from 'next/server';
import type { NetEnemySnapshot, NetPlayerSnapshot, NetPlayerState, NetRoomState, NetSyncPayload, NetSyncResponse } from '@/game/multiplayer/types';
import {
  MP_HISTORY_BUFFER_DURATION_MS,
  MP_SERVER_TICK_RATE,
  MP_SNAPSHOT_RATE,
} from '@/game/multiplayer/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ServerPlayerMeta {
  lastInputSeq: number;
  inferredLoss: number;
  history: Array<{ t: number; snapshot: NetPlayerSnapshot }>;
}

interface RoomServerState {
  lastTickAt: number;
  tickAccumulatorMs: number;
  tickCounter: number;
  tickWindowStart: number;
  tickRateNow: number;
  lastSnapshotAt: number;
  snapshotCounter: number;
  snapshotWindowStart: number;
  snapshotRateNow: number;
}

type RoomMap = Map<string, {
  id: string;
  seed: number;
  hostId: string;
  players: Map<string, NetPlayerState>;
  enemies: NetEnemySnapshot[];
  enemyVersion: number;
  enemyChecksum: number;
  playerMeta: Map<string, ServerPlayerMeta>;
  server: RoomServerState;
  createdAt: number;
}>;

const PLAYER_TTL_MS = 8 * 60_000;
const ROOM_TTL_MS = 2 * 60 * 60_000;
const EMPTY_ROOM_GRACE_MS = 12 * 60_000;
const MAX_PLAYER_SPEED_PX_PER_SEC = 880;
const MAX_PLAYER_FALL_SPEED_PX_PER_SEC = 1600;
const MAX_POSITION_BURST = 240;

declare global {
  // eslint-disable-next-line no-var
  var __infiniteMpRooms: RoomMap | undefined;
}

function getRooms(): RoomMap {
  if (!global.__infiniteMpRooms) global.__infiniteMpRooms = new Map();
  return global.__infiniteMpRooms;
}

function ensureRoomState(room: NonNullable<ReturnType<RoomMap['get']>>): void {
  const now = Date.now();
  if (!room.playerMeta) room.playerMeta = new Map();
  if (!room.server) {
    room.server = {
      lastTickAt: now,
      tickAccumulatorMs: 0,
      tickCounter: 0,
      tickWindowStart: now,
      tickRateNow: MP_SERVER_TICK_RATE,
      lastSnapshotAt: now,
      snapshotCounter: 0,
      snapshotWindowStart: now,
      snapshotRateNow: MP_SNAPSHOT_RATE,
    };
  }
  for (const [pid] of room.players) {
    if (!room.playerMeta.has(pid)) {
      room.playerMeta.set(pid, { lastInputSeq: 0, inferredLoss: 0, history: [] });
    }
  }
  if (!Array.isArray(room.enemies)) room.enemies = [];
  if (!Number.isFinite(room.enemyVersion)) room.enemyVersion = 0;
  if (!Number.isFinite(room.enemyChecksum)) room.enemyChecksum = 0;
}

function randomId(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function playerId(): string {
  return `p_${Math.random().toString(36).slice(2, 10)}`;
}

function sanitizeName(name: unknown): string {
  const safe = typeof name === 'string' ? name.trim().slice(0, 20) : '';
  return safe || 'Player';
}

function normalizeRoomId(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

function sanitizeSnapshot(snapshot: unknown, characterIdFallback: string): NetPlayerSnapshot {
  const s = (snapshot ?? {}) as Partial<NetPlayerSnapshot>;
  return {
    x: Number.isFinite(s.x) ? Number(s.x) : 200,
    y: Number.isFinite(s.y) ? Number(s.y) : 300,
    vx: Number.isFinite(s.vx) ? Number(s.vx) : 0,
    vy: Number.isFinite(s.vy) ? Number(s.vy) : 0,
    facingRight: !!s.facingRight,
    onGround: !!s.onGround,
    health: Number.isFinite(s.health) ? Math.max(0, Number(s.health)) : 3,
    maxHealth: Number.isFinite(s.maxHealth) ? Math.max(1, Number(s.maxHealth)) : 3,
    characterId: typeof s.characterId === 'string' && s.characterId ? s.characterId : characterIdFallback,
    width: Number.isFinite(s.width) ? Math.max(16, Number(s.width)) : 24,
    height: Number.isFinite(s.height) ? Math.max(24, Number(s.height)) : 32,
    distance: Number.isFinite(s.distance) ? Math.max(0, Number(s.distance)) : 0,
  };
}

function cloneSnapshot(s: NetPlayerSnapshot): NetPlayerSnapshot {
  return {
    x: s.x,
    y: s.y,
    vx: s.vx,
    vy: s.vy,
    facingRight: s.facingRight,
    onGround: s.onGround,
    health: s.health,
    maxHealth: s.maxHealth,
    characterId: s.characterId,
    width: s.width,
    height: s.height,
    distance: s.distance,
  };
}

function sanitizeEnemies(value: unknown): NetEnemySnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 80).map((raw) => {
    const e = (raw ?? {}) as Partial<NetEnemySnapshot>;
    return {
      id: typeof e.id === 'string' ? e.id.slice(0, 80) : '',
      type: typeof e.type === 'string' ? e.type.slice(0, 24) : 'enemy',
      x: Number.isFinite(e.x) ? Number(e.x) : 0,
      y: Number.isFinite(e.y) ? Number(e.y) : 0,
      vx: Number.isFinite(e.vx) ? Number(e.vx) : 0,
      vy: Number.isFinite(e.vy) ? Number(e.vy) : 0,
      health: Number.isFinite(e.health) ? Math.max(0, Number(e.health)) : 1,
      alive: e.alive !== false,
      facingRight: !!e.facingRight,
      onGround: !!e.onGround,
    };
  }).filter((e) => e.id);
}

function checksumEnemies(enemies: NetEnemySnapshot[]): number {
  let hash = 2166136261;
  const prime = 16777619;
  for (const enemy of enemies) {
    hash ^= enemy.id.length;
    hash = Math.imul(hash, prime);
    hash ^= enemy.type.length;
    hash = Math.imul(hash, prime);
    hash ^= Math.floor(enemy.x * 10);
    hash = Math.imul(hash, prime);
    hash ^= Math.floor(enemy.y * 10);
    hash = Math.imul(hash, prime);
    hash ^= Math.floor(enemy.vx * 10);
    hash = Math.imul(hash, prime);
    hash ^= Math.floor(enemy.vy * 10);
    hash = Math.imul(hash, prime);
    hash ^= enemy.health | 0;
    hash = Math.imul(hash, prime);
    hash ^= enemy.alive ? 1 : 0;
    hash = Math.imul(hash, prime);
    hash ^= enemy.facingRight ? 1 : 0;
    hash = Math.imul(hash, prime);
    hash ^= enemy.onGround ? 1 : 0;
    hash = Math.imul(hash, prime);
  }
  return (hash >>> 0);
}

function roomToResponse(room: ReturnType<RoomMap['get']>): NetRoomState {
  if (!room) throw new Error('missing room');
  return {
    roomId: room.id,
    seed: room.seed,
    hostId: room.hostId,
    players: Array.from(room.players.values()),
  };
}

function json(data: unknown, init?: number | ResponseInit): NextResponse {
  const response = NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function cleanupRooms(rooms: RoomMap): void {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    ensureRoomState(room);
    let hasAnyRecentActivity = false;
    for (const [pid, player] of room.players.entries()) {
      const age = now - player.updatedAt;
      if (age > PLAYER_TTL_MS) {
        room.players.delete(pid);
      } else {
        hasAnyRecentActivity = true;
      }
    }

    if (!room.players.has(room.hostId)) {
      const firstRemaining = room.players.values().next().value as NetPlayerState | undefined;
      if (firstRemaining) room.hostId = firstRemaining.id;
    }

    const emptyForTooLong = room.players.size === 0 && (now - room.createdAt) > EMPTY_ROOM_GRACE_MS;
    if (emptyForTooLong || (!hasAnyRecentActivity && (now - room.createdAt > ROOM_TTL_MS))) {
      rooms.delete(roomId);
    }
  }
}

function stepServerClock(room: NonNullable<ReturnType<RoomMap['get']>>, now: number): void {
  const server = room.server;
  const tickMs = 1000 / MP_SERVER_TICK_RATE;
  const dt = Math.max(0, now - server.lastTickAt);
  server.lastTickAt = now;
  server.tickAccumulatorMs += Math.min(250, dt);

  while (server.tickAccumulatorMs >= tickMs) {
    server.tickAccumulatorMs -= tickMs;
    server.tickCounter += 1;
  }

  const tickWindowElapsed = now - server.tickWindowStart;
  if (tickWindowElapsed >= 1000) {
    server.tickRateNow = Math.round((server.tickCounter * 1000) / tickWindowElapsed);
    server.tickCounter = 0;
    server.tickWindowStart = now;
  }

  const snapshotWindowElapsed = now - server.snapshotWindowStart;
  if (snapshotWindowElapsed >= 1000) {
    server.snapshotRateNow = Math.round((server.snapshotCounter * 1000) / snapshotWindowElapsed);
    server.snapshotCounter = 0;
    server.snapshotWindowStart = now;
  }
}

function clampSnapshotDelta(
  previous: NetPlayerSnapshot,
  incoming: NetPlayerSnapshot,
  elapsedMs: number,
): NetPlayerSnapshot {
  const elapsed = Math.max(0.016, Math.min(0.34, elapsedMs / 1000));
  const maxDx = MAX_POSITION_BURST + MAX_PLAYER_SPEED_PX_PER_SEC * elapsed;
  const maxDy = MAX_POSITION_BURST + MAX_PLAYER_FALL_SPEED_PX_PER_SEC * elapsed;
  const dx = incoming.x - previous.x;
  const dy = incoming.y - previous.y;

  // Allow large teleports occasionally (portals / scripted movement).
  const allowTeleport = Math.abs(dx) > 900 || Math.abs(dy) > 700;
  if (allowTeleport) return incoming;

  const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));
  return {
    ...incoming,
    x: previous.x + clamp(dx, maxDx),
    y: previous.y + clamp(dy, maxDy),
    vx: clamp(incoming.vx, MAX_PLAYER_SPEED_PX_PER_SEC * 1.35),
    vy: clamp(incoming.vy, MAX_PLAYER_FALL_SPEED_PX_PER_SEC),
  };
}

function updateHistory(meta: ServerPlayerMeta, snapshot: NetPlayerSnapshot, now: number): void {
  meta.history.push({ t: now, snapshot: cloneSnapshot(snapshot) });
  const cutoff = now - MP_HISTORY_BUFFER_DURATION_MS;
  while (meta.history.length > 2 && meta.history[0].t < cutoff) {
    meta.history.shift();
  }
}

/**
 * Retrieve an historical snapshot closest to client action time.
 * This keeps lag-comp data bounded and is intentionally server-only.
 */
function getSnapshotAtTime(meta: ServerPlayerMeta, at: number): NetPlayerSnapshot | null {
  if (meta.history.length === 0) return null;
  if (meta.history.length === 1) return cloneSnapshot(meta.history[0].snapshot);

  for (let i = meta.history.length - 1; i > 0; i--) {
    const newer = meta.history[i];
    const older = meta.history[i - 1];
    if (older.t <= at && newer.t >= at) {
      const span = Math.max(1, newer.t - older.t);
      const alpha = Math.max(0, Math.min(1, (at - older.t) / span));
      const lerp = (a: number, b: number) => a + (b - a) * alpha;
      return {
        ...newer.snapshot,
        x: lerp(older.snapshot.x, newer.snapshot.x),
        y: lerp(older.snapshot.y, newer.snapshot.y),
        vx: lerp(older.snapshot.vx, newer.snapshot.vx),
        vy: lerp(older.snapshot.vy, newer.snapshot.vy),
      };
    }
  }

  return cloneSnapshot(meta.history[meta.history.length - 1].snapshot);
}

function buildSyncResponse(room: NonNullable<ReturnType<RoomMap['get']>>, localPlayerId: string): NetSyncResponse {
  let remote: NetPlayerState | null = null;
  for (const p of room.players.values()) {
    if (p.id !== localPlayerId) {
      remote = p;
      break;
    }
  }
  const local = room.players.get(localPlayerId);
  const host = room.players.get(room.hostId);
  const meta = room.playerMeta.get(localPlayerId);
  const authoritativeDistance = host?.snapshot.distance ?? Math.max(0, ...Array.from(room.players.values()).map((p) => p.snapshot.distance));
  const encounterChunk = Math.max(0, Math.floor((host?.snapshot.x ?? (authoritativeDistance * 50)) / 800));
  return {
    roomId: room.id,
    seed: room.seed,
    hostId: room.hostId,
    serverTime: Date.now(),
    serverTickRate: room.server.tickRateNow || MP_SERVER_TICK_RATE,
    snapshotRate: room.server.snapshotRateNow || MP_SNAPSHOT_RATE,
    ackInputSeq: meta?.lastInputSeq ?? 0,
    local: local ? cloneSnapshot(local.snapshot) : sanitizeSnapshot(null, 'knight'),
    inferredPacketLoss: meta?.inferredLoss ?? 0,
    enemies: room.enemies,
    enemyVersion: room.enemyVersion,
    enemyChecksum: room.enemyChecksum,
    authoritativeDistance,
    encounterChunk,
    remote: remote
      ? {
        id: remote.id,
        name: remote.name,
        snapshot: remote.snapshot,
        carryTargetId: remote.carryTargetId,
        carriedById: remote.carriedById,
      }
      : null,
  };
}

function applyCarryState(room: ReturnType<RoomMap['get']>, actorId: string, targetId: string | null, dropCarry: boolean): void {
  if (!room) return;
  const actor = room.players.get(actorId);
  if (!actor) return;

  if (dropCarry) {
    if (actor.carryTargetId) {
      const target = room.players.get(actor.carryTargetId);
      if (target) target.carriedById = null;
    }
    actor.carryTargetId = null;
    return;
  }

  if (!targetId || targetId === actorId) return;
  const target = room.players.get(targetId);
  if (!target) return;
  if (target.carriedById && target.carriedById !== actorId) return;

  const dx = actor.snapshot.x - target.snapshot.x;
  const dy = actor.snapshot.y - target.snapshot.y;
  const distSq = dx * dx + dy * dy;
  if (distSq > 160 * 160) return;

  if (actor.carryTargetId && actor.carryTargetId !== targetId) {
    const old = room.players.get(actor.carryTargetId);
    if (old) old.carriedById = null;
  }

  actor.carryTargetId = targetId;
  target.carriedById = actorId;
}

function applyCarryPose(room: ReturnType<RoomMap['get']>): void {
  if (!room) return;

  for (const p of room.players.values()) {
    if (!p.carryTargetId) continue;
    const target = room.players.get(p.carryTargetId);
    if (!target) {
      p.carryTargetId = null;
      continue;
    }
    target.carriedById = p.id;

    const xOffset = p.snapshot.facingRight ? 10 : -10;
    target.snapshot.x = p.snapshot.x + xOffset;
    target.snapshot.y = p.snapshot.y - target.snapshot.height * 0.95;
    target.snapshot.vx = p.snapshot.vx;
    target.snapshot.vy = p.snapshot.vy;
    target.snapshot.onGround = false;
    target.snapshot.facingRight = p.snapshot.facingRight;
  }
}

export async function GET(request: NextRequest) {
  const rooms = getRooms();
  cleanupRooms(rooms);

  const roomId = normalizeRoomId(request.nextUrl.searchParams.get('roomId'));
  if (!roomId) {
    return json({ error: 'roomId required' }, 400);
  }

  const room = rooms.get(roomId);
  if (!room) {
    return json({ error: 'Room not found' }, 404);
  }
  ensureRoomState(room);

  return json({ room: roomToResponse(room) });
}

export async function DELETE(request: NextRequest) {
  const rooms = getRooms();
  const roomId = normalizeRoomId(request.nextUrl.searchParams.get('roomId'));
  const playerId = request.nextUrl.searchParams.get('playerId') ?? '';

  if (!roomId || !playerId) {
    return json({ error: 'roomId and playerId required' }, 400);
  }

  const room = rooms.get(roomId);
  if (!room) return json({ ok: true });
  ensureRoomState(room);

  const leaving = room.players.get(playerId);
  if (leaving?.carryTargetId) {
    const target = room.players.get(leaving.carryTargetId);
    if (target) target.carriedById = null;
  }
  for (const p of room.players.values()) {
    if (p.carryTargetId === playerId) p.carryTargetId = null;
    if (p.carriedById === playerId) p.carriedById = null;
  }

  room.players.delete(playerId);
  room.playerMeta.delete(playerId);
  if (room.players.size === 0) {
    rooms.delete(roomId);
  } else if (room.hostId === playerId) {
    const nextHost = room.players.values().next().value as NetPlayerState | undefined;
    if (nextHost) room.hostId = nextHost.id;
  }

  return json({ ok: true });
}

export async function POST(request: NextRequest) {
  const rooms = getRooms();
  cleanupRooms(rooms);

  const body = await request.json().catch(() => null) as null | {
    action?: 'create' | 'join' | 'sync';
    roomId?: string;
    playerId?: string;
    playerName?: string;
    characterId?: string;
    seed?: number;
    sync?: NetSyncPayload;
  };

  if (!body?.action) {
    return json({ error: 'action required' }, 400);
  }

  if (body.action === 'create') {
    let roomId = randomId(5);
    while (rooms.has(roomId)) roomId = randomId(5);

    const pid = playerId();
    const seed = Number.isFinite(body.seed) ? Math.floor(Number(body.seed)) : Math.floor(Math.random() * 999999);
    const now = Date.now();

    const local: NetPlayerState = {
      id: pid,
      name: sanitizeName(body.playerName ?? 'Host'),
      snapshot: sanitizeSnapshot(null, body.characterId ?? 'knight'),
      carryTargetId: null,
      carriedById: null,
      updatedAt: now,
    };

    rooms.set(roomId, {
      id: roomId,
      seed,
      hostId: pid,
      players: new Map([[pid, local]]),
      enemies: [],
      enemyVersion: 0,
      enemyChecksum: 0,
      playerMeta: new Map([[pid, { lastInputSeq: 0, inferredLoss: 0, history: [] }]]),
      server: {
        lastTickAt: now,
        tickAccumulatorMs: 0,
        tickCounter: 0,
        tickWindowStart: now,
        tickRateNow: MP_SERVER_TICK_RATE,
        lastSnapshotAt: now,
        snapshotCounter: 0,
        snapshotWindowStart: now,
        snapshotRateNow: MP_SNAPSHOT_RATE,
      },
      createdAt: now,
    });

    return json({ roomId, playerId: pid, seed, room: roomToResponse(rooms.get(roomId)) });
  }

  if (body.action === 'join') {
    const roomId = normalizeRoomId(body.roomId);
    const room = rooms.get(roomId);
    if (!room) return json({
      error: 'Room not found. Make sure both devices opened the same site URL and room code.',
    }, 404);
    ensureRoomState(room);

    if (room.players.size >= 4) {
      return json({ error: 'Room is full' }, 409);
    }

    const pid = playerId();
    const now = Date.now();
    room.players.set(pid, {
      id: pid,
      name: sanitizeName(body.playerName ?? 'Guest'),
      snapshot: sanitizeSnapshot(null, body.characterId ?? 'knight'),
      carryTargetId: null,
      carriedById: null,
      updatedAt: now,
    });
    room.playerMeta.set(pid, { lastInputSeq: 0, inferredLoss: 0, history: [] });

    return json({ roomId, playerId: pid, seed: room.seed, hostId: room.hostId, room: roomToResponse(room) });
  }

  if (body.action === 'sync') {
    const payload = body.sync;
    if (!payload?.roomId || !payload.playerId) {
      return json({ error: 'sync.roomId and sync.playerId required' }, 400);
    }

    const room = rooms.get(normalizeRoomId(payload.roomId));
    if (!room) return json({ error: 'Room not found' }, 404);
    ensureRoomState(room);
    const now = Date.now();
    stepServerClock(room, now);

    const player = room.players.get(payload.playerId);
    if (!player) return json({ error: 'Player not in room' }, 404);
    const meta = room.playerMeta.get(payload.playerId) ?? { lastInputSeq: 0, inferredLoss: 0, history: [] };
    room.playerMeta.set(payload.playerId, meta);

    if (payload.snapshot) {
      const incoming = sanitizeSnapshot(payload.snapshot, player.snapshot.characterId);
      const elapsedMs = Math.max(16, now - player.updatedAt);
      player.snapshot = clampSnapshotDelta(player.snapshot, incoming, elapsedMs);
    }
    player.updatedAt = now;

    if (payload.input) {
      const seq = Math.max(0, Math.floor(payload.input.seq));
      if (meta.lastInputSeq > 0 && seq > meta.lastInputSeq + 1) {
        meta.inferredLoss += (seq - meta.lastInputSeq - 1);
      }
      meta.lastInputSeq = Math.max(meta.lastInputSeq, seq);
      // Server-side lag-comp anchor for future hit validation work.
      void getSnapshotAtTime(meta, Math.max(0, Math.floor(payload.input.clientTime)));
    }
    updateHistory(meta, player.snapshot, now);

    applyCarryState(room, player.id, payload.carryTargetId ?? null, !!payload.dropCarry);
    applyCarryPose(room);
    if (player.id === room.hostId && payload.enemies) {
      const nextEnemies = sanitizeEnemies(payload.enemies);
      const nextChecksum = checksumEnemies(nextEnemies);
      if (
        nextEnemies.length !== room.enemies.length
        || nextChecksum !== room.enemyChecksum
      ) {
        room.enemies = nextEnemies;
        room.enemyChecksum = nextChecksum;
        room.enemyVersion += 1;
      }
    }

    if (now - room.server.lastSnapshotAt >= (1000 / MP_SNAPSHOT_RATE)) {
      room.server.lastSnapshotAt = now;
      room.server.snapshotCounter += 1;
    }

    return json({ sync: buildSyncResponse(room, player.id) });
  }

  return json({ error: 'Unsupported action' }, 400);
}
