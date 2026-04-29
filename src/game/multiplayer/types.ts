export interface NetPlayerSnapshot {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingRight: boolean;
  onGround: boolean;
  health: number;
  maxHealth: number;
  characterId: string;
  width: number;
  height: number;
  distance: number;
}

export interface NetPlayerState {
  id: string;
  name: string;
  snapshot: NetPlayerSnapshot;
  carryTargetId: string | null;
  carriedById: string | null;
  updatedAt: number;
}

export interface NetRoomState {
  roomId: string;
  seed: number;
  hostId: string;
  players: NetPlayerState[];
}

export interface NetSyncPayload {
  roomId: string;
  playerId: string;
  snapshot: NetPlayerSnapshot;
  carryTargetId?: string | null;
  dropCarry?: boolean;
}
