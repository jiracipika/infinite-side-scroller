export type OnlineBoardScope = 'global' | 'weekly' | 'daily';
export type RunMode = 'standard' | 'daily';

export interface OnlineEntry {
  id: string;
  name: string;
  avatarId: string;
  score: number;
  distance: number;
  coins: number;
  mode: RunMode;
  characterId: string;
  seasonId: string;
  badge: string;
  hasReplay: boolean;
  seed: number;
  createdAt: number;
}

export interface OnlineBoardResponse {
  scope: OnlineBoardScope;
  key: string;
  season: {
    id: string;
    label: string;
    startedAt: number;
    endsAt: number;
  };
  entries: OnlineEntry[];
}

export interface RunTokenIssueResponse {
  token: string;
  seed: number;
  mode: RunMode;
  expiresAt: number;
}

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function fetchOnlineLeaderboard(scope: OnlineBoardScope, limit: number = 20): Promise<OnlineBoardResponse> {
  const res = await fetch(`/api/leaderboard?scope=${scope}&limit=${Math.max(1, Math.min(50, limit))}`, {
    method: 'GET',
    cache: 'no-store',
  });
  return asJson<OnlineBoardResponse>(res);
}

export async function issueRunToken(input: { playerName: string; avatarId?: string; mode: RunMode; seed: number }): Promise<RunTokenIssueResponse> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      action: 'issue-token',
      playerName: input.playerName,
      mode: input.mode,
      seed: input.seed,
      avatarId: input.avatarId,
    }),
  });
  return asJson<RunTokenIssueResponse>(res);
}

export async function submitRunScore(input: {
  token: string;
  mode: RunMode;
  seed: number;
  score: number;
  distance: number;
  coins: number;
  characterId: string;
  replayPath?: Array<{ distance: number; x: number; y: number }>;
}): Promise<{ ok: true }> {
  const res = await fetch('/api/leaderboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({
      action: 'submit',
      token: input.token,
      mode: input.mode,
      seed: input.seed,
      score: input.score,
      distance: input.distance,
      coins: input.coins,
      characterId: input.characterId,
      replayPath: input.replayPath,
    }),
  });
  return asJson<{ ok: true }>(res);
}

export interface OnlineReplayResponse {
  entry: OnlineEntry;
  replayPath: Array<{ distance: number; x: number; y: number }>;
}

export async function fetchOnlineReplay(entryId: string): Promise<OnlineReplayResponse> {
  const res = await fetch(`/api/leaderboard?replay=${encodeURIComponent(entryId)}`, {
    method: 'GET',
    cache: 'no-store',
  });
  return asJson<OnlineReplayResponse>(res);
}
