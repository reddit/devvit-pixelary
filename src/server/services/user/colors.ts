import { redis } from '@devvit/web/server';
import { REDIS_KEYS } from '@server/core/redis';
import type { T2 } from '@devvit/shared-types/tid.js';
import type { HEX } from '@shared/types';

/**
 * Get the user's recent colors (newest first).
 * If none exist, seed with provided colors (kept to the provided limit).
 */
export async function getRecentColors(
  userId: T2,
  seed: readonly HEX[],
  limit: number = 7
): Promise<HEX[]> {
  // Use global Redis to persist across subreddit-less and cross-subreddit contexts
  type RedisLike = typeof redis;
  const withGlobal = redis as unknown as { global?: RedisLike };
  const r: RedisLike = withGlobal.global ?? redis;
  const key = REDIS_KEYS.userRecentColors(userId);
  // Get newest-first up to limit
  const existing = (await r.zRange(
    key as never,
    0 as never,
    (limit - 1) as never,
    {
      reverse: true,
      by: 'rank',
    } as never
  )) as Array<{ member: string; score: number }>;

  if (existing.length > 0) {
    // Filter out invalid colors (not in DRAWING_COLORS)
    const { DRAWING_COLORS } = await import('@client/constants');
    const validColorsSet = new Set(DRAWING_COLORS);
    const existingColors = existing
      .map((e) => e.member as HEX)
      .filter((c) => validColorsSet.has(c));

    // Remove invalid colors from Redis
    const invalidColors = existing
      .map((e) => e.member as HEX)
      .filter((c) => !validColorsSet.has(c));
    if (invalidColors.length > 0) {
      await r.zRem(key as never, invalidColors as never);
    }

    // If we have valid colors but fewer than expected, pad with defaults
    if (existingColors.length < limit) {
      const seedLimited = seed.slice(0, limit);
      const missing = seedLimited.filter((c) => !existingColors.includes(c));
      if (missing.length > 0) {
        // Add missing colors to Redis with scores that make them appear after existing
        const now = Date.now();
        const baseScore =
          existingColors.length > 0
            ? Math.min(...existing.map((e) => e.score)) - 1
            : now;
        await Promise.all(
          missing.map((color, idx) =>
            r.zAdd(
              key as never,
              {
                member: color as never,
                score: baseScore - idx,
              } as never
            )
          )
        );
        // Fetch again to get the complete set in correct order
        const updated = (await r.zRange(
          key as never,
          0 as never,
          (limit - 1) as never,
          {
            reverse: true,
            by: 'rank',
          } as never
        )) as Array<{ member: string; score: number }>;
        return updated
          .map((e) => e.member as HEX)
          .filter((c) => validColorsSet.has(c));
      }
    }
    // Return valid colors newest-first
    return existingColors;
  }

  // Seed with provided colors up to limit
  const seedLimited = seed.slice(0, limit);
  if (seedLimited.length > 0) {
    const now = Date.now();
    // Assign decreasing scores so the FIRST color in the seed is the most recent
    // Use independent calls for compatibility with the Redis client
    await Promise.all(
      seedLimited.map((color, idx) =>
        r.zAdd(
          key as never,
          {
            member: color as never,
            score: now - idx,
          } as never
        )
      )
    );
  }
  // Newest-first order expected by callers: reverse of the seed slice
  return seedLimited.slice().reverse();
}

/**
 * Push a color into the user's recent list (as most recent) and prune extras.
 * Non-blocking behavior should be handled by the caller (fire-and-forget).
 * Only valid colors (in DRAWING_COLORS) are stored.
 */
export async function pushRecentColor(
  userId: T2,
  color: HEX,
  limit: number = 7
): Promise<void> {
  // Validate color is in DRAWING_COLORS before storing
  const { DRAWING_COLORS } = await import('@client/constants');
  const validColorsSet = new Set(DRAWING_COLORS);
  if (!validColorsSet.has(color)) {
    // Don't store invalid colors
    return;
  }

  type RedisLike = typeof redis;
  const withGlobal = redis as unknown as { global?: RedisLike };
  const r: RedisLike = withGlobal.global ?? redis;
  const key = REDIS_KEYS.userRecentColors(userId);
  const now = Date.now();
  // Upsert with latest timestamp
  await r.zAdd(key as never, { member: color as never, score: now } as never);

  // Prune extras beyond limit (keep newest-first by rank)
  const extras = (await r.zRange(
    key as never,
    limit as never,
    -1 as never,
    {
      reverse: true,
      by: 'rank',
    } as never
  )) as Array<{ member: string; score: number }>;
  if (extras.length > 0) {
    const members = extras.map((e) => e.member);
    // Remove any beyond the limit
    await r.zRem(key as never, members as never);
  }
}
