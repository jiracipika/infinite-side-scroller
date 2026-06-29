import { NextRequest, NextResponse } from 'next/server';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { hasSharedRedis, multiplayerStoreMode, redisCommand } from '@/lib/server/redis-rest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * WebRTC signaling store — holds SDP offer/answer + ICE candidates for each
 * room during the brief P2P handshake. Uses Upstash Redis / Vercel KV when
 * configured so host and guest can land on different serverless instances and
 * still complete the handshake. Local dev falls back to a small /tmp JSON
 * file + memory.
 *
 * Trickle ICE: candidates are accumulated per-role (host/joiner). The 'get'
 * action returns the latest candidate arrays along with a version counter so
 * clients can poll for new candidates after the SDP exchange completes.
 */

interface SignalEntry {
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  hostId: string;
  hostCandidates: RTCIceCandidateInit[];
  joinerCandidates: RTCIceCandidateInit[];
  candidatesVersion: number; // bumped whenever candidates change
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __issRtcSignals: Map<string, SignalEntry> | undefined;
}

const SIGNAL_TTL_MS = 60_000;
const SIGNAL_KEY_PREFIX = 'dashverse:multiplayer:signal:';
const SIGNAL_STORE_DIR = join(tmpdir(), 'dashverse-multiplayer');
const SIGNAL_STORE_FILE = join(SIGNAL_STORE_DIR, 'rtc-signals.json');

function hydrateStore(raw: unknown): Map<string, SignalEntry> {
  const store = new Map<string, SignalEntry>();
  if (!Array.isArray(raw)) return store;
  for (const item of raw) {
    if (!Array.isArray(item) || item.length !== 2) continue;
    const [roomId, entry] = item as [unknown, Partial<SignalEntry>];
    if (typeof roomId !== 'string' || !entry) continue;
    store.set(roomId, {
      offer: entry.offer ?? null,
      answer: entry.answer ?? null,
      hostId: typeof entry.hostId === 'string' ? entry.hostId : '',
      hostCandidates: Array.isArray(entry.hostCandidates) ? entry.hostCandidates : [],
      joinerCandidates: Array.isArray(entry.joinerCandidates) ? entry.joinerCandidates : [],
      candidatesVersion: Number.isFinite(entry.candidatesVersion) ? Number(entry.candidatesVersion) : 0,
      createdAt: Number.isFinite(entry.createdAt) ? Number(entry.createdAt) : Date.now(),
    });
  }
  return store;
}

function serializeStore(store: Map<string, SignalEntry>): Array<[string, SignalEntry]> {
  return Array.from(store.entries());
}

function readFileStore(): Map<string, SignalEntry> | null {
  try {
    return hydrateStore(JSON.parse(readFileSync(SIGNAL_STORE_FILE, 'utf8')));
  } catch {
    return null;
  }
}

function writeFileStore(store: Map<string, SignalEntry>): void {
  try {
    mkdirSync(SIGNAL_STORE_DIR, { recursive: true });
    writeFileSync(SIGNAL_STORE_FILE, JSON.stringify(serializeStore(store)), 'utf8');
  } catch {
    // Memory fallback is still enough for same-process local dev.
  }
}

function getLocalStore(): Map<string, SignalEntry> {
  const fileStore = readFileStore();
  global.__issRtcSignals = fileStore ?? global.__issRtcSignals ?? new Map();
  return global.__issRtcSignals;
}

function cleanupLocalStore(store: Map<string, SignalEntry>): void {
  const now = Date.now();
  let changed = false;
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt > SIGNAL_TTL_MS) {
      store.delete(key);
      changed = true;
    }
  }
  if (changed) writeFileStore(store);
}

async function loadEntry(roomId: string): Promise<SignalEntry | null> {
  if (hasSharedRedis) {
    const raw = await redisCommand<string | null>(['GET', `${SIGNAL_KEY_PREFIX}${roomId}`]);
    if (raw) {
      try {
        return JSON.parse(raw) as SignalEntry;
      } catch {
        // Fall through to the local store.
      }
    }
  }
  const store = getLocalStore();
  cleanupLocalStore(store);
  return store.get(roomId) ?? null;
}

async function saveEntry(roomId: string, entry: SignalEntry): Promise<void> {
  if (hasSharedRedis) {
    const saved = await redisCommand<string>([
      'SET',
      `${SIGNAL_KEY_PREFIX}${roomId}`,
      JSON.stringify(entry),
      'EX',
      String(Math.ceil(SIGNAL_TTL_MS / 1000)),
    ]);
    if (saved) return;
  }
  const store = getLocalStore();
  cleanupLocalStore(store);
  store.set(roomId, entry);
  writeFileStore(store);
}

async function deleteEntry(roomId: string): Promise<void> {
  if (hasSharedRedis) {
    await redisCommand<number>(['DEL', `${SIGNAL_KEY_PREFIX}${roomId}`]);
  }
  const store = getLocalStore();
  store.delete(roomId);
  writeFileStore(store);
}

function json(data: unknown, init?: number | ResponseInit): NextResponse {
  const response = NextResponse.json(data, typeof init === 'number' ? { status: init } : init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

/**
 * POST — submit or retrieve signaling data.
 *
 * Body actions:
 *   { action: 'offer',      roomId, hostId, sdp }                — host posts its offer
 *   { action: 'answer',     roomId, sdp }                        — joiner posts its answer
 *   { action: 'candidates', roomId, role, candidates }           — trickle ICE candidates
 *   { action: 'get',        roomId }                             — poll for offer/answer/candidates
 *   { action: 'clear',      roomId }                             — discard after connected
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as null | {
    action?: string;
    roomId?: string;
    hostId?: string;
    sdp?: RTCSessionDescriptionInit;
    role?: string;
    candidates?: RTCIceCandidateInit[];
  };

  if (!body?.action) return json({ error: 'action required' }, 400);

  const roomId = (body.roomId ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!roomId) return json({ error: 'roomId required' }, 400);

  switch (body.action) {
    case 'offer': {
      await saveEntry(roomId, {
        offer: body.sdp ?? null,
        answer: null,
        hostId: body.hostId ?? '',
        hostCandidates: [],
        joinerCandidates: [],
        candidatesVersion: 0,
        createdAt: Date.now(),
      });
      return json({ ok: true, storeMode: multiplayerStoreMode() });
    }
    case 'answer': {
      const entry = await loadEntry(roomId);
      if (!entry) return json({ error: 'No offer for this room yet' }, 404);
      entry.answer = body.sdp ?? null;
      await saveEntry(roomId, entry);
      return json({ ok: true, storeMode: multiplayerStoreMode() });
    }
    case 'candidates': {
      const entry = await loadEntry(roomId);
      if (!entry) {
        // Create a minimal entry if missing — candidates can arrive before
        // the SDP on some networks.
        return json({ ok: true, storeMode: multiplayerStoreMode() });
      }
      const incoming = Array.isArray(body.candidates) ? body.candidates : [];
      if (body.role === 'host') {
        entry.hostCandidates = [...entry.hostCandidates, ...incoming];
      } else {
        entry.joinerCandidates = [...entry.joinerCandidates, ...incoming];
      }
      entry.candidatesVersion = (entry.candidatesVersion ?? 0) + 1;
      await saveEntry(roomId, entry);
      return json({ ok: true, storeMode: multiplayerStoreMode() });
    }
    case 'get': {
      const entry = await loadEntry(roomId);
      return json({
        offer: entry?.offer ?? null,
        answer: entry?.answer ?? null,
        hasOffer: !!entry?.offer,
        hasAnswer: !!entry?.answer,
        hostCandidates: entry?.hostCandidates ?? [],
        joinerCandidates: entry?.joinerCandidates ?? [],
        candidatesVersion: entry?.candidatesVersion ?? 0,
        storeMode: multiplayerStoreMode(),
      });
    }
    case 'clear': {
      await deleteEntry(roomId);
      return json({ ok: true, storeMode: multiplayerStoreMode() });
    }
    default:
      return json({ error: 'unknown action' }, 400);
  }
}
