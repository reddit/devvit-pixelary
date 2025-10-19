import { redis, scheduler } from '@devvit/web/server';
import { LEVELS } from '../../shared/constants';
import { getUsername, REDIS_KEYS } from './redis';
import { parseT2, type T2, type Level } from '../../shared/types';

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

  // Top leaderboard entries
  const entries = await redis.zRange(
    REDIS_KEYS.scores(),
    cursor,
    cursor + limit - 1,
    {
      reverse,
      by,
    }
  );

  // Hydrate entries with usernames
  const data = await Promise.all(
    entries.map(async (entry, index) => {
      const username = await getUsername(parseT2(entry.member));
      return {
        username: username ?? 'Unknown',
        userId: parseT2(entry.member),
        score: entry.score,
        rank: cursor + index + 1,
      };
    })
  );

  // Return the leaderboard entries and the next cursor
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
  const score = await redis.zIncrBy(key, userId, amount);
  const level = getLevelByScore(score);
  const didUserLevelUp = level.min > score - amount;

  if (didUserLevelUp) {
    await scheduler.runJob({
      name: 'USER_LEVEL_UP',
      data: {
        userId,
        score,
        level,
      },
      runAt: new Date(),
    });
  }

  return score;
}

/**
 * Get the level by score
 * @param score - The score
 * @returns The level
 */

export function getLevelByScore(score: number): Level {
  // Handle negative scores - return level 1
  if (score < 0) {
    return LEVELS[0]!;
  }

  // Binary search for the appropriate level
  let left = 0;
  let right = LEVELS.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const level = LEVELS[mid]!;

    if (score >= level.min && score <= level.max) {
      return level;
    } else if (score < level.min) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  // If score is higher than max level, return the highest level
  return LEVELS[LEVELS.length - 1]!;
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

// Utility function for calculating level progress percentage
