import Redis from "ioredis";

import { LEADERBOARD_CACHE_TTL_SECONDS } from "@/lib/constants";

const globalForRedis = globalThis as unknown as { redis?: Redis | null };

function createClient(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  const client = new Redis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: 2000,
    retryStrategy: () => null,
  });
  client.on("error", () => {
    // The board still works when the cache is down. Rankings are calculated from the database.
  });
  return client;
}

export function getRedis(): Redis | null {
  if (globalForRedis.redis !== undefined) return globalForRedis.redis;
  const client = createClient();
  globalForRedis.redis = client;
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", LEADERBOARD_CACHE_TTL_SECONDS);
  } catch {
    // Cache writes are optional.
  }
}

export async function invalidateLeaderboardCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    let cursor = "0";
    do {
      const [next, keys] = await redis.scan(cursor, "MATCH", "leaderboard:*", "COUNT", 100);
      cursor = next;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== "0");
  } catch {
    // A missed invalidation expires on its own after 15 minutes.
  }
}
