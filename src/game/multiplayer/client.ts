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

export async function createMultiplayerRoom(params: {
  playerName: string;
  characterId: string;
  seed?: number;
}): Promise<{ roomId: string; playerId: string; seed: number; room: NetRoomState }> {
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
}): Promise<{ roomId: string; playerId: string; seed: number; room: NetRoomState; hostId: string }> {
  const roomId = normalizeRoomId(params.roomId);
  return requestJson('/api/multiplayer/room', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'join',
      roomId,
      playerName: params.playerName,
      characterId: params.characterId,
    }),
  });
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
