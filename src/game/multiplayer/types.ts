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

export interface NetEnemySnapshot {
  id: string;
  type: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  health: number;
  alive: boolean;
  facingRight: boolean;
  onGround: boolean;
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
  // Session metadata lets the server repair an active room if a serverless
  // instance loses in-memory state between sync calls.
  playerName?: string;
  hostId?: string;
  seed?: number;
  characterId?: string;
  // Optional to allow command-only packets between keyframes.
  snapshot?: NetPlayerSnapshot;
  input?: NetInputCommand;
  enemies?: NetEnemySnapshot[];
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
  enemies: NetEnemySnapshot[];
  enemyVersion: number;
  enemyChecksum: number;
  authoritativeDistance: number;
  encounterChunk: number;
  remote: {
    id: string;
    name: string;
    snapshot: NetPlayerSnapshot;
    carryTargetId: string | null;
    carriedById: string | null;
  } | null;
}
