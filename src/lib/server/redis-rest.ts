const REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
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
