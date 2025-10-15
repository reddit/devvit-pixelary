import { redis } from '@devvit/web/server';
import { RedisKeyFactory } from './redis-factory';
import { getUserScore, getUserLevel } from './leaderboard';
import type { UserProfile, UserData } from '../../shared/schema/pixelary';

/**
 * User profile and progression service for Pixelary
 * Handles user data, drawings, and progression tracking
 */

export async function getUserProfile(
  userId: string,
  postId?: string
): Promise<UserProfile | null> {
  if (!userId) return null;

  try {
    // Get user score and rank
    const { rank, score } = await getUserScore(userId);
    const level = getUserLevel(score);

    // Get post-specific data if postId provided
    let solved = false;
    let skipped = false;
    let guessCount = 0;

    if (postId) {
      const [solvedScore, skippedScore, guessScore] = await Promise.all([
        redis.zScore(RedisKeyFactory.postSolvedKey(postId), userId),
        redis.zScore(RedisKeyFactory.postSkippedKey(postId), userId),
        redis.zScore(RedisKeyFactory.postUserGuessCounterKey(postId), userId),
      ]);

      solved = solvedScore !== undefined;
      skipped = skippedScore !== undefined;
      guessCount = guessScore ?? 0;
    }

    return {
      username: '', // Will need to be looked up separately
      userId,
      score,
      level: level.rank,
      levelName: level.name,
      rank,
      solved,
      skipped,
      guessCount,
    };
  } catch (error) {
    console.error(`Error fetching user profile for userId ${userId}:`, error);
    return null;
  }
}

export async function getUserData(userId: string): Promise<UserData | null> {
  const key = RedisKeyFactory.userDataKey(userId);

  try {
    const data = await redis.hGetAll(key);

    if (Object.keys(data).length === 0) {
      return null;
    }

    return {
      score: parseInt(data.score ?? '0'),
      solved: data.solved === 'true',
      skipped: data.skipped === 'true',
      levelRank: parseInt(data.levelRank ?? '1'),
      levelName: data.levelName ?? 'Newcomer',
      guessCount: parseInt(data.guessCount ?? '0'),
    };
  } catch (error) {
    console.error(`Error fetching user data for userId ${userId}:`, error);
    return null;
  }
}

export async function saveUserData(
  userId: string,
  data: Partial<UserData>
): Promise<boolean> {
  const key = RedisKeyFactory.userDataKey(userId);

  try {
    const stringData: Record<string, string> = {};

    if (data.score !== undefined) stringData.score = data.score.toString();
    if (data.solved !== undefined) stringData.solved = data.solved.toString();
    if (data.skipped !== undefined)
      stringData.skipped = data.skipped.toString();
    if (data.levelRank !== undefined)
      stringData.levelRank = data.levelRank.toString();
    if (data.levelName !== undefined) stringData.levelName = data.levelName;
    if (data.guessCount !== undefined)
      stringData.guessCount = data.guessCount.toString();

    await redis.hSet(key, stringData);
    return true;
  } catch (error) {
    console.error(`Error saving user data for userId ${userId}:`, error);
    return false;
  }
}

export async function getUserDrawings(
  userId: string,
  limit: number = 20
): Promise<string[]> {
  const key = RedisKeyFactory.userDrawingsKey(userId);

  try {
    const drawings = await redis.zRange(key, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    return drawings.map((d) => d.member as string);
  } catch (error) {
    console.error(`Error fetching user drawings for userId ${userId}:`, error);
    return [];
  }
}

export async function addUserDrawing(
  userId: string,
  postId: string
): Promise<boolean> {
  const key = RedisKeyFactory.userDrawingsKey(userId);

  try {
    await redis.zAdd(key, {
      member: postId,
      score: Date.now(),
    });
    return true;
  } catch (error) {
    console.error(`Error adding user drawing for userId ${userId}:`, error);
    return false;
  }
}

export async function getUserRank(
  userId: string
): Promise<{ rank: number; score: number }> {
  return await getUserScore(userId);
}

export async function markPostSolved(
  userId: string,
  postId: string
): Promise<boolean> {
  const key = RedisKeyFactory.postSolvedKey(postId);

  try {
    await redis.zAdd(key, {
      member: userId,
      score: Date.now(),
    });
    return true;
  } catch (error) {
    console.error(`Error marking post solved for userId ${userId}:`, error);
    return false;
  }
}

export async function markPostSkipped(
  userId: string,
  postId: string
): Promise<boolean> {
  const key = RedisKeyFactory.postSkippedKey(postId);

  try {
    await redis.zAdd(key, {
      member: userId,
      score: Date.now(),
    });
    return true;
  } catch (error) {
    console.error(`Error marking post skipped for userId ${userId}:`, error);
    return false;
  }
}

export async function incrementUserGuessCount(
  userId: string,
  postId: string
): Promise<number> {
  const key = RedisKeyFactory.postUserGuessCounterKey(postId);

  try {
    return await redis.zIncrBy(key, userId, 1);
  } catch (error) {
    console.error(
      `Error incrementing guess count for userId ${userId}:`,
      error
    );
    return 0;
  }
}

export async function getUserGuessCount(
  userId: string,
  postId: string
): Promise<number> {
  const key = RedisKeyFactory.postUserGuessCounterKey(postId);

  try {
    const count = await redis.zScore(key, userId);
    return count ?? 0;
  } catch (error) {
    console.error(`Error fetching guess count for userId ${userId}:`, error);
    return 0;
  }
}

export async function hasUserSolvedPost(
  userId: string,
  postId: string
): Promise<boolean> {
  const key = RedisKeyFactory.postSolvedKey(postId);

  try {
    const score = await redis.zScore(key, userId);
    return score !== undefined;
  } catch (error) {
    console.error(
      `Error checking if user solved post for userId ${userId}:`,
      error
    );
    return false;
  }
}

export async function hasUserSkippedPost(
  userId: string,
  postId: string
): Promise<boolean> {
  const key = RedisKeyFactory.postSkippedKey(postId);

  try {
    const score = await redis.zScore(key, userId);
    return score !== undefined;
  } catch (error) {
    console.error(
      `Error checking if user skipped post for userId ${userId}:`,
      error
    );
    return false;
  }
}
