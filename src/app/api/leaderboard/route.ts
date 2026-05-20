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
  usedTokenDigests: Record<string, number>;
  issueRateByIp: Record<string, number[]>;
  submitRateByIp: Record<string, number[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __issLeaderboardStore: LeaderboardStore | undefined;
  // eslint-disable-next-line no-var
  var __issLeaderboardSecret: string | undefined;
}

const MAX_ENTRIES = 600;
const MAX_ENTRIES_PER_SEASON = 220;
const MAX_SEASONS_STORED = 8;
const MAX_SCORE_PER_SECOND = 2400;
const MAX_SPEED_PX_PER_SEC = 1200;
const MAX_REPLAY_POINTS = 1600;
const MAX_SCORE = 20_000_000;
const MAX_DISTANCE = 2_000_000;
const MAX_COINS = 250_000;
const SEASON_LENGTH_DAYS = Math.max(7, Number(process.env.LEADERBOARD_SEASON_DAYS ?? 30) || 30);
const SEASON_ANCHOR_UTC = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
const RATE_WINDOW_MS = 60_000;
const MAX_ISSUE_TOKEN_PER_MINUTE = 45;
const MAX_SUBMIT_PER_MINUTE = 75;
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
    global.__issLeaderboardStore = {
      entries: [],
      replays: {},
      usedTokenDigests: {},
      issueRateByIp: {},
      submitRateByIp: {},
    };
  }
  return global.__issLeaderboardStore;
}

function getClientIp(request: NextRequest): string {
  const viaForwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const viaRealIp = request.headers.get('x-real-ip')?.trim();
  const raw = viaForwarded || viaRealIp || 'local';
  return raw.slice(0, 64);
}

function checkRateLimit(buckets: Record<string, number[]>, key: string, limit: number, now: number): boolean {
  const next = (buckets[key] ?? []).filter((ts) => now - ts <= RATE_WINDOW_MS);
  if (next.length >= limit) {
    buckets[key] = next;
    return false;
  }
  next.push(now);
  buckets[key] = next;
  return true;
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

function seasonIndexFromId(seasonId: string): number | null {
  const match = /^S(\d+)$/.exec(seasonId);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : null;
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

function getSeasonMetaFromId(seasonId: string): { id: string; label: string; startedAt: number; endsAt: number } | null {
  const index = seasonIndexFromId(seasonId);
  if (index === null) return null;
  const msPerDay = 24 * 60 * 60 * 1000;
  const seasonLengthMs = SEASON_LENGTH_DAYS * msPerDay;
  const startedAt = SEASON_ANCHOR_UTC + index * seasonLengthMs;
  const endsAt = startedAt + seasonLengthMs;
  const startDate = new Date(startedAt).toISOString().slice(0, 10);
  return {
    id: `S${index + 1}`,
    label: `S${index + 1} • ${startDate}`,
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

function tokenDigest(token: string): string {
  return crypto.createHash('sha1').update(token).digest('hex');
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

function withUniqueDisplayNames(entries: Entry[]): Entry[] {
  const counts = new Map<string, number>();
  return entries.map((entry) => {
    const key = entry.name.trim().toLowerCase();
    const next = (counts.get(key) ?? 0) + 1;
    counts.set(key, next);
    if (next <= 1) return entry;
    return { ...entry, name: `${entry.name} #${next}` };
  });
}

function pruneStore(store: LeaderboardStore, now: number): void {
  const currentSeason = getSeasonMeta(now).id;
  const seasonIds = Array.from(new Set(store.entries.map((entry) => entry.seasonId)))
    .sort((a, b) => (seasonIndexFromId(b) ?? 0) - (seasonIndexFromId(a) ?? 0))
    .slice(0, MAX_SEASONS_STORED);

  if (!seasonIds.includes(currentSeason)) {
    seasonIds.unshift(currentSeason);
  }

  const kept: Entry[] = [];
  for (const seasonId of seasonIds) {
    const budget = seasonId === currentSeason ? MAX_ENTRIES_PER_SEASON : Math.floor(MAX_ENTRIES_PER_SEASON * 0.75);
    const top = sortEntries(store.entries.filter((entry) => entry.seasonId === seasonId)).slice(0, budget);
    kept.push(...top);
  }

  const hardCap = sortEntries(kept).slice(0, MAX_ENTRIES);
  const keepIds = new Set(hardCap.map((entry) => entry.id));
  store.entries = hardCap;
  for (const replayId of Object.keys(store.replays)) {
    if (!keepIds.has(replayId)) delete store.replays[replayId];
  }

  const tokenCutoff = now - (3 * 24 * 60 * 60_000);
  for (const [digest, usedAt] of Object.entries(store.usedTokenDigests)) {
    if (usedAt < tokenCutoff) delete store.usedTokenDigests[digest];
  }

  for (const [ip, stamps] of Object.entries(store.issueRateByIp)) {
    const fresh = stamps.filter((ts) => now - ts <= RATE_WINDOW_MS);
    if (fresh.length === 0) delete store.issueRateByIp[ip];
    else store.issueRateByIp[ip] = fresh;
  }
  for (const [ip, stamps] of Object.entries(store.submitRateByIp)) {
    const fresh = stamps.filter((ts) => now - ts <= RATE_WINDOW_MS);
    if (fresh.length === 0) delete store.submitRateByIp[ip];
    else store.submitRateByIp[ip] = fresh;
  }
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
  if (score > MAX_SCORE || distance > MAX_DISTANCE || coins > MAX_COINS) {
    return { ok: false, reason: 'value out of range' };
  }

  const elapsedSec = Math.max(5, Math.min(7200, (submittedAt - tokenPayload.issuedAt) / 1000));
  if (distance > elapsedSec * MAX_SPEED_PX_PER_SEC) return { ok: false, reason: 'distance too high' };
  if (score > elapsedSec * MAX_SCORE_PER_SECOND + 20_000) return { ok: false, reason: 'score too high' };
  if (coins > distance / 10 + 1200) return { ok: false, reason: 'coins too high' };
  return { ok: true };
}

export async function GET(request: NextRequest) {
  const store = getStore();
  pruneStore(store, Date.now());

  const replayEntryId = request.nextUrl.searchParams.get('replay');
  if (replayEntryId) {
    const entry = store.entries.find((item) => item.id === replayEntryId);
    if (!entry) return json({ error: 'replay not found' }, 404);
    const replayPath = store.replays[entry.id] ?? [];
    if (replayPath.length === 0) return json({ error: 'replay not found' }, 404);
    return json({ entry, replayPath });
  }

  const scopeParam = request.nextUrl.searchParams.get('scope') ?? 'global';
  const scope: BoardScope = scopeParam === 'daily' || scopeParam === 'weekly' ? scopeParam : 'global';
  const now = Date.now();
  const requestedSeasonId = (request.nextUrl.searchParams.get('season') ?? '').toUpperCase().trim();
  const requestedSeason = getSeasonMetaFromId(requestedSeasonId);
  const key = scopeKey(scope, now);
  const limit = Math.max(1, Math.min(50, Number(request.nextUrl.searchParams.get('limit') ?? 20) || 20));
  const season = requestedSeason ?? getSeasonMeta(now);

  const seasonScoped = store.entries.filter((entry) => entry.seasonId === season.id);
  const entries = withUniqueDisplayNames(withBadges(sortEntries(
    seasonScoped.filter((entry) => {
      if (scope === 'global') return true;
      return scopeKey(scope, entry.createdAt) === key;
    }),
  ))).slice(0, limit);

  const availableSeasons = Array.from(new Set(store.entries.map((entry) => entry.seasonId)))
    .map((seasonId) => getSeasonMetaFromId(seasonId))
    .filter((meta): meta is NonNullable<typeof meta> => !!meta)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, MAX_SEASONS_STORED);

  return json({
    scope,
    key,
    season,
    availableSeasons,
    entries,
  });
}

export async function POST(request: NextRequest) {
  const now = Date.now();
  const store = getStore();
  const ip = getClientIp(request);

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
    if (!checkRateLimit(store.issueRateByIp, ip, MAX_ISSUE_TOKEN_PER_MINUTE, now)) {
      return json({ error: 'rate limited: too many token requests' }, 429);
    }

    const mode = body.mode === 'daily' ? 'daily' : 'standard';
    const seed = Number.isFinite(body.seed) ? Math.floor(Number(body.seed)) : Math.floor(Math.random() * 999999);
    const issuedAt = now;
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
    if (!checkRateLimit(store.submitRateByIp, ip, MAX_SUBMIT_PER_MINUTE, now)) {
      return json({ error: 'rate limited: too many submissions' }, 429);
    }

    const token = typeof body.token === 'string' ? body.token : '';
    const payload = decodeToken(token);
    if (!payload) return json({ error: 'invalid token' }, 401);
    const digest = tokenDigest(token);
    if (store.usedTokenDigests[digest]) return json({ error: 'run token already used' }, 409);

    const mode = body.mode === 'daily' ? 'daily' : 'standard';
    const seed = Number.isFinite(body.seed) ? Math.floor(Number(body.seed)) : payload.seed;
    const score = Number.isFinite(body.score) ? Math.max(0, Math.floor(Number(body.score))) : 0;
    const distance = Number.isFinite(body.distance) ? Math.max(0, Math.floor(Number(body.distance))) : 0;
    const coins = Number.isFinite(body.coins) ? Math.max(0, Math.floor(Number(body.coins))) : 0;
    const submittedAt = now;

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
    store.usedTokenDigests[digest] = submittedAt;
    if (replayPath.length > 0) {
      store.replays[entry.id] = replayPath;
    }
    pruneStore(store, submittedAt);

    return json({ ok: true, entry: { ...entry, badge: 'Bronze' } });
  }

  return json({ error: 'unsupported action' }, 400);
}
