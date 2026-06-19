import type { NetRoomState, NetSyncPayload, NetSyncResponse } from './types';

function normalizeRoomId(roomId: string): string {
  return roomId.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

async function requestJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export async function createMultiplayerRoom(params: {
  playerName: string;
  characterId: string;
  seed?: number;
}): Promise<{
  roomId: string;
  playerId: string;
  seed: number;
  room: NetRoomState;
  storeMode?: 'redis' | 'ephemeral' | 'local';
}> {
  return requestJson('/api/multiplayer/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      playerName: params.playerName,
      characterId: params.characterId,
      seed: params.seed,
    }),
  });
}

export async function joinMultiplayerRoom(params: {
  roomId: string;
  playerName: string;
  characterId: string;
}): Promise<{
  roomId: string;
  playerId: string;
  seed: number;
  room: NetRoomState;
  hostId: string;
  storeMode?: 'redis' | 'ephemeral' | 'local';
}> {
  const roomId = normalizeRoomId(params.roomId);
  let lastError: Error | null = null;

  // A newly-created room can briefly be unavailable while a serverless
  // deployment starts or routes requests across instances.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await requestJson('/api/multiplayer/room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'join',
          roomId,
          playerName: params.playerName,
          characterId: params.characterId,
        }),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unable to join room');
      if (!/room|storage|503/i.test(lastError.message) || attempt === 5) break;
      await delay(250 + attempt * 250);
    }
  }

  throw lastError ?? new Error('Unable to join room');
}

export async function syncMultiplayerRoom(
  payload: NetSyncPayload,
  options?: { signal?: AbortSignal },
): Promise<{ sync: NetSyncResponse }> {
  return requestJson('/api/multiplayer/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sync', sync: payload }),
    signal: options?.signal,
  });
}

export async function fetchMultiplayerRoom(roomId: string): Promise<{ room: NetRoomState }> {
  return requestJson(`/api/multiplayer/room?roomId=${encodeURIComponent(normalizeRoomId(roomId))}`);
}

export async function leaveMultiplayerRoom(roomId: string, playerId: string): Promise<void> {
  await requestJson(`/api/multiplayer/room?roomId=${encodeURIComponent(normalizeRoomId(roomId))}&playerId=${encodeURIComponent(playerId)}`, {
    method: 'DELETE',
  });
}

/* ── WebRTC signaling helpers ────────────────────────────────────────── */

async function signalRequest(body: Record<string, unknown>): Promise<any> {
  return requestJson('/api/multiplayer/signal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Host: publish the WebRTC SDP offer so the joiner can fetch it. */
export async function postRTCOffer(roomId: string, hostId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  await signalRequest({ action: 'offer', roomId: normalizeRoomId(roomId), hostId, sdp });
}

/** Joiner: publish the WebRTC SDP answer so the host can complete the handshake. */
export async function postRTCAnswer(roomId: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  await signalRequest({ action: 'answer', roomId: normalizeRoomId(roomId), sdp });
}

/** Poll the signaling endpoint for the current offer/answer state. */
export async function getRTCSignal(roomId: string): Promise<{
  offer: RTCSessionDescriptionInit | null;
  answer: RTCSessionDescriptionInit | null;
  hasOffer: boolean;
  hasAnswer: boolean;
}> {
  return signalRequest({ action: 'get', roomId: normalizeRoomId(roomId) });
}

/** Discard signaling data after the P2P connection is established. */
export async function clearRTCSignal(roomId: string): Promise<void> {
  await signalRequest({ action: 'clear', roomId: normalizeRoomId(roomId) }).catch(() => {});
}
