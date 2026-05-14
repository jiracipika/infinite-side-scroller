import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type BoardScope = 'global' | 'weekly' | 'daily';

interface Entry {
  id: string;
  name: string;
  avatarId: string;
  score: number;
  distance: number;
  coins: number;
  mode: 'standard' | 'daily';
  characterId: string;
  seasonId: string;
  badge: string;
  hasReplay: boolean;
  seed: number;
  createdAt: number;
}

interface RunTokenPayload {
  playerName: string;
  avatarId: string;
  mode: 'standard' | 'daily';
  seed: number;
  issuedAt: number;
  expiresAt: number;
}

interface LeaderboardStore {
  entries: Entry[];
  replays: Record<string, Array<{ distance: number; x: number; y: number }>>;
}

declare global {
  // eslint-disable-next-line no-var
  var __issLeaderboardStore: LeaderboardStore | undefined;
  // eslint-disable-next-line no-var
  var __issLeaderboardSecret: string | undefined;
}

const MAX_ENTRIES = 600;
const MAX_SCORE_PER_SECOND = 2400;
const MAX_SPEED_PX_PER_SEC = 1200;
const MAX_REPLAY_POINTS = 1600;
const SEASON_LENGTH_DAYS = Math.max(7, Number(process.env.LEADERBOARD_SEASON_DAYS ?? 30) || 30);
const SEASON_ANCHOR_UTC = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
const AVATAR_IDS = new Set([
  'robot_blue',
  'knight',
  'alien',
  'archer',
  'healer',
  'fox',
  'owl',
  'star',
]);

function json(data: unknown, status: number = 200): NextResponse {
  const res = NextResponse.json(data, { status });
  res.headers.set('Cache-Control', 'no-store, max-age=0');
  return res;
}

function getStore(): LeaderboardStore {
  if (!global.__issLeaderboardStore) {
    global.__issLeaderboardStore = { entries: [], replays: {} };
  }
  return global.__issLeaderboardStore;
}

function getSecret(): string {
  if (global.__issLeaderboardSecret) return global.__issLeaderboardSecret;
  const base = process.env.LEADERBOARD_SECRET || `${process.env.VERCEL_URL || 'local'}:${process.pid}:${Date.now()}`;
  global.__issLeaderboardSecret = crypto.createHash('sha256').update(base).digest('hex');
  return global.__issLeaderboardSecret;
}

function scopeKey(scope: BoardScope, createdAt: number): string {
  const d = new Date(createdAt);
  if (scope === 'daily') return d.toISOString().slice(0, 10);
  if (scope === 'weekly') {
    const copy = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const day = copy.getUTCDay() || 7;
    copy.setUTCDate(copy.getUTCDate() - day + 1);
    return copy.toISOString().slice(0, 10);
  }
  return 'all';
}

function sanitizeName(name: unknown): string {
  if (typeof name !== 'string') return 'Player';
  return name.trim().replace(/\s+/g, ' ').slice(0, 20) || 'Player';
}

function sanitizeAvatarId(avatarId: unknown): string {
  if (typeof avatarId !== 'string') return 'robot_blue';
  return AVATAR_IDS.has(avatarId) ? avatarId : 'robot_blue';
}

function getSeasonMeta(ts: number = Date.now()): { id: string; label: string; startedAt: number; endsAt: number } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const seasonLengthMs = SEASON_LENGTH_DAYS * msPerDay;
  const diff = Math.max(0, ts - SEASON_ANCHOR_UTC);
  const index = Math.floor(diff / seasonLengthMs);
  const startedAt = SEASON_ANCHOR_UTC + index * seasonLengthMs;
  const endsAt = startedAt + seasonLengthMs;
  const id = `S${index + 1}`;
  const startDate = new Date(startedAt).toISOString().slice(0, 10);
  return {
    id,
    label: `${id} • ${startDate}`,
    startedAt,
    endsAt,
  };
}

function sanitizeReplayPath(input: unknown): Array<{ distance: number; x: number; y: number }> {
  if (!Array.isArray(input)) return [];
  const trimmed = input
    .slice(0, MAX_REPLAY_POINTS * 2)
    .map((point) => {
      const p = point as Partial<{ distance: number; x: number; y: number }>;
      if (!Number.isFinite(p.distance) || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
      return {
        distance: Math.max(0, Math.floor(Number(p.distance))),
        x: Number(p.x),
        y: Number(p.y),
      };
    })
    .filter((point): point is { distance: number; x: number; y: number } => !!point)
    .sort((a, b) => a.distance - b.distance);
  if (trimmed.length < 12) return [];

  const sampled: Array<{ distance: number; x: number; y: number }> = [];
  let previousDistance = -1;
  for (let i = 0; i < trimmed.length; i += 2) {
    const point = trimmed[i];
    if (!point) continue;
    if (point.distance <= previousDistance) continue;
    sampled.push(point);
    previousDistance = point.distance;
    if (sampled.length >= MAX_REPLAY_POINTS) break;
  }
  return sampled;
}

function signTokenPayload(payload: RunTokenPayload | Partial<RunTokenPayload>): string {
  const h = crypto.createHmac('sha256', getSecret());
  h.update(JSON.stringify(payload));
  return h.digest('hex');
}

function encodeToken(payload: RunTokenPayload): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = signTokenPayload(payload);
  return `${body}.${sig}`;
}

function decodeToken(token: string): RunTokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<RunTokenPayload>;
    const expected = signTokenPayload(payload);
    if (expected !== sig) return null;
    if (
      !payload
      || typeof payload !== 'object'
      || !Number.isFinite(payload.seed)
      || !Number.isFinite(payload.issuedAt)
      || !Number.isFinite(payload.expiresAt)
    ) {
      return null;
    }
    return {
      playerName: sanitizeName(payload.playerName),
      avatarId: sanitizeAvatarId(payload.avatarId),
      mode: payload.mode === 'daily' ? 'daily' : 'standard',
      seed: Math.floor(Number(payload.seed)),
      issuedAt: Number(payload.issuedAt),
      expiresAt: Number(payload.expiresAt),
    };
  } catch {
    return null;
  }
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.distance !== a.distance) return b.distance - a.distance;
    if (b.coins !== a.coins) return b.coins - a.coins;
    return a.createdAt - b.createdAt;
  });
}

function badgeForRank(rank: number): string {
  if (rank === 1) return 'Legend';
  if (rank <= 3) return 'Diamond';
  if (rank <= 10) return 'Gold';
  if (rank <= 25) return 'Silver';
  return 'Bronze';
}

function withBadges(entries: Entry[]): Entry[] {
  return entries.map((entry, idx) => ({
    ...entry,
    badge: badgeForRank(idx + 1),
  }));
}

function validateRun(params: {
  tokenPayload: RunTokenPayload;
  score: number;
  distance: number;
  coins: number;
  submittedAt: number;
  seed: number;
  mode: 'standard' | 'daily';
}): { ok: boolean; reason?: string } {
  const { tokenPayload, score, distance, coins, submittedAt, seed, mode } = params;
  if (tokenPayload.mode !== mode) return { ok: false, reason: 'mode mismatch' };
  if (tokenPayload.seed !== seed) return { ok: false, reason: 'seed mismatch' };
  if (submittedAt > tokenPayload.expiresAt + 30_000) return { ok: false, reason: 'token expired' };
  if (submittedAt < tokenPayload.issuedAt - 10_000) return { ok: false, reason: 'bad timestamp' };

  const elapsedSec = Math.max(5, Math.min(7200, (submittedAt - tokenPayload.issuedAt) / 1000));
  if (distance > elapsedSec * MAX_SPEED_PX_PER_SEC) return { ok: false, reason: 'distance too high' };
  if (score > elapsedSec * MAX_SCORE_PER_SECOND + 20_000) return { ok: false, reason: 'score too high' };
  if (coins > distance / 10 + 1200) return { ok: false, reason: 'coins too high' };
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const replayEntryId = request.nextUrl.searchParams.get('replay');
  if (replayEntryId) {
    const store = getStore();
    const entry = store.entries.find((item) => item.id === replayEntryId);
    if (!entry) return json({ error: 'replay not found' }, 404);
    const replayPath = store.replays[entry.id] ?? [];
    if (replayPath.length === 0) return json({ error: 'replay not found' }, 404);
    return json({ entry, replayPath });
  }

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'global';
  const scope: BoardScope = scopeParam === 'daily' || scopeParam === 'weekly' ? scopeParam : 'global';
  const now = Date.now();
  const key = scopeKey(scope, now);
  const limit = Math.max(1, Math.min(50, Number(request.nextUrl.searchParams.get('limit') ?? 20) || 20));
  const season = getSeasonMeta(now);

  const store = getStore();
  const seasonScoped = store.entries.filter((entry) => entry.seasonId === season.id);
  const entries = withBadges(sortEntries(
    seasonScoped.filter((entry) => {
      if (scope === 'global') return true;
      return scopeKey(scope, entry.createdAt) === key;
    }),
  )).slice(0, limit);

  return json({
    scope,
    key,
    season,
    entries,
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as null | {
    action?: 'issue-token' | 'submit';
    playerName?: string;
    avatarId?: string;
    mode?: 'standard' | 'daily';
    seed?: number;
    token?: string;
    score?: number;
    distance?: number;
    coins?: number;
    characterId?: string;
    replayPath?: Array<{ distance: number; x: number; y: number }>;
  };

  if (!body?.action) return json({ error: 'action required' }, 400);

  if (body.action === 'issue-token') {
    const mode = body.mode === 'daily' ? 'daily' : 'standard';
    const seed = Number.isFinite(body.seed) ? Math.floor(Number(body.seed)) : Math.floor(Math.random() * 999999);
    const issuedAt = Date.now();
    const expiresAt = issuedAt + 2 * 60 * 60_000;
    const payload: RunTokenPayload = {
      playerName: sanitizeName(body.playerName ?? 'Player'),
      avatarId: sanitizeAvatarId(body.avatarId),
      mode,
      seed,
      issuedAt,
      expiresAt,
    };
    return json({
      token: encodeToken(payload),
      seed,
      mode,
      expiresAt,
    });
  }

  if (body.action === 'submit') {
    const token = typeof body.token === 'string' ? body.token : '';
    const payload = decodeToken(token);
    if (!payload) return json({ error: 'invalid token' }, 401);

    const mode = body.mode === 'daily' ? 'daily' : 'standard';
    const seed = Number.isFinite(body.seed) ? Math.floor(Number(body.seed)) : payload.seed;
    const score = Number.isFinite(body.score) ? Math.max(0, Math.floor(Number(body.score))) : 0;
    const distance = Number.isFinite(body.distance) ? Math.max(0, Math.floor(Number(body.distance))) : 0;
    const coins = Number.isFinite(body.coins) ? Math.max(0, Math.floor(Number(body.coins))) : 0;
    const submittedAt = Date.now();

    const validation = validateRun({
      tokenPayload: payload,
      score,
      distance,
      coins,
      submittedAt,
      seed,
      mode,
    });
    if (!validation.ok) {
      return json({ error: `run rejected: ${validation.reason}` }, 422);
    }

    const store = getStore();
    const season = getSeasonMeta(submittedAt);
    const replayPath = sanitizeReplayPath(body.replayPath);
    const entry: Entry = {
      id: `${submittedAt}-${Math.random().toString(36).slice(2, 10)}`,
      name: sanitizeName(payload.playerName),
      avatarId: sanitizeAvatarId(payload.avatarId),
      score,
      distance,
      coins,
      mode,
      characterId: typeof body.characterId === 'string' ? body.characterId.slice(0, 24) : 'knight',
      seasonId: season.id,
      badge: 'Bronze',
      hasReplay: replayPath.length > 0,
      seed,
      createdAt: submittedAt,
    };
    store.entries.push(entry);
    if (replayPath.length > 0) {
      store.replays[entry.id] = replayPath;
    }
    if (store.entries.length > MAX_ENTRIES) {
      const kept = sortEntries(store.entries).slice(0, MAX_ENTRIES);
      const keepIds = new Set(kept.map((item) => item.id));
      store.entries = kept;
      for (const replayId of Object.keys(store.replays)) {
        if (!keepIds.has(replayId)) {
          delete store.replays[replayId];
        }
      }
    }

    return json({ ok: true, entry: { ...entry, badge: 'Bronze' } });
  }

  return json({ error: 'unsupported action' }, 400);
}
