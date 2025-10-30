import { redis, scheduler, context, realtime } from '@devvit/web/server';
import { getUsername, REDIS_KEYS } from '../core/redis';
import { getLevelByScore as getLevelByScoreUtil } from '@shared/utils/progression';
import type { T2 } from '@devvit/shared-types/tid.js';
import type { Level } from '@shared/types';

/**
 * Leaderboard and scoring service for Pixelary
 * Handles user scores, levels, and leaderboard operations
 */

/**
 * Get the leaderboard
 * @param limit - The number of entries to return
 * @returns The leaderboard entries
 */

export async function getLeaderboard(options?: {
  cursor?: number;
  limit?: number;
  reverse?: boolean;
  by?: 'rank' | 'score' | 'lex';
}): Promise<{
  entries: Array<{
    username: string;
    userId: T2;
    score: number;
    rank: number;
  }>;
  nextCursor: number;
}> {
  const { cursor = 0, limit = 10, reverse = true, by = 'rank' } = options ?? {};

  // Fetch from Redis
  const entries = (await redis.zRange(
    REDIS_KEYS.scores(),
    cursor,
    cursor + limit - 1,
    { reverse, by }
  )) as { member: T2; score: number }[];

  // Hydrate with usernames (getUsername is already cached for 30 days)
  const data = await Promise.all(
    entries.map(async (entry, index) => {
      const username = await getUsername(entry.member);
      return {
        username: username ?? 'Unknown',
        userId: entry.member,
        score: entry.score,
        rank: cursor + index + 1,
      };
    })
  );

  return {
    entries: data,
    nextCursor: data.length === limit ? cursor + limit : -1,
  };
}

/**
 * Get the score for a user
 * @param userId - The user ID
 * @returns The user score
 */

export async function getScore(userId: T2): Promise<number> {
  const key = REDIS_KEYS.scores();
  const score = await redis.zScore(key, userId);
  return score ?? 0; // Default to 0 if user not found
}

/**
 * Set the exact score for a user
 * @param userId - The user ID
 * @param score - The exact score to set
 * @returns The score that was set
 */

export async function setScore(userId: T2, score: number): Promise<number> {
  const key = REDIS_KEYS.scores();
  const oldScore = await getScore(userId);
  await redis.zAdd(key, { member: userId, score });
  const level = getLevelByScore(score);
  const oldLevel = getLevelByScore(oldScore);

  // Update claimed level if user leveled up
  if (level.rank > oldLevel.rank) {
    // Keep the old claimed level so the modal will show
    // Don't update it here - let the user claim the new level
  } else {
    // User stayed at same level or went down, update claimed level to match
    const newClaimedKey = REDIS_KEYS.userLevelUpClaim(userId);
    await redis.set(newClaimedKey, level.rank.toString());
  }

  const didUserLevelUp = level.min > (oldScore ?? 0);

  if (didUserLevelUp) {
    await scheduler.runJob({
      name: 'USER_LEVEL_UP',
      data: {
        userId,
        score,
        level,
        subredditName: context.subredditName,
      },
      runAt: new Date(),
    });
  }

  return score;
}

/**
 * Increment the score for a user
 * @param userId - The user ID
 * @param amount - The number of points to increment
 * @returns The new score
 */

export async function incrementScore(
  userId: T2,
  amount: number
): Promise<number> {
  const key = REDIS_KEYS.scores();
  const oldScore = await getScore(userId);
  const score = await redis.zIncrBy(key, userId, amount);
  const level = getLevelByScore(score);
  const oldLevel = getLevelByScore(oldScore);
  const didUserLevelUp = level.min > (oldScore ?? 0);

  // Update claimed level if user leveled up
  if (level.rank > oldLevel.rank && didUserLevelUp) {
    // Keep the old claimed level so the modal will show
    // Don't update it here - let the user claim the new level
  } else if (level.rank === oldLevel.rank) {
    // User stayed at same level, update claimed level to match
    const newClaimedKey = REDIS_KEYS.userLevelUpClaim(userId);
    await redis.set(newClaimedKey, level.rank.toString());
  }

  if (didUserLevelUp) {
    await scheduler.runJob({
      name: 'USER_LEVEL_UP',
      data: {
        userId,
        score,
        level,
        subredditName: context.subredditName,
      },
      runAt: new Date(),
    });
  }

  return score;
}

/**
 * Get the level by score (delegates to shared utility)
 * @param score - The score
 * @returns The level
 */
export function getLevelByScore(score: number): Level {
  return getLevelByScoreUtil(score);
}

export function getUserLevel(score: number): Level {
  return getLevelByScore(score);
}

/**
 * Get the user rank
 * @param userId - The user ID
 * @returns The user rank or -1 if the user is not found
 */

export async function getRank(userId: T2): Promise<number> {
  const rank = await redis.zRank(REDIS_KEYS.scores(), userId);
  return rank ?? -1; // -1 if user not found
}

/**
 * Calculate level progress percentage for a given score
 * @param score - The user's score
 * @returns Progress percentage (0-100)
 */
export function getLevelProgressPercentage(score: number): number {
  const currentLevel = getLevelByScore(score);
  const levelProgress = score - currentLevel.min;
  const levelMax = currentLevel.max - currentLevel.min;
  return Math.min(100, Math.max(0, (levelProgress / levelMax) * 100));
}

/**
 * Get the last claimed level rank for a user
 * @param userId - The user ID
 * @returns The last claimed level rank, or null if never claimed
 */
export async function getLastClaimedLevel(userId: T2): Promise<number | null> {
  const key = REDIS_KEYS.userLevelUpClaim(userId);
  const claimed = await redis.get(key);
  return claimed ? parseInt(claimed, 10) : null;
}

/**
 * Check if user has an unclaimed level-up celebration
 * @param userId - The user ID
 * @returns Level data if unclaimed, null otherwise
 */
export async function getUnclaimedLevelUp(userId: T2): Promise<{
  level: number;
} | null> {
  const score = await getScore(userId);
  const currentLevel = getUserLevel(score);
  const lastClaimed = await getLastClaimedLevel(userId);

  // Don't show level-up for level 1
  if (currentLevel.rank === 1) {
    return null;
  }

  // No level-up if current level hasn't changed
  if (lastClaimed === currentLevel.rank) {
    return null;
  }

  // Has an unclaimed level-up
  return {
    level: currentLevel.rank,
  };
}

/**
 * Mark level as claimed and broadcast to realtime
 * @param userId - The user ID
 * @param level - The level to claim
 */
export async function claimLevelUp(userId: T2, level: number): Promise<void> {
  const key = REDIS_KEYS.userLevelUpClaim(userId);
  await redis.set(key, level.toString());

  // Broadcast claim to all open posts for this user
  await broadcastLevelUpClaimed(userId);
}

/**
 * Broadcast level-up claim to user-scoped realtime channel
 * @param userId - The user ID
 */
async function broadcastLevelUpClaimed(userId: T2): Promise<void> {
  const channelName = `user-${userId}-levelup`;
  await realtime.send(channelName, {
    type: 'levelup_claimed',
    timestamp: Date.now(),
  });
}
