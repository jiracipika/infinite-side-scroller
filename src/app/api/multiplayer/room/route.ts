import { NextRequest, NextResponse } from 'next/server';
import type { NetPlayerSnapshot, NetPlayerState, NetRoomState, NetSyncPayload } from '@/game/multiplayer/types';

type RoomMap = Map<string, {
  id: string;
  seed: number;
  hostId: string;
  players: Map<string, NetPlayerState>;
  createdAt: number;
}>;

const PLAYER_TTL_MS = 30_000;
const ROOM_TTL_MS = 20 * 60_000;

declare global {
  // eslint-disable-next-line no-var
  var __infiniteMpRooms: RoomMap | undefined;
}

function getRooms(): RoomMap {
  if (!global.__infiniteMpRooms) global.__infiniteMpRooms = new Map();
  return global.__infiniteMpRooms;
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

function roomToResponse(room: ReturnType<RoomMap['get']>): NetRoomState {
  if (!room) throw new Error('missing room');
  return {
    roomId: room.id,
    seed: room.seed,
    hostId: room.hostId,
    players: Array.from(room.players.values()),
  };
}

function cleanupRooms(rooms: RoomMap): void {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    for (const [pid, player] of room.players.entries()) {
      if (now - player.updatedAt > PLAYER_TTL_MS) room.players.delete(pid);
    }

    if (!room.players.has(room.hostId)) {
      const firstRemaining = room.players.values().next().value as NetPlayerState | undefined;
      if (firstRemaining) room.hostId = firstRemaining.id;
    }

    if (room.players.size === 0 || now - room.createdAt > ROOM_TTL_MS) {
      rooms.delete(roomId);
    }
  }
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

  const roomId = request.nextUrl.searchParams.get('roomId')?.toUpperCase();
  if (!roomId) {
    return NextResponse.json({ error: 'roomId required' }, { status: 400 });
  }

  const room = rooms.get(roomId);
  if (!room) {
    return NextResponse.json({ error: 'Room not found' }, { status: 404 });
  }

  return NextResponse.json({ room: roomToResponse(room) });
}

export async function DELETE(request: NextRequest) {
  const rooms = getRooms();
  const roomId = request.nextUrl.searchParams.get('roomId')?.toUpperCase();
  const playerId = request.nextUrl.searchParams.get('playerId') ?? '';

  if (!roomId || !playerId) {
    return NextResponse.json({ error: 'roomId and playerId required' }, { status: 400 });
  }

  const room = rooms.get(roomId);
  if (!room) return NextResponse.json({ ok: true });

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
  if (room.players.size === 0) {
    rooms.delete(roomId);
  } else if (room.hostId === playerId) {
    room.hostId = room.players.values().next().value.id;
  }

  return NextResponse.json({ ok: true });
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
    return NextResponse.json({ error: 'action required' }, { status: 400 });
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
      createdAt: now,
    });

    return NextResponse.json({ roomId, playerId: pid, seed, room: roomToResponse(rooms.get(roomId)) });
  }

  if (body.action === 'join') {
    const roomId = (body.roomId ?? '').toUpperCase();
    const room = rooms.get(roomId);
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    if (room.players.size >= 4) {
      return NextResponse.json({ error: 'Room is full' }, { status: 409 });
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

    return NextResponse.json({ roomId, playerId: pid, seed: room.seed, hostId: room.hostId, room: roomToResponse(room) });
  }

  if (body.action === 'sync') {
    const payload = body.sync;
    if (!payload?.roomId || !payload.playerId) {
      return NextResponse.json({ error: 'sync.roomId and sync.playerId required' }, { status: 400 });
    }

    const room = rooms.get(payload.roomId.toUpperCase());
    if (!room) return NextResponse.json({ error: 'Room not found' }, { status: 404 });

    const player = room.players.get(payload.playerId);
    if (!player) return NextResponse.json({ error: 'Player not in room' }, { status: 404 });

    player.snapshot = sanitizeSnapshot(payload.snapshot, player.snapshot.characterId);
    player.updatedAt = Date.now();

    applyCarryState(room, player.id, payload.carryTargetId ?? null, !!payload.dropCarry);
    applyCarryPose(room);

    return NextResponse.json({ room: roomToResponse(room) });
  }

  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
}
