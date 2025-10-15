import { redis } from '@devvit/web/server';
import { RedisKeyFactory } from './redis-factory';
import {
  LEVELS,
  AUTHOR_REWARD_SUBMIT,
  AUTHOR_REWARD_CORRECT_GUESS,
  GUESSER_REWARD_SOLVE,
  GUESSER_REWARD_FIRST_SOLVE,
} from '../../shared/constants';
import type { Level } from '../../shared/constants';

/**
 * Leaderboard and scoring service for Pixelary
 * Handles user scores, levels, and leaderboard operations
 */

export interface LeaderboardEntry {
  username: string;
  score: number;
  rank: number;
}

export interface UserScore {
  rank: number;
  score: number;
}

export async function getLeaderboard(
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const key = RedisKeyFactory.scoresKey();

  try {
    const entries = await redis.zRange(key, 0, limit - 1, {
      reverse: true,
      by: 'rank',
    });

    return entries.map((entry, index) => ({
      username: entry.member as string,
      score: entry.score,
      rank: index + 1,
    }));
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
}

export async function getUserScore(userId: string): Promise<UserScore> {
  const key = RedisKeyFactory.scoresKey();

  try {
    const [rank, score] = await Promise.all([
      redis.zRank(key, userId),
      redis.zScore(key, userId),
    ]);

    return {
      rank: rank !== undefined ? rank + 1 : -1, // Redis ranks are 0-based
      score: score ?? 0,
    };
  } catch (error) {
    console.error(`Error fetching user score for userId ${userId}:`, error);
    return { rank: -1, score: 0 };
  }
}

export async function incrementUserScore(
  userId: string,
  points: number,
  context?: {
    scheduler?: {
      runJob: (params: {
        name: string;
        data: unknown;
        runAt?: Date;
      }) => Promise<void>;
    };
  }
): Promise<number> {
  const key = RedisKeyFactory.scoresKey();

  try {
    const prevScore = (await redis.zScore(key, userId)) ?? 0;
    const newScore = await redis.zIncrBy(key, userId, points);

    // Check for level up
    const prevLevel = getLevelByScore(prevScore);
    const newLevel = getLevelByScore(newScore);

    if (newLevel.rank > prevLevel.rank && context?.scheduler) {
      // Schedule level up job
      console.log(
        `Scheduling level up job for userId ${userId}: ${prevLevel.rank} -> ${newLevel.rank} (score: ${newScore})`
      );
      await context.scheduler.runJob({
        name: 'USER_LEVEL_UP',
        data: {
          userId,
          score: newScore,
          prevLevel,
          newLevel,
        },
        runAt: new Date(),
      });
    }

    return newScore;
  } catch (error) {
    console.error(`Error incrementing score for userId ${userId}:`, error);
    return 0;
  }
}

export async function awardDrawingSubmission(
  userId: string,
  context?: {
    scheduler?: {
      runJob: (params: {
        name: string;
        data: unknown;
        runAt?: Date;
      }) => Promise<void>;
    };
  }
): Promise<number> {
  return await incrementUserScore(userId, AUTHOR_REWARD_SUBMIT, context);
}

export async function awardCorrectGuess(
  userId: string,
  isFirstSolve: boolean,
  context?: {
    scheduler?: {
      runJob: (params: {
        name: string;
        data: unknown;
        runAt?: Date;
      }) => Promise<void>;
    };
  }
): Promise<number> {
  const points =
    GUESSER_REWARD_SOLVE + (isFirstSolve ? GUESSER_REWARD_FIRST_SOLVE : 0);
  return await incrementUserScore(userId, points, context);
}

export async function awardAuthorForSolve(
  userId: string,
  context?: {
    scheduler?: {
      runJob: (params: {
        name: string;
        data: unknown;
        runAt?: Date;
      }) => Promise<void>;
    };
  }
): Promise<number> {
  return await incrementUserScore(userId, AUTHOR_REWARD_CORRECT_GUESS, context);
}

export function getLevelByScore(score: number): Level {
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

export function getLevel(rank: number): Level | null {
  return LEVELS.find((level) => level.rank === rank) ?? null;
}

export function getUserLevel(score: number): Level {
  return getLevelByScore(score);
}

export async function getUserRank(userId: string): Promise<number> {
  const key = RedisKeyFactory.scoresKey();

  try {
    const rank = await redis.zRank(key, userId);
    return rank !== undefined ? rank + 1 : -1; // Redis ranks are 0-based
  } catch (error) {
    console.error(`Error fetching user rank for userId ${userId}:`, error);
    return -1;
  }
}

export async function getTotalPlayers(): Promise<number> {
  const key = RedisKeyFactory.scoresKey();

  try {
    return await redis.zCard(key);
  } catch (error) {
    console.error('Error fetching total players:', error);
    return 0;
  }
}

export async function getUserPosition(
  username: string
): Promise<{ rank: number; totalPlayers: number }> {
  const [rank, totalPlayers] = await Promise.all([
    getUserRank(username),
    getTotalPlayers(),
  ]);

  return { rank, totalPlayers };
}

// Utility function for calculating level progress percentage
export function getLevelProgress(score: number): {
  currentLevel: Level;
  nextLevel: Level | null;
  progress: number;
} {
  const currentLevel = getLevelByScore(score);
  const currentIndex = LEVELS.findIndex(
    (level) => level.rank === currentLevel.rank
  );
  const nextLevel =
    currentIndex < LEVELS.length - 1 ? LEVELS[currentIndex + 1]! : null;

  const progress = nextLevel
    ? ((score - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100
    : 100;

  return {
    currentLevel,
    nextLevel,
    progress: Math.min(Math.max(progress, 0), 100),
  };
}
