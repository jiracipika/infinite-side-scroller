/**
 * Fail-closed URL gate for the Redis REST endpoint. The URL comes from
 * deployment env config, not user input, but validating it keeps a
 * misconfigured (or tampered) env from turning redisCommand() into an
 * arbitrary-origin fetch: https only, no credentials inline, no leftovers.
 */
function safeRedisUrl(raw: string): string | null {
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

const REDIS_REST_URL = safeRedisUrl(
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
) ?? '';
const REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';

export const hasSharedRedis = Boolean(REDIS_REST_URL && REDIS_REST_TOKEN);

export async function redisCommand<T>(command: unknown[]): Promise<T | null> {
  if (!hasSharedRedis) return null;

  try {
    const response = await fetch(REDIS_REST_URL.replace(/\/$/, ''), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${REDIS_REST_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const data = await response.json().catch(() => null) as { result?: T } | null;
    return data?.result ?? null;
  } catch {
    return null;
  }
}

export function multiplayerStoreMode(): 'redis' | 'ephemeral' | 'local' {
  if (hasSharedRedis) return 'redis';
  if (process.env.VERCEL) return 'ephemeral';
  return 'local';
}
