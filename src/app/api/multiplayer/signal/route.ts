import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * WebRTC signaling store — holds SDP offer/answer for each room during the
 * brief P2P handshake. Once the data channel opens this data is discarded.
 *
 * Kept separate from the game room store to avoid touching the complex
 * authoritative server logic in room/route.ts.
 */

interface SignalEntry {
  offer: any | null; // RTCSessionDescriptionInit
  answer: any | null; // RTCSessionDescriptionInit
  hostId: string;
  createdAt: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __issRtcSignals: Map<string, SignalEntry> | undefined;
}

function getStore(): Map<string, SignalEntry> {
  if (!global.__issRtcSignals) global.__issRtcSignals = new Map();
  return global.__issRtcSignals;
}

const SIGNAL_TTL_MS = 60_000;

function cleanup(): void {
  const store = getStore();
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt > SIGNAL_TTL_MS) store.delete(key);
  }
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
 *   { action: 'offer',  roomId, hostId, sdp }     — host posts its offer
 *   { action: 'answer', roomId, sdp }             — joiner posts its answer
 *   { action: 'get',    roomId }                  — poll for offer/answer
 *   { action: 'clear',  roomId }                  — discard after connected
 */
export async function POST(request: NextRequest) {
  cleanup();
  const store = getStore();
  const body = await request.json().catch(() => null) as null | {
    action?: string;
    roomId?: string;
    hostId?: string;
    sdp?: any;
  };

  if (!body?.action) return json({ error: 'action required' }, 400);

  const roomId = (body.roomId ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  if (!roomId) return json({ error: 'roomId required' }, 400);

  switch (body.action) {
    case 'offer': {
      store.set(roomId, {
        offer: body.sdp ?? null,
        answer: null,
        hostId: body.hostId ?? '',
        createdAt: Date.now(),
      });
      return json({ ok: true });
    }
    case 'answer': {
      const entry = store.get(roomId);
      if (!entry) return json({ error: 'No offer for this room yet' }, 404);
      entry.answer = body.sdp ?? null;
      return json({ ok: true });
    }
    case 'get': {
      const entry = store.get(roomId);
      return json({
        offer: entry?.offer ?? null,
        answer: entry?.answer ?? null,
        hasOffer: !!entry?.offer,
        hasAnswer: !!entry?.answer,
      });
    }
    case 'clear': {
      store.delete(roomId);
      return json({ ok: true });
    }
    default:
      return json({ error: 'unknown action' }, 400);
  }
}
