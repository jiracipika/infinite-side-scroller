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

export interface NetInputCommand {
  seq: number;
  clientTime: number;
  dtMs: number;
  moveX: -1 | 0 | 1;
  jumpPressed: boolean;
  attackPressed: boolean;
  dashPressed: boolean;
  carryPressed: boolean;
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
  // Optional to allow command-only packets between keyframes.
  snapshot?: NetPlayerSnapshot;
  input?: NetInputCommand;
  carryTargetId?: string | null;
  dropCarry?: boolean;
}

export interface NetSyncResponse {
  roomId: string;
  seed: number;
  hostId: string;
  serverTime: number;
  serverTickRate: number;
  snapshotRate: number;
  ackInputSeq: number;
  local: NetPlayerSnapshot;
  inferredPacketLoss: number;
  remote: {
    id: string;
    name: string;
    snapshot: NetPlayerSnapshot;
    carryTargetId: string | null;
    carriedById: string | null;
  } | null;
}
