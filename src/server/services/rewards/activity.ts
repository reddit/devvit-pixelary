import { redis } from '@devvit/web/server';
import type { T2 } from '@devvit/shared-types/tid.js';
import { REDIS_KEYS } from '@server/core/redis';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type ActivityBonus = {
  postsLast7d: number;
  qualifies: boolean;
  extraDrawingTimeSeconds: number;
};

/**
 * Count a user's posts (drawings) in the last 7 days using the zset of user drawings
 */
export async function countUserPostsLast7d(
  userId: T2,
  now: number = Date.now()
): Promise<number> {
  const startScore = now - SEVEN_DAYS_MS;
  const key = REDIS_KEYS.userDrawings(userId);
  try {
    // Use zCount if available; otherwise fetch range and get length
    const count = await redis.zCount(key, startScore, now);
    return typeof count === 'number' ? count : 0;
  } catch {
    try {
      const items = await redis.zRange(key, 0, -1, { by: 'rank' });
      const filtered = items.filter((entry) => entry.score >= startScore);
      return filtered.length;
    } catch {
      return 0;
    }
  }
}

/**
 * Compute activity-based drawing time bonus.
 * Current rule: if posts_last_7d >= 10 then +20 seconds.
 */
export async function getActivityDrawingTimeBonus(
  userId: T2
): Promise<ActivityBonus> {
  const postsLast7d = await countUserPostsLast7d(userId);
  const qualifies = postsLast7d >= 10;
  return {
    postsLast7d,
    qualifies,
    extraDrawingTimeSeconds: qualifies ? 20 : 0,
  };
}
